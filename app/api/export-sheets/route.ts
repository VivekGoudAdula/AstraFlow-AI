import { NextRequest, NextResponse } from 'next/server'

/**
 * Google Sheets Export API Route
 *
 * Exports company data as a downloadable CSV file that can be
 * directly imported into Google Sheets, Excel, or any spreadsheet app.
 *
 * This approach bypasses the Composio tool integration issues
 * and gives the user an immediate, working export.
 */

interface CompanyData {
  company_name?: string
  funding_total?: string
  latest_funding?: string
  date_founded?: string
  funding_score?: number
  score_breakdown?: string
  category_tag?: string
  why_this_matters?: string
  trending_flag?: boolean
  similar_companies?: string[]
  source_of_proof?: string
  founder_linkedin?: string
  email?: string
  marketing_community_manager_linkedin?: string
  marketing_community_manager_email?: string
}

function escapeCSV(value: string): string {
  if (!value) return ''
  // Escape double quotes and wrap in quotes if contains comma, newline, or quote
  const escaped = value.replace(/"/g, '""')
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`
  }
  return escaped
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const companies: CompanyData[] = Array.isArray(body?.companies) ? body.companies : []

    if (companies.length === 0) {
      return NextResponse.json({ error: 'No companies to export' }, { status: 400 })
    }

    // Build CSV
    const headers = [
      'Company Name',
      'Funding Total',
      'Latest Funding',
      'Date Founded',
      'Funding Score',
      'Score Breakdown',
      'Category',
      'Why This Matters',
      'Trending',
      'Similar Companies',
      'Source of Proof',
      'Founder LinkedIn',
      'Email',
      'Marketing Manager LinkedIn',
      'Marketing Manager Email',
    ]

    const rows = companies.map((c) => [
      escapeCSV(c.company_name || 'N/A'),
      escapeCSV(c.funding_total || 'N/A'),
      escapeCSV(c.latest_funding || 'N/A'),
      escapeCSV(c.date_founded || 'N/A'),
      String(c.funding_score ?? 0),
      escapeCSV(c.score_breakdown || 'N/A'),
      escapeCSV(c.category_tag || 'N/A'),
      escapeCSV(c.why_this_matters || 'N/A'),
      c.trending_flag ? 'Yes' : 'No',
      escapeCSV(Array.isArray(c.similar_companies) ? c.similar_companies.join(', ') : 'N/A'),
      escapeCSV(c.source_of_proof || 'N/A'),
      escapeCSV(c.founder_linkedin || 'N/A'),
      escapeCSV(c.email || 'N/A'),
      escapeCSV(c.marketing_community_manager_linkedin || 'N/A'),
      escapeCSV(c.marketing_community_manager_email || 'N/A'),
    ])

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    // Return CSV as downloadable file
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="AstraFlow_AI_Export_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    )
  }
}
