import { NextRequest, NextResponse } from 'next/server'

const FB_GRAPH_VERSION = 'v22.0'
const FB_FIELDS = [
  'id',
  'ad_creation_time',
  'ad_delivery_start_time',
  'ad_delivery_stop_time',
  'ad_snapshot_url',
  'currency',
  'funding_entity',
  'impressions',
  'page_id',
  'page_name',
  'publisher_platforms',
  'spend',
  'media_type',
  'ad_creative_bodies',
  'ad_creative_link_titles',
  'ad_creative_link_descriptions',
  'bylines',
  'languages',
].join(',')

export async function GET(req: NextRequest) {
  const token = process.env.FACEBOOK_ACCESS_TOKEN
  if (!token) {
    return NextResponse.json({ error: 'FACEBOOK_ACCESS_TOKEN não configurado' }, { status: 500 })
  }

  const sp = req.nextUrl.searchParams

  const search_terms    = sp.get('search_terms') ?? ''
  const search_page_ids = sp.get('search_page_ids') ?? ''
  const countries       = sp.get('countries') ?? 'BR'
  const status          = sp.get('status') ?? 'ALL'
  const ad_type         = sp.get('ad_type') ?? 'ALL'
  const media_type      = sp.get('media_type') ?? 'ALL'
  const platforms       = sp.get('platforms') ?? ''
  const languages       = sp.get('languages') ?? ''
  const limit           = sp.get('limit') ?? '24'
  const after           = sp.get('after') ?? ''

  if (!search_terms.trim() && !search_page_ids.trim()) {
    return NextResponse.json(
      { error: 'Informe palavras-chave ou ID de página para pesquisar' },
      { status: 400 },
    )
  }

  const params = new URLSearchParams()
  params.set('access_token', token)
  params.set('fields', FB_FIELDS)
  params.set('ad_reached_countries', JSON.stringify(countries.split(',')))
  params.set('ad_active_status', status)
  params.set('ad_type', ad_type)
  params.set('limit', limit)

  if (search_terms.trim()) params.set('search_terms', search_terms.trim())
  if (search_page_ids.trim()) {
    const ids = search_page_ids.split(',').map(s => s.trim()).filter(Boolean)
    params.set('search_page_ids', JSON.stringify(ids))
  }
  if (media_type !== 'ALL') params.set('media_type', media_type)
  if (platforms) params.set('publisher_platforms', JSON.stringify(platforms.split(',').map(p => p.toLowerCase())))
  if (languages) params.set('languages', JSON.stringify(languages.split(',')))
  if (after) params.set('after', after)

  const url = `https://graph.facebook.com/${FB_GRAPH_VERSION}/ads_archive?${params.toString()}`

  try {
    const res  = await fetch(url, { cache: 'no-store' })
    const data = await res.json()

    if (data.error) {
      console.error('[ad-library] Facebook API error:', JSON.stringify(data.error))
      const { message, type, code, error_subcode, fbtrace_id } = data.error
      return NextResponse.json(
        { error: message, type, code, error_subcode, fbtrace_id },
        { status: 400 },
      )
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Erro ao conectar com Facebook Graph API' }, { status: 502 })
  }
}
