import { NextRequest, NextResponse } from 'next/server'

/**
 * Qdrant Vector Memory API Route
 *
 * Handles:
 * - store_and_search: Store companies + find similar for each
 * - search: Find similar companies by name/category
 *
 * Uses simple text embedding via hashing for vector generation.
 * In production, replace with a real embedding model (e.g., sentence-transformers).
 *
 * Qdrant collection: "funded_companies" with vector_size=384
 */

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || ''
const COLLECTION_NAME = 'funded_companies'
const VECTOR_SIZE = 384

// --- Simple deterministic text-to-vector (for demo/MVP) ---
// In production, use sentence-transformers or OpenAI embeddings
function textToVector(text: string): number[] {
  const vector = new Array(VECTOR_SIZE).fill(0)
  const normalized = text.toLowerCase().trim()
  for (let i = 0; i < normalized.length; i++) {
    const charCode = normalized.charCodeAt(i)
    const idx = (charCode * (i + 1) * 31) % VECTOR_SIZE
    vector[idx] += 1.0 / (1 + Math.floor(i / 10))
  }
  // Normalize to unit vector
  const magnitude = Math.sqrt(vector.reduce((sum: number, v: number) => sum + v * v, 0))
  if (magnitude > 0) {
    for (let i = 0; i < VECTOR_SIZE; i++) {
      vector[i] /= magnitude
    }
  }
  return vector
}

function companyToText(company: any): string {
  return [
    company.company_name || '',
    company.category_tag || '',
    company.funding_total || '',
    company.latest_funding || '',
    company.why_this_matters || '',
  ].join(' ')
}

function generatePointId(name: string): number {
  let hash = 0
  const str = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) & 0x7fffffff
  }
  return hash || 1
}

async function qdrantRequest(path: string, method: string, body?: any) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (QDRANT_API_KEY) headers['api-key'] = QDRANT_API_KEY

  const res = await fetch(`${QDRANT_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  return res
}

async function ensureCollection() {
  try {
    const check = await qdrantRequest(`/collections/${COLLECTION_NAME}`, 'GET')
    if (check.status === 200) return true

    await qdrantRequest('/collections/' + COLLECTION_NAME, 'PUT', {
      vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
    })
    return true
  } catch {
    return false
  }
}

async function upsertPoints(companies: any[]) {
  const points = companies.map((c) => ({
    id: generatePointId(c.company_name || 'unknown'),
    vector: textToVector(companyToText(c)),
    payload: {
      company_name: c.company_name || '',
      category_tag: c.category_tag || '',
      funding_total: c.funding_total || '',
      latest_funding: c.latest_funding || '',
      funding_score: c.funding_score || 0,
      why_this_matters: c.why_this_matters || '',
      date_founded: c.date_founded || '',
      source_of_proof: c.source_of_proof || '',
      founder_linkedin: c.founder_linkedin || '',
      email: c.email || '',
      marketing_community_manager_linkedin: c.marketing_community_manager_linkedin || '',
      marketing_community_manager_email: c.marketing_community_manager_email || '',
      trending_flag: c.trending_flag || false,
      stored_at: new Date().toISOString(),
    },
  }))

  await qdrantRequest(`/collections/${COLLECTION_NAME}/points`, 'PUT', {
    points,
  })
}

async function searchSimilar(queryText: string, excludeName: string, limit: number = 3) {
  const vector = textToVector(queryText)

  const res = await qdrantRequest(`/collections/${COLLECTION_NAME}/points/search`, 'POST', {
    vector,
    limit: limit + 5, // fetch extra to filter
    with_payload: true,
    score_threshold: 0.1,
  })

  if (!res.ok) return []

  const data = await res.json()
  const results = (data?.result || [])
    .filter((r: any) => {
      const name = (r.payload?.company_name || '').toLowerCase()
      return name !== excludeName.toLowerCase()
    })
    .slice(0, limit)
    .map((r: any) => ({
      company_name: r.payload?.company_name || 'Unknown',
      category_tag: r.payload?.category_tag || '',
      funding_total: r.payload?.funding_total || '',
      similarity_score: Math.round((r.score || 0) * 100) / 100,
    }))

  return results
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'store_and_search') {
      const { companies } = body
      if (!Array.isArray(companies) || companies.length === 0) {
        return NextResponse.json({ similar_companies: {} })
      }

      const collectionReady = await ensureCollection()
      if (!collectionReady) {
        // Qdrant not available — return empty (graceful degradation)
        return NextResponse.json({
          similar_companies: {},
          qdrant_status: 'unavailable',
          message: 'Qdrant is not connected. Similar companies will use category-based matching.',
        })
      }

      // Store the new companies and look for comparisons
      const similarMap: Record<string, any[]> = {}
      const comparisonMap: Record<string, any> = {}

      for (const company of companies) {
        const queryText = companyToText(company)
        const id = generatePointId(company.company_name || 'unknown')
        
        // 1. Check if it exists for comparison
        let existingPoint: any = null
        try {
          const checkRes = await qdrantRequest(`/collections/${COLLECTION_NAME}/points/${id}`, 'GET')
          if (checkRes.ok) {
            const checkData = await checkRes.json()
            existingPoint = checkData?.result
          }
        } catch {}

        // 2. Perform comparison if found
        if (existingPoint && existingPoint.payload) {
          const oldTotal = existingPoint.payload.funding_total
          const newTotal = company.funding_total
          
          comparisonMap[company.company_name] = {
            exists: true,
            is_new_round: oldTotal !== newTotal,
            funding_increased: (newTotal?.length ?? 0) > (oldTotal?.length ?? 0), // Simple heuristic for Demo
            previous_total: oldTotal,
            new_total: newTotal,
            recommendation: "Update record"
          }
        } else {
          comparisonMap[company.company_name] = { exists: false }
        }

        // 3. Upsert (idempotent overwrite)
        await upsertPoints([company])

        // 4. Search for similar companies (for discovery)
        const similar = await searchSimilar(queryText, company.company_name || '', 3)
        similarMap[company.company_name || ''] = similar
      }

      return NextResponse.json({ 
        similar_companies: similarMap, 
        comparisons: comparisonMap,
        qdrant_status: 'connected' 
      })
    }

    if (action === 'search') {
      const { company_name, category_tag, limit } = body
      const collectionReady = await ensureCollection()
      if (!collectionReady) {
        return NextResponse.json({ results: [], qdrant_status: 'unavailable' })
      }

      const queryText = `${company_name || ''} ${category_tag || ''}`
      const results = await searchSimilar(queryText, company_name || '', limit || 3)
      return NextResponse.json({ results, qdrant_status: 'connected' })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({
      similar_companies: {},
      qdrant_status: 'error',
      message: error instanceof Error ? error.message : 'Qdrant request failed',
    })
  }
}
