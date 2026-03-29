'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  FaFire, FaExternalLinkAlt, FaLinkedin, FaEnvelope,
  FaChevronDown, FaChevronUp, FaFileExport, FaCheckCircle,
  FaExclamationCircle, FaDatabase, FaLightbulb, FaDownload
} from 'react-icons/fa'
import { Loader2 } from 'lucide-react'

export interface SimilarCompanyFromQdrant {
  company_name: string
  category_tag: string
  funding_total: string
  similarity_score: number
}

export interface Company {
  company_name?: string
  founder_linkedin?: string
  email?: string
  funding_total?: string
  latest_funding?: string
  source_of_proof?: string
  date_founded?: string
  marketing_community_manager_linkedin?: string
  marketing_community_manager_email?: string
  funding_score?: number
  score_breakdown?: string
  category_tag?: string
  why_this_matters?: string
  trending_flag?: boolean
  similar_companies?: string[]
}

interface ResultsGridProps {
  companies: Company[]
  totalFound: number
  pipelineStatus: string
  onExportCSV?: () => void
  onExportSheets?: () => void
  isExporting?: boolean
  exportStatus?: { type: 'success' | 'error' | null; message: string; url?: string }
  qdrantSimilar?: Record<string, SimilarCompanyFromQdrant[]>
  qdrantStatus?: string
}

function getScoreColor(score: number): string {
  if (score >= 7) return 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
  if (score >= 4) return 'bg-accent text-accent-foreground'
  return 'bg-muted text-muted-foreground'
}

function getScoreLabel(score: number): string {
  if (score >= 8) return 'Very High'
  if (score >= 6) return 'High'
  if (score >= 4) return 'Moderate'
  return 'Low'
}

function ScoreBreakdown({ breakdown }: { breakdown: string }) {
  // Parse "recency:3 + amount:3 + stage:2 = 8"
  const parts = breakdown.split('=')[0]?.trim().split('+').map(p => p.trim()) || []

  return (
    <div className="flex flex-wrap gap-1.5">
      {parts.map((part, idx) => {
        const [label, val] = part.split(':').map(s => s.trim())
        return (
          <span key={idx} className="inline-flex items-center gap-1 text-xs bg-muted/60 text-muted-foreground rounded px-1.5 py-0.5">
            <span className="capitalize">{label}</span>
            <span className="font-bold text-foreground">{val}</span>
          </span>
        )
      })}
    </div>
  )
}

