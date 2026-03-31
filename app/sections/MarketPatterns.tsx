'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Company } from './ResultsGrid'
import { FaChartLine, FaArrowUp, FaLayerGroup, FaMeteor } from 'react-icons/fa'
import { Activity, BarChart3, Target, Zap } from 'lucide-react'

interface MarketPatternsProps {
  companies: Company[]
}

interface PatternInsight {
  label: string
  count: number
  total: number
  percentage: number
  description: string
}

export default function MarketPatterns({ companies }: MarketPatternsProps) {
  if (!Array.isArray(companies) || companies.length < 2) return null

  const patterns = useMemo(() => {
    const total = companies.length
    const insights: PatternInsight[] = []

    // 1. Category concentration analysis
    const categoryCounts: Record<string, number> = {}
    for (const c of companies) {
      const tag = c.category_tag || 'Unknown'
      categoryCounts[tag] = (categoryCounts[tag] || 0) + 1
    }

    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])
    if (sortedCategories.length > 0) {
      const [topCategory, topCount] = sortedCategories[0]
      if (topCount >= 2) {
        insights.push({
          label: topCategory,
          count: topCount,
          total,
          percentage: Math.round((topCount / total) * 100),
          description: `${topCount}/${total} focused on ${topCategory}`,
        })
      }
    }

    // 2. Trending concentration
    const trendingCount = companies.filter((c) => c.trending_flag).length
    if (total > 0) {
      insights.push({
        label: 'Trending Momentum',
        count: trendingCount,
        total,
        percentage: Math.round((trendingCount / total) * 100),
        description: `${trendingCount}/${total} assets showing high velocity`,
      })
    }

    // 3. High-score concentration
    const highScoreCount = companies.filter((c) => (c.funding_score ?? 0) >= 7).length
    if (total > 0) {
      insights.push({
        label: 'Institutional Grade',
        count: highScoreCount,
        total,
        percentage: Math.round((highScoreCount / total) * 100),
        description: `${highScoreCount}/${total} pass institutional threshold`,
      })
    }

    // 4. Average funding score
    const avgScore =
      companies.reduce((sum, c) => sum + (c.funding_score ?? 0), 0) / total
    const roundedAvg = Math.round(avgScore * 10) / 10

    return { insights, sortedCategories, avgScore: roundedAvg, trendingCount }
  }, [companies])

  if (patterns.insights.length === 0) return null

  return (
    <div className="max-w-7xl mx-auto px-6 pb-12">
      <Card className="glass-card border-primary/20 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Activity className="w-32 h-32 text-primary" />
        </div>
        
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/30">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-white tracking-tight uppercase">
                MARKET <span className="text-primary italic">SIGNALS</span>
              </h3>
              <p className="text-white/40 text-xs font-medium tracking-wide">
                SYNTACTIC PATTERN RECOGNITION ACROSS {companies.length} ENTITIES
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Pattern Bars */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              {patterns.insights.map((insight, idx) => (
                <div key={idx} className="space-y-2 group">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-[0.1em] group-hover:text-primary transition-colors">
                      {insight.label}
                    </span>
                    <span className="text-xs font-black text-primary">{insight.percentage}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="bg-gradient-to-r from-primary to-accent h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_hsla(var(--primary),0.5)]"
                      style={{ width: `${Math.max(insight.percentage, 5)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-white/30 font-medium">{insight.description}</p>
                </div>
              ))}
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white/10 transition-all">
                <Target className="w-6 h-6 text-primary mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-3xl font-black text-white mb-1">{patterns.avgScore}</span>
                <span className="text-[8px] font-black uppercase text-white/30 tracking-widest">Aggregated Score</span>
              </div>
              <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center group hover:bg-white/10 transition-all">
                <Zap className="w-6 h-6 text-accent mb-3 group-hover:scale-110 transition-transform" />
                <span className="text-3xl font-black text-white mb-1">{patterns.trendingCount}</span>
                <span className="text-[8px] font-black uppercase text-white/30 tracking-widest">Growth Assets</span>
              </div>
              <div className="col-span-2 p-4 rounded-2xl bg-primary/10 border border-primary/20">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                     <FaMeteor className="text-primary" />
                   </div>
                   <p className="text-xs font-bold text-white/80 leading-snug">
                     <span className="text-primary">Intelligence Note:</span> This micro-market shows {patterns.avgScore > 6 ? 'high structural integrity' : 'emerging volatility'}. Focus on {patterns.sortedCategories[0]?.[0] || 'core technologies'}.
                   </p>
                 </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

