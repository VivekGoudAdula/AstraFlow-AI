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
import { Cpu, Database, Network, ShieldCheck, Sparkles, Zap, BrainCircuit, Globe } from 'lucide-react'

// --- Agent IDs ---
const COORDINATOR_AGENT_ID = '69c8e2962233a0528b6d6110'

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
      rawLinks = str.split(/[|,]/).map(s => s.trim()).filter(Boolean)
    }
  }

  return rawLinks
    .map(link => link.replace(/^["']+|["']+$/g, '')) 
    .filter(link => link.startsWith('http'))
    .slice(0, 3)
}

// --- Helper: LinkedIn & Email Discovery via server-side route ---
async function findLinkedInWithApify(name: string, company: string, role: string = 'founder'): Promise<{ profileUrl: string; email: string }> {
  if (!company || company.length < 2) return { profileUrl: 'Not specified', email: 'Not specified' }
  const cleanName = (name && name !== 'Not specified' && name.length >= 2) ? name : ''
  try {
    const res = await fetch('/api/linkedin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: cleanName, company, role }),
    })
    const data = await res.json()
    
    const profileUrl = (data?.profileUrl && data.profileUrl.includes('linkedin.com/in/')) ? data.profileUrl : 'Not specified'
    const email = (data?.email && data.email.includes('@')) ? data.email : 'Not specified'
    
    return { profileUrl, email }
  } catch (err) {
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
          <div className="text-center p-8 max-w-md glass-card rounded-3xl">
            <h2 className="text-2xl font-black mb-2 text-white">System Breach</h2>
            <p className="text-white/40 mb-6 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })} className="premium-button">
              Reboot Terminal
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
  for (const url of sourceUrls) {
    try {
      const hostname = new URL(url).hostname.replace('www.', '')
      const newsSites = ['techcrunch.com', 'bloomberg.com', 'venturebeat.com', 'crunchbase.com', 'prnewswire.com', 'globenewswire.com', 'news.crunchbase.com']
      if (!newsSites.includes(hostname)) return hostname
    } catch { /* skip */ }
  }
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

  const [qdrantSimilar, setQdrantSimilar] = useState<Record<string, SimilarCompanyFromQdrant[]>>({})
  const [qdrantStatus, setQdrantStatus] = useState<string>('')

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
    setLoadingStep('Initializing neural search...')
    setActiveAgentId(COORDINATOR_AGENT_ID)

    const stepTimer1 = setTimeout(() => setLoadingStep('Extracting entity parameters...'), 8000)
    const stepTimer2 = setTimeout(() => setLoadingStep('Resolving professional vectors...'), 18000)

    try {
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
        }
      } catch (err) {
        console.error('⚠️ Search failed:', err)
      }

      setLoadingStep('Infiltrating market source streams...')

    const promptInstructions = `
Identify recently funded AI companies for: "${searchQuery}".
Return ONLY high-quality results with LIVE, VERIFIED links.

SOURCE OF PROOF RULE (STRICT):
- search_results: ${finalLinks}
- ONLY use links from the "search_results" list provided above.
- DO NOT generate, modify, or combine URLs.
- Pick 1–3 most relevant links for each company.
- If no valid link exists → return "Not specified".
- Output links as a clean string separated by " | ".

EMAIL RULE (UPDATED):
- If a direct email is found in sources → use it.
- If NOT found:
    → derive company domain (e.g., laminar.ai)
    → generate a SAFE public email using: contact@domain OR hello@domain OR info@domain

STRICT HUMAN-CENTRIC EXTRACTION (MANDATORY)
1. FOUNDER IDENTITY: You MUST identify the REAL FULL NAME of the Founder/CEO.
2. NO GUESSING: DO NOT generate LinkedIn URLs. ONLY return the REAL Names.
3. "source_of_proof": MUST be the clean string from search inputs.
Return ONLY JSON.
`

      const result = await callAIAgent(promptInstructions, COORDINATOR_AGENT_ID)
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)

      if (result.success) {
        const data = parseAgentResult(result)
        let extracted = extractCompanies(data)
        
        extracted = extracted.map(c => {
          const raw = c as any
          const fName: string = (raw.founder_name || raw.founder || raw.ceo_name || raw.ceo || '').trim()
          const mName: string = (raw.marketing_manager_name || raw.marketing_manager || '').trim()
          const cleanName = (n: string) => (!n || n.toLowerCase() === 'not specified') ? '' : n
          return { ...c, founder_name: cleanName(fName), marketing_manager_name: cleanName(mName) }
        })

        extracted = extracted.map(c => ({
          ...c,
          founder_linkedin: isValidLinkedIn(c.founder_linkedin || '') ? c.founder_linkedin : 'Not specified',
          funding_total: normalizeFunding(c.funding_total || ''),
          email: (c.email && c.email.includes('@')) ? c.email : 'Not specified',
          source_of_proof: fixSourceUrls(c.source_of_proof) 
        }))

        setLoadingStep('Resolving synaptic profiles...')
        const enriched: Company[] = await Promise.all(extracted.map(async (c: Company) => {
          let f_linkedin = c.founder_linkedin
          let f_email = c.email

          if (!isValidLinkedIn(f_linkedin || '')) {
            const discovery = await findLinkedInWithApify(c.founder_name || '', c.company_name || '')
            f_linkedin = discovery.profileUrl
            if (discovery.email !== 'Not specified') f_email = discovery.email
          }

          if (!f_email || f_email === 'Not specified') {
            f_email = generateFallbackEmail(c.company_name || '', c.source_of_proof || [])
          }

          return { ...c, founder_linkedin: f_linkedin, email: f_email }
        }))

        const highIntegrityCompanies = enriched.filter(c => !!c.company_name && c.company_name !== 'Not specified' && !!c.source_of_proof?.length)
        setCompanies(highIntegrityCompanies.length > 0 ? highIntegrityCompanies : enriched)
        setTotalFound(highIntegrityCompanies.length)
        setPipelineStatus(data?.pipeline_status ?? 'Neural Link Stabilized')

        if (enriched.length > 0) {
          setLoadingStep('Syncing with vector memory...')
          try {
            const qdrantResult = await storeAndFindSimilar(enriched.map(c => ({
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
            })))
            setQdrantSimilar(qdrantResult)
            setQdrantStatus('connected')
          } catch {
            setQdrantStatus('unavailable')
          }
        }
      } else {
        setError(result?.error ?? 'Neural scan failed.')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred.')
    } finally {
      setIsLoading(false)
      setActiveAgentId(null)
    }
  }, [searchQuery])

  const handleDownloadCSV = useCallback(async () => {
    if (displayCompanies.length === 0) return
    setIsExporting(true)
    try {
      const res = await fetch('/api/export-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: displayCompanies, mode: 'csv' }),
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
      }
    } catch (e) {
      toast.error('CSV export failed')
    } finally {
      setIsExporting(false)
    }
  }, [displayCompanies])

  const handleExportToSheets = useCallback(async () => {
    if (displayCompanies.length === 0) return
    setIsExporting(true)
    const toastId = toast.loading('Synchronizing Cloud Sheets...')
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companies: displayCompanies }),
      })
      const data = await res.json()
      if (data.success && data.url) {
        setExportStatus({ type: 'success', message: 'Cloud synchronization complete', url: data.url })
        toast.success('Sheets updated', { id: toastId })
        window.open(data.url, "_blank")
      } else {
        toast.error('Sync failed', { id: toastId })
      }
    } catch (e) {
      toast.error('Export errored', { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }, [displayCompanies])

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 mesh-gradient">
        <Header
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={handleSearch}
          isLoading={isLoading}
        />

        {/* Status Indicators */}
        {error && (
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="glass-card border-destructive/20 p-6 flex items-center justify-between rounded-3xl">
              <p className="text-sm text-destructive font-bold uppercase tracking-widest">{error}</p>
              <button onClick={handleSearch} className="premium-button bg-destructive/10 text-destructive border-destructive/20 h-10 px-4">
                RETRY
              </button>
            </div>
          </div>
        )}

        {/* Main Content Flow */}
        <div className="relative z-10 transition-all duration-500">
          {isLoading ? (
            <LoadingState loadingStep={loadingStep} />
          ) : displayCompanies.length === 0 && !error ? (
            <div className="max-w-xl mx-auto px-6 py-24 text-center">
              <div className="glass-card border-white/5 p-12 rounded-[3rem] group">
                <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-8 border border-white/10 group-hover:scale-110 transition-transform">
                   <BrainCircuit className="w-10 h-10 text-primary animate-pulse" />
                </div>
                <h3 className="text-3xl font-black text-white mb-4 tracking-tighter">TERMINAL READY</h3>
                <p className="text-white/40 text-sm leading-relaxed max-w-sm mx-auto font-medium">
                  Input a market niche to activate the <span className="text-primary">Intelligence Extraction Pipeline</span>. Current systems: Qdrant, Apify, Google Search.
                </p>
              </div>
            </div>
          ) : (
            <>
              <MarketPatterns companies={displayCompanies} />
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
            </>
          )}
        </div>

        {/* Global Agent Control Panel */}
        <div className="max-w-7xl mx-auto px-6 pb-20 mt-12" id="about">
          <div className="glass-card border-white/5 rounded-[3rem] p-10 overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
               <div>
                 <h4 className="text-2xl font-black text-white tracking-tighter uppercase mb-1">Agent <span className="text-primary italic">Status</span></h4>
                 <p className="text-white/30 text-xs font-bold tracking-widest">REAL-TIME SYSTEM MONITORING</p>
               </div>
               <div className="flex gap-2">
                 <Badge variant="outline" className="rounded-full border-green-500/20 bg-green-500/5 text-green-500 gap-2 px-4 py-1.5 font-bold uppercase text-[10px]">
                   <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" /> Global Hub Active
                 </Badge>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { 
                  name: 'Intelligence Coordinator', 
                  desc: 'Pipeline orchestration & neural logic', 
                  icon: Sparkles, 
                  active: activeAgentId === COORDINATOR_AGENT_ID,
                  color: 'text-primary'
                },
                { 
                  name: 'Apify Discovery', 
                  desc: 'Real-time social profile verification', 
                  icon: Globe, 
                  active: loadingStep.includes('Resolving') && isLoading,
                  color: 'text-accent'
                },
                { 
                  name: 'Qdrant Persistence', 
                  desc: 'Vector memory & semantic mapping', 
                  icon: Database, 
                  active: loadingStep.includes('Syncing') && isLoading,
                  color: 'text-purple-400'
                },
                { 
                  name: 'Cloud Infrastructure', 
                  desc: 'Production-grade sheets integration', 
                  icon: ShieldCheck, 
                  active: isExporting,
                  color: 'text-orange-400'
                }
              ].map((agent, i) => (
                <div key={i} className={`p-6 rounded-[2rem] border transition-all duration-300 ${agent.active ? 'bg-white/10 border-white/20' : 'bg-white/5 border-transparent'}`}>
                  <div className={`w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/10 ${agent.active ? agent.color : 'text-white/20'}`}>
                    <agent.icon className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-black text-white mb-2 uppercase tracking-tight">{agent.name}</p>
                  <p className="text-[11px] text-white/30 font-medium leading-relaxed">{agent.desc}</p>
                  {agent.active && (
                    <div className="mt-4 flex items-center gap-2">
                      <span className="text-[8px] font-black uppercase text-primary animate-pulse">Processing Block...</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
