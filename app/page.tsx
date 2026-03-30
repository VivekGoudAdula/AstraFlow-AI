'use client'

import React, { useState, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import type { AIAgentResponse } from '@/lib/aiAgent'
import { storeAndFindSimilar } from '@/lib/qdrant'
import type { SimilarCompanyFromQdrant } from './sections/ResultsGrid'
import Header from './sections/Header'
import LoadingState from './sections/LoadingState'
import ResultsGrid from './sections/ResultsGrid'
import MarketPatterns from './sections/MarketPatterns'
import type { Company } from './sections/ResultsGrid'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'

// --- Theme ---
const THEME_VARS = {
  '--background': '35 29% 95%',
  '--foreground': '30 22% 14%',
  '--card': '35 29% 92%',
  '--card-foreground': '30 22% 14%',
  '--primary': '27 61% 26%',
  '--primary-foreground': '35 29% 98%',
  '--secondary': '35 20% 88%',
  '--secondary-foreground': '30 22% 18%',
  '--accent': '43 75% 38%',
  '--accent-foreground': '35 29% 98%',
  '--muted': '35 15% 85%',
  '--muted-foreground': '30 20% 45%',
  '--border': '27 61% 26%',
  '--input': '35 15% 75%',
  '--ring': '27 61% 26%',
  '--destructive': '0 84% 60%',
  '--radius': '0.5rem',
} as React.CSSProperties

// --- Agent IDs ---
const COORDINATOR_AGENT_ID = '69c8e2962233a0528b6d6110'

// --- Placeholder removed ---

// --- Helper: Parse agent result (handles string or object) ---
function parseAgentResult(result: AIAgentResponse): any {
  let data = result?.response?.result
  if (typeof data === 'string') {
    try { data = JSON.parse(data) } catch { /* keep as string */ }
  }
  return data
}

function extractCompanies(data: any): Company[] {
  if (Array.isArray(data?.companies)) return data.companies
  if (Array.isArray(data?.result?.companies)) return data.result.companies
  if (Array.isArray(data)) return data
  return []
}

// --- Helper: Validate LinkedIn URLs ---
function isValidLinkedIn(url: string): boolean {
  if (!url || url === 'Not specified') return false
  return url.includes('linkedin.com/in/')
}

// --- Helper: Normalize funding strings ---
function normalizeFunding(value: string): string {
  if (!value) return 'Not specified'
  return value.replace(/\(.*?\)/g, '').trim()
}

// --- Helper: Robust Source Cleaner (Anti-Corruption) ---
function fixSourceUrls(source: any): string[] {
  if (!source || source === 'Not specified') return []
  
  let rawLinks: string[] = []

  if (Array.isArray(source)) {
    rawLinks = source.map(s => String(s).trim())
  } else {
    const str = String(source).trim()
    // Handle stringified JSON array
    if (str.startsWith('[') && str.endsWith(']')) {
      try {
        const parsed = JSON.parse(str)
        if (Array.isArray(parsed)) {
          rawLinks = parsed.map(s => String(s).trim())
        }
      } catch {
        rawLinks = [str]
      }
    } else {
      // Split by ' | ' or ','
      rawLinks = str.split(/[|,]/).map(s => s.trim()).filter(Boolean)
    }
  }

  // Clean and filter (must start with http, max 3)
  return rawLinks
    .map(link => link.replace(/^["']+|["']+$/g, '')) // Remove rogue quotes
    .filter(link => link.startsWith('http'))
    .slice(0, 3)
}

// --- Helper: LinkedIn Discovery via server-side route (name OR company-only Google search) ---
// --- Helper: LinkedIn & Email Discovery via server-side route ---
async function findLinkedInWithApify(name: string, company: string, role: string = 'founder'): Promise<{ profileUrl: string; email: string }> {
  if (!company || company.length < 2) return { profileUrl: 'Not specified', email: 'Not specified' }
  const cleanName = (name && name !== 'Not specified' && name.length >= 2) ? name : ''
  try {
    console.log(`🔍 [Apify Discovery] role="${role}" name="${cleanName || 'NONE'}" company="${company}"`)
    const res = await fetch('/api/linkedin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName, company, role }),
    })
    const data = await res.json()
    
    const profileUrl = (data?.profileUrl && data.profileUrl.includes('linkedin.com/in/')) ? data.profileUrl : 'Not specified'
    const email = (data?.email && data.email.includes('@')) ? data.email : 'Not specified'
    
    if (profileUrl !== 'Not specified') console.log(`✅ [Apify Discovery] Found ${role}: ${profileUrl}`)
    if (email !== 'Not specified') console.log(`📧 [Apify Discovery] Found ${role} Email: ${email}`)

    return { profileUrl, email }
  } catch (err) {
    console.error(`❌ [Apify Discovery] Error (${role}):`, err)
    return { profileUrl: 'Not specified', email: 'Not specified' }
  }
}

// --- Error Boundary ---
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// --- Helper: Domain Deriver & Email Generator ---
function deriveDomain(name: string, sourceUrls: string[]): string {
  if (!name || name === 'Not specified') return ''
  
  // Try to extract from source URLs first
  for (const url of sourceUrls) {
    try {
      const hostname = new URL(url).hostname.replace('www.', '')
      // Basic check: if it's a major news site, skip it
      const newsSites = ['techcrunch.com', 'bloomberg.com', 'venturebeat.com', 'crunchbase.com', 'prnewswire.com', 'globenewswire.com', 'news.crunchbase.com']
      if (!newsSites.includes(hostname)) return hostname
    } catch { /* skip */ }
  }

  // Fallback: simple slugification (best effort)
  return name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.ai' 
}

function generateFallbackEmail(name: string, sourceUrls: string[]): string {
  const domain = deriveDomain(name, sourceUrls)
  if (!domain) return 'Not specified'
  return `contact@${domain}`
}

function generateMarketingEmail(name: string, sourceUrls: string[]): string {
  const domain = deriveDomain(name, sourceUrls)
  if (!domain) return 'Not specified'
  return `marketing@${domain}`
}

// --- Page ---
export default function Page() {
  const [searchQuery, setSearchQuery] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [totalFound, setTotalFound] = useState(0)
  const [pipelineStatus, setPipelineStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('Researching...')
  const [error, setError] = useState('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Qdrant state
  const [qdrantSimilar, setQdrantSimilar] = useState<Record<string, SimilarCompanyFromQdrant[]>>({})
  const [qdrantStatus, setQdrantStatus] = useState<string>('')

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error' | null; message: string; url?: string }>({ type: null, message: '' })

  const displayCompanies = companies

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsLoading(true)
    setError('')
    setCompanies([])
    setQdrantSimilar({})
    setQdrantStatus('')
    setExportStatus({ type: null, message: '' })
    setLoadingStep('Searching Google for source links...')
    setActiveAgentId(COORDINATOR_AGENT_ID)

    const stepTimer1 = setTimeout(() => setLoadingStep('Extracting company details...'), 8000)
    const stepTimer2 = setTimeout(() => setLoadingStep('Enriching funding profiles...'), 18000)

    try {
      console.log('🚀 [Scout Engine] Starting Scan for:', searchQuery)

      // 🔍 1. PRE-FLOW: Fetch verified Google Search links
      let finalLinks = 'Not specified'
      try {
        const searchRes = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchQuery + " recent AI funding news" }),
        })
        const searchData = await searchRes.json()
        if (searchData.success && searchData.links?.length > 0) {
          finalLinks = searchData.links.join(' | ')
          console.log('🔗 [Scout Engine] Injected Verified Links:', finalLinks)
        }
      } catch (err) {
        console.error('⚠️ [Scout Engine] Pre-search failed:', err)
      }

      setLoadingStep('Researching market data...')

      // 🧠 2. PROMPT: Update with strict source rules and injected links
    const promptInstructions = `
Identify recently funded AI companies for: "${searchQuery}".
Return ONLY high-quality results with LIVE, VERIFIED links.

SOURCE OF PROOF RULE (STRICT):
- search_results: ${finalLinks}
- ONLY use links from the "search_results" list provided above.
- DO NOT generate, modify, or combine URLs.
- DO NOT create TechCrunch links manually.
- Pick 1–3 most relevant links for each company.
- If no valid link exists → return "Not specified".
- Output links as a clean string separated by " | ".
  Example: https://bloomberg.com/... | https://venturebeat.com/...
- NEVER return broken or partial links.

EMAIL RULE (UPDATED):
- If a direct email is found in sources → use it.
- If NOT found:
    → derive company domain (e.g., laminar.ai)
    → generate a SAFE public email using: contact@domain OR hello@domain OR info@domain
- NEVER guess personal emails (like founder@gmail.com).
- NEVER hallucinate random emails.
- If domain not found → return "Not specified".

MARKETING CONTACT RULE:
- Try to find a marketing or community manager from search results.
- Look for roles like: "Marketing Manager", "Community Manager", "Growth Manager", "Developer Relations".
- ONLY return LinkedIn if it appears in search results and the role matches.
- If no clear match → "Not specified".
- DO NOT guess roles or assign random employees.

MARKETING LINKEDIN RULE:
- Only return LinkedIn profile if the role clearly includes: marketing, community, growth, or developer relations.
- Must be verifiable from search results.
- If no valid match → "Not specified".
- NEVER assign a founder or random employee to this role.

-------------------------
STRICT HUMAN-CENTRIC EXTRACTION (MANDATORY)
-------------------------
1. FOUNDER IDENTITY: You MUST identify the REAL FULL NAME of the Founder/CEO.
   - Key to use: "founder_name"
2. MARKETING IDENTITY: Identify the REAL FULL NAME of the Head of Growth or Marketing.
   - Look for: Marketing Manager, Community Manager, Growth Lead, DevRel.
   - Key to use: "marketing_manager_name"
3. NO GUESSING: DO NOT generate LinkedIn URLs. ONLY return the REAL Names.
4. "source_of_proof": MUST be the clean string from search inputs.
5. "email": MUST follow the EMAIL RULE (UPDATED) above for the company/founder.

EXAMPLE OUTPUT:
{
  "companies": [
    {
      "company_name": "OpenAI",
      "founder_name": "Sam Altman",
      "marketing_manager_name": "Not specified",
      "email": "contact@openai.com",
      "date_founded": "2015",
      "funding_total": "$11B+",
      "latest_funding": "$6.6B led by Thrive Capital, Oct 2024",
      "source_of_proof": "https://www.bloomberg.com/news/articles/2024-10-02/openai-funding-round | https://news.crunchbase.com/ai/openai-funding/"
    }
  ],
  "total_companies_found": 3,
  "pipeline_status": "Human Intelligence Scan"
}
Return ONLY JSON.
`

      const result = await callAIAgent(promptInstructions, COORDINATOR_AGENT_ID)
      
      const rawCount = result?.response?.result?.length || 0
      console.log('📥 [Scout Engine] Agent Result received:', { success: result.success, rawCount })

      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)

      if (result.success) {
        const data = parseAgentResult(result)
        console.log('🧩 [Scout Engine] Parsed Data:', data)

        let extracted = extractCompanies(data)
        
        // 🧪 Multi-key Name Extraction (check all possible field variants)
        extracted = extracted.map(c => {
          const raw = c as any
          // Check ALL possible field name variants the agent might use
          const fName: string = (
            raw.founder_name || 
            raw.founder || 
            raw.ceo_name || 
            raw.ceo || 
            raw.founder_ceo ||
            raw.founders ||
            ''
          ).trim()

          const mName: string = (
            raw.marketing_manager_name || 
            raw.marketing_manager ||
            raw.head_of_marketing ||
            raw.growth_lead ||
            ''
          ).trim()

          // Validate: reject placeholder values
          const cleanName = (n: string) => {
            if (!n || n === 'Not specified' || n.toLowerCase() === 'not specified') return ''
            return n
          }

          return { ...c, founder_name: cleanName(fName), marketing_manager_name: cleanName(mName) }
        })

        console.log(`📋 [Scout Engine] Processing ${extracted.length} companies. Founder names: ${extracted.map(c => `"${c.founder_name || 'NONE'}"`).join(', ')}`)


        extracted = extracted.map(c => ({
          ...c,
          founder_linkedin: isValidLinkedIn(c.founder_linkedin || '') ? c.founder_linkedin : 'Not specified',
          marketing_community_manager_linkedin: isValidLinkedIn(c.marketing_community_manager_linkedin || '') ? c.marketing_community_manager_linkedin : 'Not specified',
          funding_total: normalizeFunding(c.funding_total || ''),
          email: (c.email && c.email.includes('@')) ? c.email : 'Not specified',
          source_of_proof: fixSourceUrls(c.source_of_proof) 
        }))

        // 🥇 STEP 2.5 — ENRICHMENT (Apify LinkedIn Resolution)
        setLoadingStep('Resolving professional profiles...')
        console.log('⚡ [Scout Engine] Starting Apify Loop...')

        const enriched: Company[] = await Promise.all(extracted.map(async (c: Company) => {
          let f_linkedin = c.founder_linkedin
          let f_email = c.email
          let m_linkedin = c.marketing_community_manager_linkedin
          let m_email = c.marketing_community_manager_email

          // Always try to resolve founder — even if name is empty, the server route will try
          if (!isValidLinkedIn(f_linkedin || '')) {
            const nameToSearch = c.founder_name && c.founder_name !== 'Not specified' ? c.founder_name : ''
            console.log(`🔎 [Scout Engine] Resolving Founder for "${c.company_name}" with name: "${nameToSearch || 'UNKNOWN'}"`)
            const discovery = await findLinkedInWithApify(nameToSearch, c.company_name || '')
            f_linkedin = discovery.profileUrl
            if (discovery.email !== 'Not specified' && discovery.email.includes('@')) f_email = discovery.email
          }

          if (!isValidLinkedIn(m_linkedin || '') && c.marketing_manager_name && c.marketing_manager_name !== 'Not specified') {
            console.log(`🔎 [Scout Engine] Resolving Marketing for "${c.company_name}": "${c.marketing_manager_name}"`)
            const discovery = await findLinkedInWithApify(c.marketing_manager_name!, c.company_name || '', 'marketing_manager')
            m_linkedin = discovery.profileUrl
            if (discovery.email !== 'Not specified' && discovery.email.includes('@')) m_email = discovery.email
          }

          // 🔥 FALLBACK ENRICHMENT: Generate "safe" public emails if still missing
          if (!f_email || f_email === 'Not specified' || !f_email.includes('@')) {
            f_email = generateFallbackEmail(c.company_name || '', c.source_of_proof || [])
          }

          if (!m_email || m_email === 'Not specified' || !m_email.includes('@')) {
            m_email = generateMarketingEmail(c.company_name || '', c.source_of_proof || [])
          }

          return {
            ...c,
            founder_linkedin: f_linkedin,
            email: f_email,
            marketing_community_manager_linkedin: m_linkedin,
            marketing_community_manager_email: m_email
          }
        }))

        console.log('✨ [Scout Engine] Final Enriched Results:', enriched)

        // 🥉 STEP 3 — SMART QUALITY FILTER (High Integrity)
        const highIntegrityCompanies = enriched.filter(c => {
          const hasName = !!c.company_name && c.company_name !== 'Not specified'
          const hasSource = !!c.source_of_proof && c.source_of_proof.length > 0
          return hasName && hasSource
        })

        if (highIntegrityCompanies.length === 0 && rawCount > 0) {
          toast.warning("Verification failed for all companies. Showing raw data instead.")
          setCompanies(enriched)
          setTotalFound(rawCount)
        } else {
          setCompanies(highIntegrityCompanies)
          setTotalFound(highIntegrityCompanies.length)
        }

        setPipelineStatus(data?.pipeline_status ?? 'Deep Scan Complete')

        // After getting companies, store in Qdrant and find similar (async, non-blocking)
        const toStore = highIntegrityCompanies.length > 0 ? highIntegrityCompanies : enriched
        if (toStore.length > 0) {
          setLoadingStep('Querying vector memory...')
          try {
            const qdrantResult = await storeAndFindSimilar(
              toStore.map(c => ({
                company_name: c.company_name || 'Not specified',
                funding_total: c.funding_total || 'Not specified',
                latest_funding: c.latest_funding || 'Not specified',
                category_tag: c.category_tag || 'AI Tools',
                funding_score: c.funding_score || 0,
                why_this_matters: c.why_this_matters || 'No additional insight provided',
                date_founded: c.date_founded || 'Not specified',
                source_of_proof: Array.isArray(c.source_of_proof) ? c.source_of_proof.join(', ') : (c.source_of_proof || 'Not specified'),
                founder_linkedin: c.founder_linkedin || 'Not specified',
                email: c.email || 'Not specified',
                marketing_community_manager_linkedin: c.marketing_community_manager_linkedin || 'Not specified',
                marketing_community_manager_email: c.marketing_community_manager_email || 'Not specified',
                trending_flag: c.trending_flag || false,
              }))
            )
            setQdrantSimilar(qdrantResult)
            setQdrantStatus('connected')
          } catch {
            setQdrantStatus('unavailable')
          }
        }
      } else {
        setError(result?.error ?? 'Intelligence scan failed. Please try again.')
      }
    } catch (e) {
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
      setActiveAgentId(null)
    }
  }, [searchQuery])

  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1V7YVeOjM5RvRP7X8lUyFaH6b_oE2CmPkSXbVV5gQ14Y/edit?usp=sharing'

  // Download CSV
  const handleDownloadCSV = useCallback(async () => {
    const toExport = displayCompanies
    if (!Array.isArray(toExport) || toExport.length === 0) return

    setIsExporting(true)
    setExportStatus({ type: null, message: '' })

    try {
      const res = await fetch('/api/export-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: toExport, mode: 'csv' }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `AstraFlow_AI_Export_${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setExportStatus({
          type: 'success',
          message: `Downloaded ${toExport.length} companies as CSV.`,
        })
      } else {
        setExportStatus({ type: 'error', message: 'CSV export failed.' })
      }
    } catch (e) {
      setExportStatus({ type: 'error', message: e instanceof Error ? e.message : 'Export failed.' })
    } finally {
      setIsExporting(false)
    }
  }, [displayCompanies])

  // Export directly to Google Sheets — creates a NEW sheet via /api/export
  const handleExportToSheets = useCallback(async () => {
    const toExport = displayCompanies
    if (!Array.isArray(toExport) || toExport.length === 0) return

    setIsExporting(true)
    setExportStatus({ type: null, message: '' })
    const toastId = toast.loading('Creating your Google Sheet...')

    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: toExport }),
      })

      const data = await res.json()

      if (data.success && data.url) {
        setExportStatus({
          type: 'success',
          message: `Google Sheet created successfully with ${toExport.length} companies.`,
          url: data.url,
        })
        toast.success('Google Sheet created successfully', { id: toastId })
        // Open the sheet in a new tab as requested
        window.open(data.url, "_blank")
      } else {
        const errorMsg = data.error || 'Google Sheets export failed.'
        setExportStatus({ type: 'error', message: errorMsg })
        toast.error(errorMsg, { id: toastId })
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Export failed.'
      setExportStatus({ type: 'error', message: errorMsg })
      toast.error(errorMsg, { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }, [displayCompanies])

  // Toggle sample data removed

  return (
    <ErrorBoundary>
      <div style={THEME_VARS} className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-background via-background to-secondary/20 text-foreground font-sans selection:bg-primary/20">
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          isLoading={isLoading}
        />

        {/* Error State */}
        {error && (
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-center">
              <p className="text-sm text-destructive mb-2">{error}</p>
              <button onClick={handleSearch} className="text-sm underline text-destructive hover:text-destructive/80 transition-colors duration-200">
                Retry scan
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && <LoadingState loadingStep={loadingStep} />}

        {/* Empty State */}
        {!isLoading && displayCompanies.length === 0 && !error && (
          <div className="max-w-xl mx-auto px-6 py-16 text-center">
            <div className="bg-card border border-border rounded-lg p-10">
              <p className="font-serif text-2xl text-foreground mb-3 tracking-wide">Ready to explore</p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Enter a search query above to scan the AI developer tools market. The intelligence engine will research, extract, and enrich funding data from across the web.
              </p>
            </div>
          </div>
        )}

        {/* Market Pattern Detection */}
        {!isLoading && displayCompanies.length > 0 && (
          <MarketPatterns companies={displayCompanies} />
        )}

        {/* Results with inline Export button */}
        {!isLoading && displayCompanies.length > 0 && (
          <ResultsGrid
            companies={displayCompanies}
            totalFound={totalFound}
            pipelineStatus={pipelineStatus}
            onExportCSV={handleDownloadCSV}
            onExportSheets={handleExportToSheets}
            isExporting={isExporting}
            exportStatus={exportStatus}
            qdrantSimilar={qdrantSimilar}
            qdrantStatus={qdrantStatus}
          />
        )}

        {/* Agent Status Section */}
        <div className="max-w-5xl mx-auto px-6 pb-8" id="about">
          <div className="bg-card border border-border rounded-lg p-6 mb-8">
            <h4 className="font-serif text-lg font-bold text-foreground tracking-wide mb-4">Powered by AI Agents</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeAgentId === COORDINATOR_AGENT_ID ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Funding Intelligence Coordinator</p>
                  <p className="text-xs text-muted-foreground">Orchestrates research, extraction, and enrichment pipeline</p>
                </div>
                {activeAgentId === COORDINATOR_AGENT_ID && <Badge variant="secondary" className="text-xs flex-shrink-0">Active</Badge>}
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${(loadingStep === 'Resolving professional profiles...' && isLoading) ? 'bg-blue-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Apify Discovery Engine</p>
                  <p className="text-xs text-muted-foreground">Executes intelligent queries for real-time social profile verification</p>
                </div>
                {(loadingStep === 'Resolving professional profiles...' && isLoading) && <Badge variant="secondary" className="text-xs flex-shrink-0">Active</Badge>}
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${(loadingStep === 'Querying vector memory...' && isLoading) ? 'bg-purple-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Qdrant Vector Memory</p>
                  <p className="text-xs text-muted-foreground">Performs high-dimensional semantic clustering to identify market competitors</p>
                </div>
                {(loadingStep === 'Querying vector memory...' && isLoading) && <Badge variant="secondary" className="text-xs flex-shrink-0">Active</Badge>}
              </div>

              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isExporting ? 'bg-orange-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Google Cloud API</p>
                  <p className="text-xs text-muted-foreground">Direct integration for production-grade Sheets export</p>
                </div>
                {isExporting && <Badge variant="secondary" className="text-xs flex-shrink-0">Active</Badge>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
