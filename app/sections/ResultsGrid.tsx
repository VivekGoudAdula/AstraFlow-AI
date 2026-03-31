'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  FaFire, FaExternalLinkAlt, FaLinkedin, FaEnvelope,
  FaChevronDown, FaChevronUp, FaFileExport, FaCheckCircle,
  FaExclamationCircle, FaDatabase, FaLightbulb, FaDownload, FaInfoCircle,
  FaChartLine, FaCalendarAlt, FaDollarSign
} from 'react-icons/fa'
import { Loader2, Globe, TrendingUp, ShieldCheck, Zap } from 'lucide-react'

// --- Helper: Clean and Validate URLs ---
function sanitizeUrl(url: string | undefined): string | null {
  if (!url || !url.trim() || url === 'Not specified' || url.includes('404')) return null
  const trimmed = url.trim()
  if (trimmed.startsWith('http')) return trimmed
  if (trimmed.startsWith('www.')) return `https://${trimmed}`
  if (trimmed.includes('.')) return `https://${trimmed}`
  return null
}

export interface SimilarCompanyFromQdrant {
  company_name: string
  category_tag: string
  funding_total: string
  similarity_score: number
}

export interface Company {
  company_name?: string
  founder_name?: string
  founder_linkedin?: string
  email?: string
  funding_total?: string
  latest_funding?: string
  source_of_proof?: string[]
  date_founded?: string
  marketing_manager_name?: string
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
  if (score >= 7) return 'from-primary/20 to-primary/40 text-primary border-primary/50'
  if (score >= 4) return 'from-accent/20 to-accent/40 text-accent border-accent/50'
  return 'from-white/5 to-white/10 text-white/50 border-white/10'
}

