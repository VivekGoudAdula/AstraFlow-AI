'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Company } from './ResultsGrid'
import { FaChartLine, FaArrowUp, FaLayerGroup } from 'react-icons/fa'

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
          description: `${topCount}/${total} companies are focused on ${topCategory}`,
        })
      }
    }

    // 2. Trending concentration
    const trendingCount = companies.filter((c) => c.trending_flag).length
    if (trendingCount > 0) {
      insights.push({
        label: 'Trending',
        count: trendingCount,
        total,
        percentage: Math.round((trendingCount / total) * 100),
        description: `${trendingCount}/${total} companies are currently trending (high score + recent funding)`,
      })
    }

    // 3. High-score concentration
    const highScoreCount = companies.filter((c) => (c.funding_score ?? 0) >= 7).length
    if (highScoreCount > 0) {
      insights.push({
        label: 'High Conviction',
        count: highScoreCount,
        total,
        percentage: Math.round((highScoreCount / total) * 100),
        description: `${highScoreCount}/${total} companies scored 7+ indicating strong market confidence`,
      })
    }

    // 4. Average funding score
    const avgScore =
      companies.reduce((sum, c) => sum + (c.funding_score ?? 0), 0) / total
    const roundedAvg = Math.round(avgScore * 10) / 10

    // 5. Funding size patterns
    const largeFunding = companies.filter((c) => {
      const amount = c.funding_total || ''
      const numMatch = amount.match(/\$?([\d.]+)\s*(B|M|K)?/i)
      if (!numMatch) return false
      const num = parseFloat(numMatch[1])
      const unit = (numMatch[2] || '').toUpperCase()
      if (unit === 'B') return true
      if (unit === 'M' && num >= 50) return true
      return false
    }).length

    if (largeFunding > 0) {
      insights.push({
        label: 'Large Rounds ($50M+)',
        count: largeFunding,
        total,
        percentage: Math.round((largeFunding / total) * 100),
        description: `${largeFunding}/${total} companies raised $50M+ rounds — indicates mature market segment`,
      })
    }

    return { insights, sortedCategories, avgScore: roundedAvg, trendingCount }
  }, [companies])

  if (patterns.insights.length === 0) return null

  return (
    <div className="max-w-5xl mx-auto px-6 pb-8">
      <Card className="bg-card border border-border rounded-lg overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FaChartLine className="w-5 h-5 text-accent" />
            <h3 className="font-serif text-xl font-bold text-foreground tracking-wide">
              Market Pattern Detection
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Automated trend analysis across {companies.length} companies in this scan
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Pattern Bars */}
          <div className="space-y-4 mb-6">
            {patterns.insights.map((insight, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {insight.label === 'Trending' ? (
                      <FaArrowUp className="w-3.5 h-3.5 text-orange-500" />
                    ) : (
                      <FaLayerGroup className="w-3.5 h-3.5 text-accent" />
                    )}
                    <span className="font-medium text-foreground">{insight.description}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {insight.percentage}%
                  </Badge>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.max(insight.percentage, 8)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Summary Stats Row */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground font-serif">{patterns.avgScore}</p>
              <p className="text-xs text-muted-foreground tracking-wide uppercase">Avg. Funding Score</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground font-serif">{patterns.sortedCategories.length}</p>
              <p className="text-xs text-muted-foreground tracking-wide uppercase">Categories Detected</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-foreground font-serif">{patterns.trendingCount}</p>
              <p className="text-xs text-muted-foreground tracking-wide uppercase">Trending Startups</p>
            </div>
          </div>

          {/* Dominant Trend Callout */}
          {patterns.insights.length > 0 && patterns.insights[0].percentage >= 40 && (
            <div className="mt-4 bg-accent/10 border border-accent/20 rounded-lg p-3">
              <p className="text-sm font-medium text-foreground">
                <span className="text-accent font-bold">Strong trend detected:</span>{' '}
                {patterns.insights[0].description} — this suggests significant investor momentum in this segment.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
