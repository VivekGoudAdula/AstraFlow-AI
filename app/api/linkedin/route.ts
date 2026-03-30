import { NextRequest, NextResponse } from 'next/server'

// --- Helper: Scrape LinkedIn Profile for Email ---
async function scrapeLinkedInEmail(profileUrl: string, apiKey: string): Promise<string | null> {
  if (!profileUrl || !profileUrl.includes('linkedin.com/in/')) return null
  
  console.log(`📡 [Scraper] Extracting details for: ${profileUrl}`)
  
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/dev_fusion~linkedin-profile-scraper/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [profileUrl],
          minDelay: 2,
          maxDelay: 5,
          proxy: { useApifyProxy: true }
        }),
        signal: AbortSignal.timeout(55000),
      }
    )

    if (res.ok) {
      const data = await res.json()
      // Dataset items are returned as an array. 
      // The dev_fusion actor typically returns field 'email' or 'personalEmail'.
      const item = data[0]
      const email = item?.email || item?.personal_email || item?.contact_info?.email || null
      if (email) console.log(`📧 [Scraper] Captured Email: ${email}`)
      return email
    }
  } catch (err) {
    console.error('⚠️ [Scraper] Error:', err)
  }
  return null
}

export async function POST(req: NextRequest) {
  try {
    const { name, company, role = 'founder' } = await req.json()
    const apiKey = process.env.APIFY_API_KEY || process.env.NEXT_PUBLIC_APIFY_API_KEY || ''

    if (!apiKey) {
      return NextResponse.json({ profileUrl: null, error: 'APIFY_API_KEY not set' }, { status: 400 })
    }

    if (!company || company === 'Not specified') {
      return NextResponse.json({ profileUrl: null, error: 'Company name required' })
    }

    let foundUrl: string | null = null

    // STRATEGY 1: Name Search (Only for Founders, usually)
    if (role === 'founder' && name && name !== 'Not specified' && name.length >= 3) {
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
        const url = Array.isArray(data) ? data[0]?.profileUrl : null
        if (url && url.includes('linkedin.com/in/')) {
          foundUrl = url
        }
      }
    }

    // STRATEGY 2: Google LinkedIn Search (Role-based fallback/discovery)
    if (!foundUrl) {
      let query = ''
      if (role === 'marketing_manager') {
        query = `site:linkedin.com/in "${company}" ("marketing manager" OR "community manager" OR "growth manager" OR "DevRel")`
      } else {
        query = `site:linkedin.com/in "${company}" (founder OR CEO OR "co-founder")`
      }

      console.log(`🔍 [LinkedIn Route] Strategy 2 - Google search (${role}): "${query}"`)

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
        
        console.log(`📡 [LinkedIn Route] Scanning ${organicResults.length} organic results for "${role}" keywords...`)

        for (const result of organicResults) {
          const url = result.url || result.link || ''
          const title = (result.title || '').toLowerCase()
          
          if (url.includes('linkedin.com/in/')) {
            // Apply strict role validation for marketing/growth roles
            if (role === 'marketing_manager') {
              const matches = ['marketing', 'community', 'growth', 'developer relations', 'devrel', 'partnerships'].some(k => title.includes(k))
              if (matches) {
                console.log(`✅ [LinkedIn Route] Filtered Match Found: ${url} (Title: ${title})`)
                foundUrl = url
                break
              }
            } else {
              // For founders, we are generally more lenient as name/company search was already performed
              foundUrl = url
              break
            }
          }
        }
      }
    }

    // 🔥 STEP 3: SCRAPE EXTENDED DETAILS (EMAIL)
    if (foundUrl) {
      console.log(`✅ [LinkedIn Route] Profile found (${role}): ${foundUrl}. Scraping for email...`)
      const email = await scrapeLinkedInEmail(foundUrl, apiKey)
      return NextResponse.json({ profileUrl: foundUrl, email })
    }

    return NextResponse.json({ profileUrl: null, email: null })
  } catch (err: any) {
    console.error('❌ [LinkedIn Route] Error:', err.message)
    return NextResponse.json({ profileUrl: null, email: null, error: err.message })
  }
}
