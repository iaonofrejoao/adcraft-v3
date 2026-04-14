// GET  /api/conversations  — lista conversas do usuário (mais recente primeiro)
// POST /api/conversations  — cria nova conversa
// PLANO_EXECUCAO 5.6 | PRD seção 6 (tabelas conversations + messages)

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const user_id = searchParams.get('user_id');
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const offset  = parseInt(searchParams.get('offset') ?? '0', 10);

  const supabase = getServiceClient();

  let query = supabase
    .from('conversations')
    .select('id, title, created_at, last_message_at, user_id', { count: 'exact' })
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (user_id) {
    query = query.eq('user_id', user_id);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ conversations: data ?? [], total: count ?? data?.length ?? 0 });
}

// ── POST ──────────────────────────────────────────────────────────────────────

const CreateConversationSchema = z.object({
  user_id: z.string().uuid().optional(),
  title:   z.string().max(255).optional(),
});

export async function POST(req: Request) {
  let body: z.infer<typeof CreateConversationSchema>;
  try {
    const raw = await req.json();
    const parsed = CreateConversationSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 }
      );
    }
    body = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('conversations')
    .insert({
      id:      randomUUID(),
      user_id: body.user_id ?? null,
      title:   body.title ?? 'Nova conversa',
    })
    .select('id, title, created_at, last_message_at, user_id')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
