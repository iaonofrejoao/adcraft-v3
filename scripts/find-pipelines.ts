import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb  = createClient(url!, key!);

  const { data: product } = await sb
    .from('products')
    .select('id, name, sku, niche_id')
    .eq('sku', 'BWNP')
    .maybeSingle();

  if (!product) { console.error('Produto BWNP não encontrado'); process.exit(1); }

  console.log(`Produto: ${product.name} (${product.sku}) — id: ${product.id} — niche_id: ${product.niche_id ?? 'NULL'}`);

  const { data: pipes } = await sb
    .from('pipelines')
    .select('id, goal, status, created_at, tasks(agent_name, status)')
    .eq('product_id', product.id)
    .in('status', ['completed', 'running', 'pending', 'failed'])
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\nPipelines encontrados: ${pipes?.length ?? 0}`);
  for (const p of pipes ?? []) {
    const done  = (p.tasks as any[]).filter((t: any) => t.status === 'completed').length;
    const total = (p.tasks as any[]).length;
    console.log(`  [${p.status}] ${p.goal} — ${done}/${total} tasks — ${p.created_at} — id: ${p.id}`);
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