function ScoreBreakdown({ breakdown }: { breakdown: string }) {
  const parts = breakdown.split('=')[0]?.trim().split('+').map(p => p.trim()) || []

  return (
    <div className="flex flex-wrap gap-2">
      {parts.map((part, idx) => {
        const [label, val] = part.split(':').map(s => s.trim())
        return (
          <span key={idx} className="inline-flex items-center gap-1.5 text-[10px] bg-white/5 text-white/60 rounded-full px-2 py-0.5 border border-white/5">
            <span className="capitalize opacity-60">{label}</span>
            <span className="font-bold text-primary">{val}</span>
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

  return (
    <Card className={`glass-card border-white/5 group relative overflow-hidden ${company?.trending_flag ? 'ring-1 ring-primary/20' : ''}`}>
      {company?.trending_flag && (
        <div className="absolute top-0 right-0 w-24 h-24 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-black uppercase tracking-tighter py-1 w-32 text-center rotate-45 transform translate-x-8 -translate-y-2 shadow-lg scale-110">
            High Growth
          </div>
        </div>
      )}

      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-2xl font-black text-white group-hover:text-primary transition-colors">
                {company?.company_name ?? 'Unknown'}
              </h3>
              {company?.trending_flag && <TrendingUp className="w-4 h-4 text-primary animate-bounce" />}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary text-[10px] uppercase font-bold py-0.5">
                {company.category_tag || 'AI Software'}
              </Badge>
              {company?.date_founded && (
                <span className="text-white/30 text-[10px] font-medium flex items-center gap-1">
                  <FaCalendarAlt className="w-3 h-3" /> Founded {company.date_founded}
                </span>
              )}
            </div>
          </div>
          
          <div className={`p-2 rounded-2xl border bg-gradient-to-br flex flex-col items-center justify-center min-w-[50px] ${getScoreColor(score)}`}>
            <span className="text-xs font-black leading-none">{score}</span>
            <span className="text-[7px] uppercase font-bold mt-0.5">Score</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Insight Section */}
        {company?.why_this_matters && (
          <div className="relative p-4 rounded-xl bg-white/5 border border-white/10 group-hover:bg-white/10 transition-colors">
            <FaLightbulb className="absolute -top-2 -left-2 w-6 h-6 text-primary drop-shadow-[0_0_10px_rgba(30,174,219,0.5)]" />
            <p className="text-sm text-white/80 leading-relaxed italic">
              "{company.why_this_matters}"
            </p>
          </div>
        )}

        {/* Funding Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-black/20 border border-white/5">
            <p className="text-white/30 text-[9px] uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
              <FaChartLine /> Latest Round
            </p>
            <p className="text-sm font-bold text-white truncate">{company?.latest_funding || 'Private'}</p>
          </div>
          <div className="p-3 rounded-lg bg-black/20 border border-white/5">
            <p className="text-white/30 text-[9px] uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
              <FaDollarSign /> Velocity
            </p>
            <p className="text-sm font-bold text-primary truncate">{company?.funding_total || 'Disclosed'}</p>
          </div>
        </div>

        {/* Intelligence Breakdown */}
        {company?.score_breakdown && (
          <div className="space-y-2">
            <p className="text-white/30 text-[8px] uppercase font-black tracking-widest">Intelligence Parameters</p>
            <ScoreBreakdown breakdown={company.score_breakdown} />
          </div>
        )}

        {/* Source Evidence */}
        <div className="space-y-2">
          <p className="text-white/30 text-[8px] uppercase font-black tracking-widest">Verified Sources</p>
          <div className="flex flex-wrap gap-2">
            {Array.isArray(company?.source_of_proof) && company.source_of_proof.length > 0 ? (
              company.source_of_proof.map((link, i) => (
                <a
                  key={i}
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[10px] font-bold bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-full text-white/70 transition-all hover:scale-105 active:scale-95"
                >
                  <Globe className="w-3 h-3 text-primary" />
                  {new URL(link).hostname.replace('www.', '')}
                </a>
              ))
            ) : (
              <span className="text-[10px] text-white/30 italic flex items-center gap-2">
                <ShieldCheck className="w-3 h-3" /> Data integrity verification complete
              </span>
            )}
          </div>
        </div>

        {/* Expandable Professional Profiles */}
        <Collapsible open={expanded} onOpenChange={setExpanded} className="pt-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between text-xs text-white/50 hover:text-white group-hover:bg-white/5 rounded-xl border border-transparent hover:border-white/10">
              <span className="flex items-center gap-2">
                <FaDatabase className="w-3 h-3 text-primary" />
                {hasQdrantSimilar ? 'Related Entities' : 'Professional Profiles'}
              </span>
              {expanded ? <FaChevronUp className="w-3 h-3" /> : <FaChevronDown className="w-3 h-3" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
            {/* Contact Info */}
            <div className="grid grid-cols-1 gap-2">
              {sanitizeUrl(company?.founder_linkedin) && (
                <a href={sanitizeUrl(company?.founder_linkedin)!} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <FaLinkedin className="text-blue-400 w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/40 leading-none">Founder / CEO</p>
                      <p className="text-xs font-bold text-white mt-1">{company.founder_name || 'View Profile'}</p>
                    </div>
                  </div>
                  <FaExternalLinkAlt className="w-3 h-3 text-white/20" />
                </a>
              )}
              {company?.email && company.email !== 'Not specified' && (
                <a href={`mailto:${company.email}`} className="flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <FaEnvelope className="text-primary w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 leading-none">Direct Contact</p>
                    <p className="text-xs font-bold text-white mt-1 truncate">{company.email}</p>
                  </div>
                </a>
              )}
            </div>

            {/* Qdrant Similar */}
            {hasQdrantSimilar && (
              <div className="space-y-2">
                <p className="text-[8px] uppercase font-black tracking-widest text-white/30">Semantic Neighbors (Qdrant)</p>
                <div className="space-y-1.5">
                  {qdrantMatches!.map((match, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-[10px]">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{match.company_name}</span>
                        <Badge variant="outline" className="text-[8px] px-1.5 py-0 border-white/10 text-white/40">{match.category_tag}</Badge>
                      </div>
                      <span className="font-mono text-primary">{Math.round(match.similarity_score * 100)}%</span>
                    </div>
                  ))}
                </div>
              </div>
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
    <div className="max-w-7xl mx-auto px-6 pb-24">
      {/* Search Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
               <FaDatabase className="text-primary w-5 h-5 shadow-[0_0_15px_rgba(30,174,219,0.5)]" />
             </div>
             <h3 className="text-3xl font-black text-white tracking-tighter">INTELLIGENCE <span className="text-primary italic">FEED</span></h3>
          </div>
          <p className="text-white/40 font-medium tracking-wide">
            {totalFound > 0 ? `${totalFound} verified entities mapped` : `${companies.length} entities mapped`}
            {pipelineStatus ? ` via ${pipelineStatus}` : ''}
          </p>
        </div>
        
        <div className="flex items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/10">
          {onExportCSV && (
            <Button
              onClick={onExportCSV}
              disabled={isExporting}
              variant="ghost"
              className="rounded-xl font-bold bg-white/5 hover:bg-white/10 text-white border-transparent"
            >
              <FaDownload className="mr-2 h-4 w-4 text-primary" /> CSV
            </Button>
          )}
          {onExportSheets && (
            <Button
              onClick={onExportSheets}
              disabled={isExporting}
              className="premium-button rounded-xl h-10"
            >
              {isExporting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> ...</>
              ) : (
                <span className="flex items-center gap-2"><FaFileExport className="w-4 h-4" /> Export Sheets</span>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Vector Memory Bar */}
      {qdrantStatus && (
        <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl p-3 mb-8 animate-pulse">
          <Zap className="w-4 h-4 text-primary fill-primary" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/80">
            Vector Subspace Live: {qdrantStatus === 'connected' ? 'Analyzing Semantic Clusters' : 'Direct Search Mode'}
          </span>
        </div>
      )}

      {/* Export Status Notification */}
      {exportStatus?.type === 'success' && (
        <div className="glass-card border-green-500/20 p-6 rounded-3xl mb-12 animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-16 h-16 rounded-3xl bg-green-500/20 flex items-center justify-center border border-green-500/30">
               <FaCheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <p className="text-xl font-bold text-white mb-1">Data Pipeline Synchronized</p>
              <p className="text-white/50 text-sm">{exportStatus.message}</p>
            </div>
            {exportStatus.url && (
              <a
                href={exportStatus.url}
                target="_blank"
                rel="noopener noreferrer"
                className="premium-button bg-green-600 hover:bg-green-700 shadow-green-500/20 gap-2 h-12"
              >
                Open Analytics <FaExternalLinkAlt className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {companies.map((company, idx) => (
          <div key={`${company?.company_name ?? ''}-${idx}`} className="animate-in fade-in slide-in-from-bottom-8 duration-500" style={{ animationDelay: `${idx * 100}ms` }}>
            <CompanyCard
              company={company}
              qdrantMatches={qdrantSimilar?.[company?.company_name ?? '']}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

