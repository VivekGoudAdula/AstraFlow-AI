import { NextRequest, NextResponse } from 'next/server'

/**
 * Google Sheets Export API Route
 *
 * Appends company data directly to a Google Sheet using the Sheets API v4.
 * Uses a service account for authentication.
 * Also supports CSV download as fallback.
 */

const SPREADSHEET_ID = '1V7YVeOjM5RvRP7X8lUyFaH6b_oE2CmPkSXbVV5gQ14Y'
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?usp=sharing`
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

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

// --- Google Auth: Create JWT and get access token ---
async function getAccessToken(): Promise<string | null> {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!serviceAccountKey) return null

  try {
    const key = JSON.parse(serviceAccountKey)
    const now = Math.floor(Date.now() / 1000)

    // Build JWT header and claim set
    const header = { alg: 'RS256', typ: 'JWT' }
    const claimSet = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }

    const encode = (obj: any) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url')

    const unsignedToken = `${encode(header)}.${encode(claimSet)}`

    // Sign with RSA private key
    const crypto = await import('crypto')
    const sign = crypto.createSign('RSA-SHA256')
    sign.update(unsignedToken)
    const signature = sign.sign(key.private_key, 'base64url')

    const jwt = `${unsignedToken}.${signature}`

    // Exchange JWT for access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })

    if (!tokenRes.ok) return null
    const tokenData = await tokenRes.json()
    return tokenData.access_token || null
  } catch {
    return null
  }
}

// --- Google API Key fallback ---
function getApiKey(): string | null {
  return process.env.GOOGLE_API_KEY || null
}

// --- Append rows to the sheet ---
async function appendToSheet(companies: CompanyData[]): Promise<{ success: boolean; rowsAdded: number; error?: string }> {
  const accessToken = await getAccessToken()
  const apiKey = getApiKey()

  if (!accessToken && !apiKey) {
    return { success: false, rowsAdded: 0, error: 'No Google credentials configured' }
  }

  // Build headers row + data rows
  const headers = [
    'Company Name', 'Funding Total', 'Latest Funding', 'Date Founded',
    'Funding Score', 'Score Breakdown', 'Category', 'Why This Matters',
    'Trending', 'Similar Companies', 'Source of Proof',
    'Founder LinkedIn', 'Email', 'Marketing Manager LinkedIn', 'Marketing Manager Email',
    'Export Date',
  ]

  const dataRows = companies.map((c) => [
    c.company_name || 'N/A',
    c.funding_total || 'N/A',
    c.latest_funding || 'N/A',
    c.date_founded || 'N/A',
    String(c.funding_score ?? 0),
    c.score_breakdown || 'N/A',
    c.category_tag || 'N/A',
    c.why_this_matters || 'N/A',
    c.trending_flag ? 'Yes' : 'No',
    Array.isArray(c.similar_companies) ? c.similar_companies.join(', ') : 'N/A',
    c.source_of_proof || 'N/A',
    c.founder_linkedin || 'N/A',
    c.email || 'N/A',
    c.marketing_community_manager_linkedin || 'N/A',
    c.marketing_community_manager_email || 'N/A',
    new Date().toISOString(),
  ])

  // First check if sheet has headers, if not add them
  const allRows = [headers, ...dataRows]

  const url = accessToken
    ? `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`
    : `${SHEETS_API_BASE}/${SPREADSHEET_ID}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS&key=${apiKey}`

  const fetchHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (accessToken) {
    fetchHeaders['Authorization'] = `Bearer ${accessToken}`
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify({
        values: allRows,
      }),
    })

    if (res.ok) {
      const data = await res.json()
      return {
        success: true,
        rowsAdded: data?.updates?.updatedRows || companies.length,
      }
    }

    const errorData = await res.json().catch(() => ({}))
    return {
      success: false,
      rowsAdded: 0,
      error: errorData?.error?.message || `API error ${res.status}`,
    }
  } catch (err) {
    return {
      success: false,
      rowsAdded: 0,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}

// --- CSV generation fallback ---
function escapeCSV(value: string): string {
  if (!value) return ''
  const escaped = value.replace(/"/g, '""')
  if (escaped.includes(',') || escaped.includes('\n') || escaped.includes('"')) {
    return `"${escaped}"`
  }
  return escaped
}

function generateCSV(companies: CompanyData[]): string {
  const headers = [
    'Company Name', 'Funding Total', 'Latest Funding', 'Date Founded',
    'Funding Score', 'Score Breakdown', 'Category', 'Why This Matters',
    'Trending', 'Similar Companies', 'Source of Proof',
    'Founder LinkedIn', 'Email', 'Marketing Manager LinkedIn', 'Marketing Manager Email',
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

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const companies: CompanyData[] = Array.isArray(body?.companies) ? body.companies : []
    const mode = body?.mode || 'sheets' // 'sheets' or 'csv'

    if (companies.length === 0) {
      return NextResponse.json({ error: 'No companies to export' }, { status: 400 })
    }

    // Mode: CSV download
    if (mode === 'csv') {
      const csv = generateCSV(companies)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="AstraFlow_AI_Export_${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // Mode: Google Sheets append
    const result = await appendToSheet(companies)

    if (result.success) {
      return NextResponse.json({
        success: true,
        spreadsheet_url: SHEET_URL,
        rows_exported: result.rowsAdded,
        message: `Successfully exported ${result.rowsAdded} rows to Google Sheets`,
      })
    }

    // Sheets failed — return error with CSV fallback hint
    return NextResponse.json({
      success: false,
      error: result.error,
      spreadsheet_url: SHEET_URL,
      message: 'Google Sheets API failed. Use CSV download instead.',
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Export failed' },
      { status: 500 }
    )
  }
}
