import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role key not configured')
  return createClient(url, key)
}

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params
  const supabase = getServiceClient()

  const { data: updated, error } = await supabase
    .from('copy_components')
    .update({ approval_status: 'pending', approved_at: null })
    .eq('id', id)
    .select('id, tag, component_type, slot_number, approval_status, approved_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}
