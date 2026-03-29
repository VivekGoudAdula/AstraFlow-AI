'use client'

import React, { useState, useCallback } from 'react'
import { callAIAgent } from '@/lib/aiAgent'
import type { AIAgentResponse } from '@/lib/aiAgent'
import Header from './sections/Header'
import LoadingState from './sections/LoadingState'
import ResultsGrid from './sections/ResultsGrid'
import type { Company } from './sections/ResultsGrid'
import { Badge } from '@/components/ui/badge'

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
const SHEETS_AGENT_ID = '69c8e2a7a3afbe7693b0e0dd'

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
    marketing_community_manager_linkedin: 'https://linkedin.com/in/windsurf-cm',
    marketing_community_manager_email: 'community@windsurf.ai',
    funding_score: 8,
    category_tag: 'AI Code Editor',
    why_this_matters: 'Building the next generation of AI-native code editors with deep context understanding and multi-file reasoning capabilities.',
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
    category_tag: 'LLM Framework',
    why_this_matters: 'The dominant framework for building LLM-powered applications with chains, agents, and retrieval patterns.',
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
    marketing_community_manager_email: 'community@neon.tech',
    funding_score: 7,
    category_tag: 'Serverless Database',
    why_this_matters: 'Serverless Postgres with branching, autoscaling, and bottomless storage. Key infrastructure for AI app builders.',
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
    category_tag: 'Cloud Compute',
    why_this_matters: 'Cloud compute platform purpose-built for AI/ML workloads. Makes running GPU jobs and deploying models trivial.',
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

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportStatus, setExportStatus] = useState<{ type: 'success' | 'error' | null; message: string; url?: string }>({ type: null, message: '' })

  const displayCompanies = showSample && companies.length === 0 ? SAMPLE_COMPANIES : companies

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return
    setIsLoading(true)
    setError('')
    setCompanies([])
    setExportStatus({ type: null, message: '' })
    setLoadingStep('Researching market data...')
    setActiveAgentId(COORDINATOR_AGENT_ID)

    const stepTimer1 = setTimeout(() => setLoadingStep('Extracting company details...'), 8000)
    const stepTimer2 = setTimeout(() => setLoadingStep('Enriching funding profiles...'), 18000)

    try {
      const result = await callAIAgent(searchQuery, COORDINATOR_AGENT_ID)
      clearTimeout(stepTimer1)
      clearTimeout(stepTimer2)

      if (result.success) {
        const data = parseAgentResult(result)
        const extracted = extractCompanies(data)
        setCompanies(extracted)
        setTotalFound(data?.total_companies_found ?? extracted.length)
        setPipelineStatus(data?.pipeline_status ?? 'Complete')
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

  const handleExport = useCallback(async () => {
    const toExport = displayCompanies
    if (!Array.isArray(toExport) || toExport.length === 0) return

    setIsExporting(true)
    setExportStatus({ type: null, message: '' })
    setActiveAgentId(SHEETS_AGENT_ID)

    try {
      const dataMessage = `Export the following companies to Google Sheets:\n${JSON.stringify(toExport, null, 2)}`
      const result = await callAIAgent(dataMessage, SHEETS_AGENT_ID)

      if (result.success) {
        const data = parseAgentResult(result)
        const url = data?.spreadsheet_url ?? ''
        const rows = data?.rows_exported ?? toExport.length
        const status = data?.export_status ?? 'success'
        setExportStatus({
          type: 'success',
          message: `Exported ${rows} rows. Status: ${status}`,
          url: url || undefined,
        })
      } else {
        setExportStatus({ type: 'error', message: result?.error ?? 'Export failed. Please try again.' })
      }
    } catch (e) {
      setExportStatus({ type: 'error', message: e instanceof Error ? e.message : 'Export failed.' })
    } finally {
      setIsExporting(false)
      setActiveAgentId(null)
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

        {/* Results with inline Export button */}
        {!isLoading && displayCompanies.length > 0 && (
          <ResultsGrid
            companies={displayCompanies}
            totalFound={totalFound}
            pipelineStatus={pipelineStatus}
            onExport={handleExport}
            isExporting={isExporting}
            exportStatus={exportStatus}
          />
        )}

        {/* Agent Status Section */}
        <div className="max-w-5xl mx-auto px-6 pb-8" id="about">
          <div className="bg-card border border-border rounded-lg p-6 mb-24">
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
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${activeAgentId === SHEETS_AGENT_ID ? 'bg-green-500 animate-pulse' : 'bg-muted-foreground/40'}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">Sheets Export Agent</p>
                  <p className="text-xs text-muted-foreground">Exports company data to Google Sheets</p>
                </div>
                {activeAgentId === SHEETS_AGENT_ID && <Badge variant="secondary" className="text-xs flex-shrink-0">Active</Badge>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