function CompanyCard({ company, qdrantMatches }: { company: Company; qdrantMatches?: SimilarCompanyFromQdrant[] }) {
  const [expanded, setExpanded] = useState(false)
  const score = company?.funding_score ?? 0
  const hasQdrantSimilar = Array.isArray(qdrantMatches) && qdrantMatches.length > 0
  const hasAgentSimilar = Array.isArray(company?.similar_companies) && company.similar_companies.length > 0

  return (
    <Card className={`bg-card border rounded-lg hover:shadow-md transition-all duration-200 overflow-hidden ${company?.trending_flag ? 'border-accent/40 shadow-sm shadow-accent/10' : 'border-border'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h3 className="font-serif text-xl font-bold text-foreground tracking-wide truncate">
              {company?.company_name ?? 'Unknown Company'}
            </h3>
            {company?.trending_flag && (
              <FaFire className="w-4 h-4 text-orange-500 flex-shrink-0" title="Trending" />
            )}
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${getScoreColor(score)}`}>
              {score}
            </div>
            <span className="text-[10px] text-muted-foreground tracking-wide">{getScoreLabel(score)}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {company?.category_tag && (
            <Badge variant="secondary" className="text-xs tracking-wide">
              {company.category_tag}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Score Breakdown */}
        {company?.score_breakdown && (
          <div>
            <p className="text-xs text-muted-foreground tracking-wide uppercase mb-1.5">Score Breakdown</p>
            <ScoreBreakdown breakdown={company.score_breakdown} />
          </div>
        )}

        {/* Funding Details Row */}
        <div className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase mb-0.5">Total Funding</p>
            <p className="font-semibold text-foreground">{company?.funding_total ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase mb-0.5">Latest Round</p>
            <p className="font-semibold text-foreground">{company?.latest_funding ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs tracking-wide uppercase mb-0.5">Founded</p>
            <p className="font-semibold text-foreground">{company?.date_founded ?? 'N/A'}</p>
          </div>
        </div>

        {/* Why This Matters — Structured Insight */}
        {company?.why_this_matters && (
          <div className="bg-secondary/50 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <FaLightbulb className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground tracking-wide uppercase mb-1">Intelligence Insight</p>
                <p className="text-sm text-foreground leading-relaxed">
                  {company.why_this_matters}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Qdrant Vector Similar Companies */}
        {hasQdrantSimilar && (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <FaDatabase className="w-3 h-3 text-accent" />
              <p className="text-xs text-muted-foreground tracking-wide uppercase">Similar Companies (Vector Memory)</p>
            </div>
            <div className="space-y-1.5">
              {qdrantMatches!.map((match, idx) => (
                <div key={idx} className="flex items-center justify-between bg-muted/30 rounded px-2.5 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-foreground truncate">{match.company_name}</span>
                    {match.category_tag && (
                      <Badge variant="outline" className="text-[10px] border-border shrink-0">{match.category_tag}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {match.funding_total && (
                      <span className="text-xs text-muted-foreground">{match.funding_total}</span>
                    )}
                    <span className="text-[10px] bg-accent/15 text-accent rounded px-1.5 py-0.5 font-mono">
                      {Math.round(match.similarity_score * 100)}% match
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fallback: Agent-suggested similar companies (if Qdrant unavailable) */}
        {!hasQdrantSimilar && hasAgentSimilar && (
          <div>
            <p className="text-xs text-muted-foreground tracking-wide uppercase mb-1.5">Related Companies</p>
            <div className="flex flex-wrap gap-1.5">
              {company.similar_companies!.map((name, idx) => (
                <Badge key={idx} variant="outline" className="text-xs border-border text-foreground">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Source Link */}
        {company?.source_of_proof && company.source_of_proof !== 'Not specified' && (
          <a
            href={company.source_of_proof.startsWith('http') ? company.source_of_proof : `https://${company.source_of_proof}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent/80 underline underline-offset-2 transition-colors duration-200"
          >
            <FaExternalLinkAlt className="w-3 h-3" />
            Source
          </a>
        )}

        {/* Expandable Contact Info */}
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer">
            {expanded ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
            <span>Contact Details</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3 space-y-2 text-sm">
            {company?.founder_linkedin && company.founder_linkedin !== 'Not specified' && (
              <a href={company.founder_linkedin.startsWith('http') ? company.founder_linkedin : `https://${company.founder_linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200">
                <FaLinkedin className="w-4 h-4 text-blue-600" />
                <span className="truncate">Founder LinkedIn</span>
              </a>
            )}
            {company?.email && company.email !== 'Not specified' && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200">
                <FaEnvelope className="w-4 h-4" />
                <span className="truncate">{company.email}</span>
              </a>
            )}
            {company?.marketing_community_manager_linkedin && company.marketing_community_manager_linkedin !== 'Not specified' && (
              <a href={company.marketing_community_manager_linkedin.startsWith('http') ? company.marketing_community_manager_linkedin : `https://${company.marketing_community_manager_linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200">
                <FaLinkedin className="w-4 h-4 text-blue-600" />
                <span className="truncate">Marketing Manager LinkedIn</span>
              </a>
            )}
            {company?.marketing_community_manager_email && company.marketing_community_manager_email !== 'Not specified' && (
              <a href={`mailto:${company.marketing_community_manager_email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200">
                <FaEnvelope className="w-4 h-4" />
                <span className="truncate">{company.marketing_community_manager_email}</span>
              </a>
            )}
            {/* Show message if all contact fields are "Not specified" */}
            {(!company?.founder_linkedin || company.founder_linkedin === 'Not specified') &&
             (!company?.email || company.email === 'Not specified') &&
             (!company?.marketing_community_manager_linkedin || company.marketing_community_manager_linkedin === 'Not specified') &&
             (!company?.marketing_community_manager_email || company.marketing_community_manager_email === 'Not specified') && (
              <p className="text-xs text-muted-foreground italic">No contact details available for this company.</p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

export default function ResultsGrid({
  companies, totalFound, pipelineStatus,
  onExportCSV, onExportSheets, isExporting, exportStatus,
  qdrantSimilar, qdrantStatus
}: ResultsGridProps) {
  if (!Array.isArray(companies) || companies.length === 0) return null

  return (
    <div className="max-w-5xl mx-auto px-6 pb-12">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-serif text-2xl font-bold text-foreground tracking-wide">Results</h3>
          <p className="text-sm text-muted-foreground">
            {totalFound > 0 ? `${totalFound} companies found` : `${companies.length} companies`}
            {pipelineStatus ? ` — ${pipelineStatus}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onExportCSV && (
            <Button
              onClick={onExportCSV}
              disabled={isExporting}
              variant="outline"
              className="rounded-lg font-medium tracking-wide transition-all duration-200 border-border"
            >
              {isExporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
              ) : (
                <><FaDownload className="mr-2 h-4 w-4" /> Download CSV</>
              )}
            </Button>
          )}
          {onExportSheets && (
            <Button
              onClick={onExportSheets}
              disabled={isExporting}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium tracking-wide transition-all duration-200"
            >
              {isExporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
              ) : (
                <><FaFileExport className="mr-2 h-4 w-4" /> Export to Sheets</>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Qdrant status indicator */}
      {qdrantStatus && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
          <FaDatabase className="w-3 h-3" />
          <span>
            Vector Memory: {qdrantStatus === 'connected'
              ? 'Connected — similar companies from Qdrant'
              : 'Offline — using category-based matching'}
          </span>
          <div className={`w-1.5 h-1.5 rounded-full ${qdrantStatus === 'connected' ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
        </div>
      )}

      {/* Export status message inline */}
      {exportStatus?.type === 'success' && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3 mb-6">
          <FaCheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{exportStatus.message}</span>
          {exportStatus.url && (
            <a href={exportStatus.url} target="_blank" rel="noopener noreferrer"
              className="text-accent font-semibold underline underline-offset-2 hover:text-accent/80 transition-colors duration-200 ml-1">
              Open Sheet
            </a>
          )}
        </div>
      )}
      {exportStatus?.type === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-6">
          <FaExclamationCircle className="w-4 h-4 flex-shrink-0" />
          <span>{exportStatus.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {companies.map((company, idx) => (
          <CompanyCard
            key={`${company?.company_name ?? ''}-${idx}`}
            company={company}
            qdrantMatches={qdrantSimilar?.[company?.company_name ?? '']}
          />
        ))}
      </div>
    </div>
  )
}
