// GET    /api/conversations/:id  — retorna conversa + messages
// PATCH  /api/conversations/:id  — atualiza título
// DELETE /api/conversations/:id  — remove conversa e todas as messages
// PLANO_EXECUCAO 5.6

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const supabase = getServiceClient();

  const { data: conversation, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('id, role, content, references, pipeline_id, created_at, pipelines(plan, status, goal, deliverable_agent, budget_usd, product_id)')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true });

  if (messagesError) {
    console.error('[GET conv] messages query error:', messagesError.message);
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  return NextResponse.json({ ...conversation, messages: messages ?? [] });
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

const PatchSchema = z.object({
  title: z.string().min(1).max(255),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  let body: z.infer<typeof PatchSchema>;
  try {
    const raw = await req.json();
    const parsed = PatchSchema.safeParse(raw);
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
    .update({ title: body.title })
    .eq('id', id)
    .select('id, title, created_at, last_message_at')
    .single();

  if (error) {
    return NextResponse.json(
      { error: error.code === 'PGRST116' ? 'Conversation not found' : error.message },
      { status: error.code === 'PGRST116' ? 404 : 500 }
    );
  }

  return NextResponse.json(data);
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const supabase = getServiceClient();

  // Messages são excluídas em cascata pelo FK (ON DELETE CASCADE no banco)
  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
