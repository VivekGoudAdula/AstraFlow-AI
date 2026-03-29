'use client'

/**
 * Qdrant Vector Memory Client
 *
 * Handles vector storage, deduplication, and similarity search
 * for funded company profiles. Uses Qdrant REST API.
 *
 * Collection: "funded_companies" with vector_size=384
 */

import fetchWrapper from '@/lib/fetchWrapper'

export interface QdrantCompany {
  company_name: string
  funding_total: string
  latest_funding: string
  category_tag: string
  funding_score: number
  why_this_matters: string
  date_founded: string
  source_of_proof: string
  trending_flag: boolean
}

export interface SimilarCompanyResult {
  company_name: string
  category_tag: string
  funding_total: string
  similarity_score: number
}

/**
 * Store companies in Qdrant vector memory and get similar companies
 * All done via our API route to keep Qdrant URL/key on server
 */
export async function storeAndFindSimilar(
  companies: QdrantCompany[]
): Promise<Record<string, SimilarCompanyResult[]>> {
  try {
    const res = await fetchWrapper('/api/qdrant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'store_and_search', companies }),
    })
    if (!res) return {}
    const data = await res.json()
    return data?.similar_companies ?? {}
  } catch {
    return {}
  }
}

/**
 * Search Qdrant for companies similar to a given company
 */
export async function findSimilarCompanies(
  companyName: string,
  categoryTag: string,
  limit: number = 3
): Promise<SimilarCompanyResult[]> {
  try {
    const res = await fetchWrapper('/api/qdrant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', company_name: companyName, category_tag: categoryTag, limit }),
    })
    if (!res) return []
    const data = await res.json()
    return Array.isArray(data?.results) ? data.results : []
  } catch {
    return []
  }
}
