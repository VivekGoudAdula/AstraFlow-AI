import { NextRequest, NextResponse } from 'next/server'

/**
 * Google Sheets Export API Route
 *
 * Mode 'sheets': Appends company data directly to the user's Google Sheet
 * Mode 'csv': Returns a downloadable CSV file
 *
 * Spreadsheet: https://docs.google.com/spreadsheets/d/1V7YVeOjM5RvRP7X8lUyFaH6b_oE2CmPkSXbVV5gQ14Y
 */

const SPREADSHEET_ID = '1V7YVeOjM5RvRP7X8lUyFaH6b_oE2CmPkSXbVV5gQ14Y'
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?usp=sharing`

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

function companyToRow(c: CompanyData): string[] {
  return [
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
    new Date().toLocaleString(),
  ]
}

const HEADERS = [
  'Company Name', 'Funding Total', 'Latest Funding', 'Date Founded',
  'Funding Score', 'Score Breakdown', 'Category', 'Why This Matters',
  'Trending', 'Similar Companies', 'Source of Proof',
  'Founder LinkedIn', 'Email', 'Marketing Mgr LinkedIn', 'Marketing Mgr Email',
  'Export Date',
]

// --- Google Sheets API: Append using service account ---
async function getAccessToken(): Promise<string | null> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!raw) return null
  try {
    const key = JSON.parse(raw)
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: 'RS256', typ: 'JWT' }
    const claims = {
      iss: key.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }
    const b64 = (o: any) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const unsigned = `${b64(header)}.${b64(claims)}`
    const crypto = await import('crypto')
    const sig = crypto.createSign('RSA-SHA256')
    sig.update(unsigned)
    const signed = sig.sign(key.private_key, 'base64url')
    const jwt = `${unsigned}.${signed}`
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.access_token || null
  } catch {
    return null
  }
}

async function appendToGoogleSheets(companies: CompanyData[]): Promise<{ success: boolean; rowsAdded: number; error?: string }> {
  // Try service account first
  let token = await getAccessToken()

  // Try API key as fallback
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GOOGLE_SHEETS_API_KEY || ''

  if (!token && !apiKey) {
    return { success: false, rowsAdded: 0, error: 'No Google credentials. Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_API_KEY env var.' }
  }

  const rows = [HEADERS, ...companies.map(companyToRow)]
  const range = 'Sheet1'
  const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append`
  const params = 'valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS'

  const url = token
    ? `${baseUrl}?${params}`
    : `${baseUrl}?${params}&key=${apiKey}`

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ values: rows }),
    })

    if (res.ok) {
      const data = await res.json()
      return { success: true, rowsAdded: data?.updates?.updatedRows || companies.length }
    }

    const err = await res.json().catch(() => ({}))
    return { success: false, rowsAdded: 0, error: `Sheets API ${res.status}: ${err?.error?.message || 'Unknown error'}` }
  } catch (e) {
    return { success: false, rowsAdded: 0, error: e instanceof Error ? e.message : 'Network error' }
  }
}

// --- CSV ---
function escapeCSV(v: string): string {
  if (!v) return ''
  const e = v.replace(/"/g, '""')
  return e.includes(',') || e.includes('\n') || e.includes('"') ? `"${e}"` : e
}

function generateCSV(companies: CompanyData[]): string {
  const headerRow = HEADERS.join(',')
  const dataRows = companies.map(c =>
    companyToRow(c).map(v => escapeCSV(v)).join(',')
  )
  return [headerRow, ...dataRows].join('\n')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const companies: CompanyData[] = Array.isArray(body?.companies) ? body.companies : []
    const mode = body?.mode || 'sheets'

    if (companies.length === 0) {
      return NextResponse.json({ error: 'No companies to export' }, { status: 400 })
    }

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

    // Mode: sheets — append directly
    const result = await appendToGoogleSheets(companies)

    return NextResponse.json({
      success: result.success,
      spreadsheet_url: SHEET_URL,
      rows_exported: result.rowsAdded,
      message: result.success
        ? `Exported ${result.rowsAdded} rows to Google Sheets`
        : `Export failed: ${result.error}. Use CSV download instead.`,
      error: result.error || undefined,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      spreadsheet_url: SHEET_URL,
      error: error instanceof Error ? error.message : 'Export failed',
    }, { status: 500 })
  }
}
