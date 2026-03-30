import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    const apiKey = process.env.APIFY_API_KEY || process.env.NEXT_PUBLIC_APIFY_API_KEY || ''

    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'APIFY_API_KEY not set' }, { status: 500 })
    }

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query is required' }, { status: 400 })
    }

    console.log(`🔍 [Search Route] Searching Google for: "${query}"`)

    const res = await fetch(
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

    if (!res.ok) {
      return NextResponse.json({ success: false, error: `Apify error: ${res.status}` }, { status: res.status })
    }

    const data = await res.json()
    // Apify returns an array of results, one per query. 
    // Within each result, there's an organicResults array.
    const organicResults = data?.[0]?.organicResults || []
    
    // Extract top 3 links
    const links = organicResults.slice(0, 3).map((r: any) => r.url || r.link).filter(Boolean)

    // Clean links (only http)
    const cleanLinks = links.filter((link: string) => link.startsWith("http"))

    console.log(`✅ [Search Route] Found ${cleanLinks.length} links:`, cleanLinks)

    return NextResponse.json({ success: true, links: cleanLinks })
  } catch (error: any) {
    console.error('❌ [Search Route] Error:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
