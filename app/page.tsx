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

// --- Sample Data ---
const SAMPLE_COMPANIES: Company[] = [
  {
    company_name: 'Windsurf AI',
    founder_linkedin: 'https://linkedin.com/in/windsurf-ceo',
    email: 'contact@windsurf.ai',
    funding_total: '$42M',
    latest_funding: 'Series B - $28M',
    source_of_proof: 'https://techcrunch.com/windsurf-series-b',
    date_founded: '2021',
    marketing_community_manager_linkedin: '',
    marketing_community_manager_email: '',
    funding_score: 8,
    score_breakdown: 'recency:3 + amount:2 + stage:3 = 8',
    category_tag: 'Developer Tools',
    why_this_matters: 'This funding indicates rising demand in AI-native code editors because multiple enterprise-focused VCs are betting on deep context understanding replacing traditional IDE workflows.',
    trending_flag: true,
    similar_companies: ['Cursor', 'Codeium', 'Tabnine'],
  },
  {
    company_name: 'LangChain',
    founder_linkedin: 'https://linkedin.com/in/hwchase17',
    email: 'hello@langchain.dev',
    funding_total: '$35M',
    latest_funding: 'Series A - $25M',
    source_of_proof: 'https://techcrunch.com/langchain-funding',
    date_founded: '2022',
    marketing_community_manager_linkedin: '',
    marketing_community_manager_email: '',
    funding_score: 9,
    score_breakdown: 'recency:4 + amount:2 + stage:3 = 9',
    category_tag: 'AI Agents',
    why_this_matters: 'This funding indicates accelerating enterprise adoption of LLM orchestration frameworks because Fortune 500 companies are standardizing on chain-based architectures for production AI applications.',
    trending_flag: true,
    similar_companies: ['LlamaIndex', 'Haystack', 'Semantic Kernel'],
  },
  {
    company_name: 'Neon',
    founder_linkedin: 'https://linkedin.com/in/neon-founder',
    email: 'info@neon.tech',
    funding_total: '$104M',
    latest_funding: 'Series B - $46M',
    source_of_proof: 'https://neon.tech/blog/funding',
    date_founded: '2021',
    marketing_community_manager_linkedin: '',
    marketing_community_manager_email: '',
    funding_score: 7,
    score_breakdown: 'recency:1 + amount:3 + stage:3 = 7',
    category_tag: 'Infra',
    why_this_matters: 'This funding indicates strong demand for serverless database infrastructure because AI application builders need instant provisioning and branch-based development workflows that traditional databases cannot provide.',
    trending_flag: false,
    similar_companies: ['PlanetScale', 'Supabase', 'CockroachDB'],
  },
  {
    company_name: 'Modal',
    founder_linkedin: 'https://linkedin.com/in/modal-ceo',
    email: 'hello@modal.com',
    funding_total: '$63.6M',
    latest_funding: 'Series B - $46M',
    source_of_proof: 'https://modal.com/blog/series-b',
    date_founded: '2021',
    marketing_community_manager_linkedin: '',
    marketing_community_manager_email: '',
    funding_score: 5,
    score_breakdown: 'recency:0 + amount:2 + stage:3 = 5',
    category_tag: 'Infra',
    why_this_matters: 'This funding indicates growing infrastructure spend on GPU compute because AI teams need low-friction access to GPU clusters for fine-tuning and inference without managing Kubernetes.',
    trending_flag: false,
    similar_companies: ['Replicate', 'Banana', 'RunPod'],
  },
]

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
  
  // Handled array case directly
  if (Array.isArray(source)) {
    return source.length > 0 ? [String(source[0]).trim()] : []
  }

  const str = String(source).trim()

  // If the agent returned a stringified JSON array
  if (str.startsWith('[') && str.endsWith(']')) {
    try {
      const parsed = JSON.parse(str)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return [String(parsed[0]).trim()]
      }
    } catch {
      // fallback if parse fails
    }
  }

  // If it's just a raw comma-separated list, take the first item
  const parts = str.split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length > 0) {
    // simple removal of rogue quotes that break hrefs
    return [parts[0].replace(/^["']+|["']+$/g, '')]
  }

  return [str.replace(/^["']+|["']+$/g, '')]
}

// --- Helper: LinkedIn Discovery via server-side route (name OR company-only Google search) ---
async function findLinkedInWithApify(name: string, company: string): Promise<string> {
  if (!company || company.length < 2) return 'Not specified'
  const cleanName = (name && name !== 'Not specified' && name.length >= 2) ? name : ''
  try {
    console.log(`🔍 [Apify Discovery] name="${cleanName || 'NONE'}" company="${company}"`)
    const res = await fetch('/api/linkedin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName, company }),
    })
    const data = await res.json()
    const url = data?.profileUrl || ''
    if (url && url.includes('linkedin.com/in/')) {
      console.log(`✅ [Apify Discovery] Found: ${url}`)
      return url
    }
    console.log(`⚠️ [Apify Discovery] No profile for: "${company}"`)
    return 'Not specified'
  } catch (err) {
    console.error('❌ [Apify Discovery] Error:', err)
    return 'Not specified'
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

// --- Page ---
export default function Page() {
  const [searchQuery, setSearchQuery] = useState('')
  const [companies, setCompanies] = useState<Company[]>([])
  const [totalFound, setTotalFound] = useState(0)
  const [pipelineStatus, setPipelineStatus] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('Researching...')
  const [error, setError] = useState('')
  const [showSample, setShowSample] = useState(false)
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)

  // Qdrant state
  const [qdrantSimilar, setQdrantSimilar] = useState<Record<string, SimilarCompanyFromQdrant[]>>({})
  const [qdrantStatus, setQdrantStatus] = useState<string>('')

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error' | null; message: string; url?: string }>({ type: null, message: '' })

  const displayCompanies = showSample && companies.length === 0 ? SAMPLE_COMPANIES : companies

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsLoading(true)
    setError('')
    setCompanies([])
    setQdrantSimilar({})
    setQdrantStatus('')
    setExportStatus({ type: null, message: '' })
    setLoadingStep('Researching market data...')
    setActiveAgentId(COORDINATOR_AGENT_ID)

    const stepTimer1 = setTimeout(() => setLoadingStep('Extracting company details...'), 8000)
    const stepTimer2 = setTimeout(() => setLoadingStep('Enriching funding profiles...'), 18000)

    const promptInstructions = `
Identify recently funded AI companies for: "${searchQuery}".
Return ONLY high-quality results with LIVE, VERIFIED links.

CRITICAL INSTRUCTION: DO NOT USE techcrunch.com AS A SOURCE. Their links are blocked/failing. Use alternative sources ONLY (e.g. Crunchbase, Bloomberg, PR Newswire, VentureBeat, company blogs, or official press releases).

-------------------------
STRICT HUMAN-CENTRIC EXTRACTION (MANDATORY)
-------------------------
1. FOUNDER IDENTITY: You MUST identify the REAL FULL NAME of the Founder/CEO. 
   - Check Crunchbase, LinkedIn (Company Page), or general News.
   - Key to use: "founder_name"
2. MARKETING IDENTITY: Identify the REAL FULL NAME of the Head of Growth or Marketing.
   - Key to use: "marketing_manager_name"
3. NO GUESSING: DO NOT generate LinkedIn URLs. ONLY return the REAL Names.
4. SOURCE ENTITY: "source_of_proof" MUST be an ARRAY of valid URLs (EXCLUDING techcrunch).

EXAMPLE OUTPUT:
{
  "companies": [
    {
      "company_name": "OpenAI",
      "founder_name": "Sam Altman",
      "marketing_manager_name": "Not specified",
      "email": "Not specified",
      "date_founded": "2015",
      "funding_total": "$11B+",
      "latest_funding": "$6.6B led by Thrive Capital, Oct 2024",
      "source_of_proof": ["https://www.bloomberg.com/news/articles/2024-10-02/openai-funding-round", "https://news.crunchbase.com/ai/openai-funding/"]
    }
  ],
  "total_companies_found": 3,
  "pipeline_status": "Human Intelligence Scan"
}
Return ONLY JSON.
`


    try {
      console.log('🚀 [Scout Engine] Starting Scan for:', searchQuery)
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
          // Check ALL possible field name variants the agent might use
          const fName: string = (
            c.founder_name || 
            c.founder || 
            c.ceo_name || 
            c.ceo || 
            c.founder_ceo ||
            c.founders ||
            ''
          ).trim()

          const mName: string = (
            c.marketing_manager_name || 
            c.marketing_manager ||
            c.head_of_marketing ||
            c.growth_lead ||
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
          let m_linkedin = c.marketing_community_manager_linkedin

          // Always try to resolve founder — even if name is empty, the server route will try
          if (!isValidLinkedIn(f_linkedin || '')) {
            const nameToSearch = c.founder_name && c.founder_name !== 'Not specified' ? c.founder_name : ''
            console.log(`🔎 [Scout Engine] Resolving Founder for "${c.company_name}" with name: "${nameToSearch || 'UNKNOWN'}"`)
            f_linkedin = await findLinkedInWithApify(nameToSearch, c.company_name || '')
          }

          if (!isValidLinkedIn(m_linkedin || '') && c.marketing_manager_name && c.marketing_manager_name !== 'Not specified') {
            console.log(`🔎 [Scout Engine] Resolving Marketing for "${c.company_name}": "${c.marketing_manager_name}"`)
            m_linkedin = await findLinkedInWithApify(c.marketing_manager_name, c.company_name || '')
          }

          return {
            ...c,
            founder_linkedin: f_linkedin,
            marketing_community_manager_linkedin: m_linkedin
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
        const toStore = highIntegrityCompanies.length > 0 ? highIntegrityCompanies : extracted
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

  const handleToggleSample = useCallback((v: boolean) => {
    setShowSample(v)
    if (!v && companies.length === 0) {
      setExportStatus({ type: null, message: '' })
    }
  }, [companies.length])

  return (
    <ErrorBoundary>
      <div style={THEME_VARS} className="min-h-screen bg-background text-foreground font-sans">
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          isLoading={isLoading}
          showSample={showSample}
          setShowSample={handleToggleSample}
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
            <h4 className="font-serif text-lg font-bold text-foreground tracking-wide mb-3">Powered by AI Agents</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeAgentId === COORDINATOR_AGENT_ID ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Funding Intelligence Coordinator</p>
                  <p className="text-xs text-muted-foreground">Orchestrates research, extraction, and enrichment pipeline</p>
                </div>
                {activeAgentId === COORDINATOR_AGENT_ID && <Badge variant="secondary" className="text-xs flex-shrink-0">Active</Badge>}
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-muted-foreground/40" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Google Cloud API</p>
                  <p className="text-xs text-muted-foreground">Direct integration for production-grade Sheets export</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
