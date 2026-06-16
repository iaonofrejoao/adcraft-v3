import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb  = createClient(url!, key!);

  const PRODUCT_ID = 'ef90fdf7-8189-4ac2-b7ee-73ff22b8e2c3';

  // Todos os artefatos do produto, mostrando pipeline_id
  const { data: all, count } = await sb
    .from('product_knowledge')
    .select('id, artifact_type, pipeline_id, created_at', { count: 'exact' })
    .eq('product_id', PRODUCT_ID)
    .order('created_at', { ascending: false });

  console.log(`Total artefatos produto BWNP: ${count}\n`);
  for (const a of all ?? []) {
    console.log(`  [${a.artifact_type}] pipeline:${a.pipeline_id?.slice(0,8) ?? 'NULL'} — ${a.created_at}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
