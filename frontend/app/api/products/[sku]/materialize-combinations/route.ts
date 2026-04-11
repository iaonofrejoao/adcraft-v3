// POST /api/products/:sku/materialize-combinations
// Cria todas as combinações N×M×K com os componentes aprovados.
// Regra 10: copy_combinations só pode ser inserido se hook+body+cta estão 'approved'.
//           O trigger SQL no banco valida isso — erro 23514 em violação.
// Regra 16: tag de cada combinação no formato SKU_v{N}_H{h}_B{b}_C{c}.
// PLANO_EXECUCAO 5.5 | PRD seção 2.2

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { buildCombinationTag } from '@/lib/tagging';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role key not configured');
  return createClient(url, key);
}

const RequestSchema = z.object({
  pipeline_id:     z.string().uuid(),
  product_version: z.number().int().positive().optional().default(1),
});

interface CopyComponent {
  id: string;
  component_type: string;
  slot_number: number;
  content: string | null;
  tag: string;
}

export async function POST(
  req: Request,
  { params }: { params: { sku: string } }
) {
  const { sku } = params;

  let input: z.infer<typeof RequestSchema>;
  try {
    const raw = await req.json();
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 422 }
      );
    }
    input = parsed.data;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Resolve produto pelo SKU
  const { data: product, error: productErr } = await supabase
    .from('products')
    .select('id, sku')
    .eq('sku', sku.toUpperCase())
    .maybeSingle();

  if (productErr || !product) {
    return NextResponse.json({ error: `Product '${sku}' not found` }, { status: 404 });
  }

  // Busca componentes aprovados do pipeline
  const { data: components, error: compErr } = await supabase
    .from('copy_components')
    .select('id, component_type, slot_number, content, tag')
    .eq('pipeline_id', input.pipeline_id)
    .eq('product_id', product.id)
    .eq('approval_status', 'approved')
    .order('slot_number', { ascending: true });

  if (compErr) {
    return NextResponse.json({ error: compErr.message }, { status: 500 });
  }

  const allComponents = (components ?? []) as CopyComponent[];
  const hooks  = allComponents.filter((c) => c.component_type === 'hook');
  const bodyComponents = allComponents.filter((c) => c.component_type === 'body');
  const ctas   = allComponents.filter((c) => c.component_type === 'cta');

  if (hooks.length === 0 || bodyComponents.length === 0 || ctas.length === 0) {
    return NextResponse.json(
      {
        error:  'Componentes insuficientes para combinações',
        detail: `hooks=${hooks.length}, bodies=${bodyComponents.length}, ctas=${ctas.length} — todos precisam de ≥1 aprovado`,
      },
      { status: 422 }
    );
  }

  // Verifica combinações existentes para evitar duplicatas
  const { data: existing } = await supabase
    .from('copy_combinations')
    .select('tag')
    .eq('pipeline_id', input.pipeline_id)
    .eq('product_id', product.id);

  const existingTags = new Set((existing ?? []).map((r) => r.tag as string));
  const version = input.product_version;

  // Cross-product H × B × C
  const rows: Array<{
    id: string;
    product_id: string;
    pipeline_id: string;
    tag: string;
    hook_id: string;
    body_id: string;
    cta_id: string;
    full_text: string;
    selected_for_video: boolean;
  }> = [];

  for (const hook of hooks) {
    for (const bodyComp of bodyComponents) {
      for (const cta of ctas) {
        // Regra 16: tag determinística
        const tag = buildCombinationTag(sku.toUpperCase(), version, hook.slot_number, bodyComp.slot_number, cta.slot_number);
        if (existingTags.has(tag)) continue;

        const full_text = [hook.content, bodyComp.content, cta.content]
          .filter(Boolean)
          .join('\n\n---\n\n');

        rows.push({
          id:                 randomUUID(),
          product_id:         product.id,
          pipeline_id:        input.pipeline_id,
          tag,
          hook_id:            hook.id,
          body_id:            bodyComp.id,
          cta_id:             cta.id,
          full_text,
          selected_for_video: false,
        });
      }
    }
  }

  if (rows.length === 0) {
    return NextResponse.json({
      message:      'Todas as combinações possíveis já existem',
      created:      0,
      combinations: [],
    });
  }

  // O trigger SQL do banco valida approval_status — rejeita se não aprovado
  const { data: created, error: insertErr } = await supabase
    .from('copy_combinations')
    .insert(rows)
    .select('id, tag, hook_id, body_id, cta_id, selected_for_video, created_at');

  if (insertErr) {
    // 23514 = check constraint violation (trigger de componentes não aprovados)
    const isConstraint = insertErr.code === '23514' || insertErr.message.includes('check constraint');
    return NextResponse.json(
      {
        error:   isConstraint
          ? 'Um ou mais componentes não estão aprovados — verifique compliance e aprovação manual'
          : insertErr.message,
        pg_code: insertErr.code,
      },
      { status: isConstraint ? 422 : 500 }
    );
  }

  return NextResponse.json(
    {
      message:      `${created?.length ?? 0} combinações criadas`,
      created:      created?.length ?? 0,
      combinations: created ?? [],
    },
    { status: 201 }
  );
}
