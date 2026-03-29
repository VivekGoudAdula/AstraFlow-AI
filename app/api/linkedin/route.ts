import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { name, company } = await req.json()

    const apiKey = process.env.APIFY_API_KEY || process.env.NEXT_PUBLIC_APIFY_API_KEY || ''
    if (!apiKey) {
      return NextResponse.json({ profileUrl: null, error: 'APIFY_API_KEY not set' }, { status: 400 })
    }

    if (!company || company === 'Not specified') {
      return NextResponse.json({ profileUrl: null, error: 'Company name required' })
    }

    // STRATEGY 1: If we have a real name, search Apify LinkedIn by name + company
    if (name && name !== 'Not specified' && name.length >= 3) {
      const parts = name.trim().split(' ')
      const firstName = parts[0]
      const lastName = parts.slice(1).join(' ') || ''

      console.log(`🔍 [LinkedIn Route] Strategy 1 - Name search: "${firstName} ${lastName}" @ "${company}"`)

      const res = await fetch(
        `https://api.apify.com/v2/acts/harvestapi~linkedin-profile-search-by-name/run-sync-get-dataset-items?token=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName,
            lastName,
            maxItems: 1,
            currentCompanies: [company],
            profileScraperMode: 'Short',
            strictSearch: false,
          }),
          signal: AbortSignal.timeout(55000),
        }
      )

      if (res.ok) {
        const data = await res.json()
        const profileUrl = Array.isArray(data) ? data[0]?.profileUrl : null
        if (profileUrl && profileUrl.includes('linkedin.com/in/')) {
          console.log(`✅ [LinkedIn Route] Strategy 1 found: ${profileUrl}`)
          return NextResponse.json({ profileUrl })
        }
      }
    }

    // STRATEGY 2: Google Search for site:linkedin.com/in + company + founder/CEO
    // This works without knowing the founder's name
    const query = `site:linkedin.com/in "${company}" (founder OR CEO OR "co-founder")`
    console.log(`🔍 [LinkedIn Route] Strategy 2 - Google search: "${query}"`)

    const googleRes = await fetch(
      `https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: query,
          maxPagesPerQuery: 1,
          resultsPerPage: 5,
          countryCode: 'us',
          languageCode: 'en',
        }),
        signal: AbortSignal.timeout(55000),
      }
    )

    if (googleRes.ok) {
      const googleData = await googleRes.json()
      const organicResults = googleData?.[0]?.organicResults || []

      for (const result of organicResults) {
        const url = result.url || result.link || ''
        if (url.includes('linkedin.com/in/')) {
          console.log(`✅ [LinkedIn Route] Strategy 2 found: ${url}`)
          return NextResponse.json({ profileUrl: url })
        }
      }
      console.log(`⚠️ [LinkedIn Route] Strategy 2 returned ${organicResults.length} results but no linkedin.com/in/ match`)
    } else {
      console.error(`❌ [LinkedIn Route] Strategy 2 HTTP error: ${googleRes.status}`)
    }

    return NextResponse.json({ profileUrl: null })
  } catch (err: any) {
    console.error('❌ [LinkedIn Route] Error:', err.message)
    return NextResponse.json({ profileUrl: null, error: err.message })
  }
}
