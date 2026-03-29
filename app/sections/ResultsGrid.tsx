'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FaFire, FaExternalLinkAlt, FaLinkedin, FaEnvelope, FaChevronDown, FaChevronUp } from 'react-icons/fa'

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
  category_tag?: string
  why_this_matters?: string
  trending_flag?: boolean
  similar_companies?: string[]
}

interface ResultsGridProps {
  companies: Company[]
  totalFound: number
  pipelineStatus: string
}

function getScoreColor(score: number): string {
  if (score >= 7) return 'bg-primary text-primary-foreground shadow-md shadow-primary/30'
  if (score >= 4) return 'bg-accent text-accent-foreground'
  return 'bg-muted text-muted-foreground'
}

function CompanyCard({ company }: { company: Company }) {
  const [expanded, setExpanded] = useState(false)
  const score = company?.funding_score ?? 0

  return (
    <Card className="bg-card border border-border rounded-lg hover:shadow-md transition-all duration-200 overflow-hidden">
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
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${getScoreColor(score)}`}>
            {score}
          </div>
        </div>
        {company?.category_tag && (
          <Badge variant="secondary" className="w-fit mt-1 text-xs tracking-wide">
            {company.category_tag}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
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

        {/* Why This Matters */}
        {company?.why_this_matters && (
          <div className="bg-secondary/50 rounded-lg p-3">
            <p className="text-sm italic text-muted-foreground leading-relaxed">
              {company.why_this_matters}
            </p>
          </div>
        )}

        {/* Similar Companies */}
        {Array.isArray(company?.similar_companies) && company.similar_companies.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground tracking-wide uppercase mb-1.5">Similar Companies</p>
            <div className="flex flex-wrap gap-1.5">
              {company.similar_companies.map((name, idx) => (
                <Badge key={idx} variant="outline" className="text-xs border-border text-foreground">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Source Link */}
        {company?.source_of_proof && (
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
            {company?.founder_linkedin && (
              <a href={company.founder_linkedin.startsWith('http') ? company.founder_linkedin : `https://${company.founder_linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200">
                <FaLinkedin className="w-4 h-4 text-blue-600" />
                <span className="truncate">Founder LinkedIn</span>
              </a>
            )}
            {company?.email && (
              <a href={`mailto:${company.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200">
                <FaEnvelope className="w-4 h-4" />
                <span className="truncate">{company.email}</span>
              </a>
            )}
            {company?.marketing_community_manager_linkedin && (
              <a href={company.marketing_community_manager_linkedin.startsWith('http') ? company.marketing_community_manager_linkedin : `https://${company.marketing_community_manager_linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200">
                <FaLinkedin className="w-4 h-4 text-blue-600" />
                <span className="truncate">Marketing Manager LinkedIn</span>
              </a>
            )}
            {company?.marketing_community_manager_email && (
              <a href={`mailto:${company.marketing_community_manager_email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors duration-200">
                <FaEnvelope className="w-4 h-4" />
                <span className="truncate">{company.marketing_community_manager_email}</span>
              </a>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}

export default function ResultsGrid({ companies, totalFound, pipelineStatus }: ResultsGridProps) {
  if (!Array.isArray(companies) || companies.length === 0) return null

  return (
    <div className="max-w-5xl mx-auto px-6 pb-32">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-serif text-2xl font-bold text-foreground tracking-wide">Results</h3>
          <p className="text-sm text-muted-foreground">
            {totalFound > 0 ? `${totalFound} companies found` : `${companies.length} companies`}
            {pipelineStatus ? ` \u2014 ${pipelineStatus}` : ''}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {companies.map((company, idx) => (
          <CompanyCard key={`${company?.company_name ?? ''}-${idx}`} company={company} />
        ))}
      </div>
    </div>
  )
}
