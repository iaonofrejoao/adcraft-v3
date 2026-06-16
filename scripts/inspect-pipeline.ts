import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb  = createClient(url!, key!);

  const PIPELINE_ID = '3e33995e-a511-44ad-b087-82b4c185c72a';

  const { data: tasks } = await sb
    .from('tasks')
    .select('agent_name, status, output, error')
    .eq('pipeline_id', PIPELINE_ID)
    .order('created_at');

  console.log(`Tasks do pipeline ${PIPELINE_ID.slice(0,8)}:\n`);
  for (const t of tasks ?? []) {
    const hasOutput = t.output !== null && t.output !== undefined;
    const outputSize = hasOutput ? JSON.stringify(t.output).length : 0;
    console.log(`  [${t.status}] ${t.agent_name} — output: ${hasOutput ? `${outputSize} chars` : 'NULL'} ${t.error ? `| erro: ${t.error.slice(0,60)}` : ''}`);
  }

  // Também checa product_knowledge para ver se há artefatos
  const { data: artifacts, count } = await sb
    .from('product_knowledge')
    .select('artifact_type, created_at', { count: 'exact' })
    .eq('product_id', 'ef90fdf7-8189-4ac2-b7ee-73ff22b8e2c3')
    .order('created_at', { ascending: false })
    .limit(20);

  console.log(`\nArtefatos em product_knowledge: ${count}`);
  for (const a of artifacts ?? []) {
    console.log(`  ${a.artifact_type} — ${a.created_at}`);
  }

  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
