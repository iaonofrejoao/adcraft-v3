import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('ENV missing: SUPABASE_URL ou SERVICE_KEY não encontradas');
    process.exit(1);
  }

  const sb = createClient(url, key);

  const [lRes, pRes, iRes, eRes, lSample] = await Promise.all([
    sb.from('execution_learnings').select('*', { count: 'exact', head: true }),
    sb.from('learning_patterns').select('*', { count: 'exact', head: true }),
    sb.from('insights').select('*', { count: 'exact', head: true }),
    sb.from('embeddings').select('*', { count: 'exact', head: true }).eq('source_table', 'execution_learnings'),
    sb.from('execution_learnings')
      .select('id, category, confidence, niche_id, validated_by_user, created_at')
      .limit(3)
      .order('created_at', { ascending: false }),
  ]);

  console.log('\n── Contagens ──────────────────────────────────');
  console.log(`execution_learnings : ${lRes.count ?? 'erro'} ${lRes.error ? `(${lRes.error.message})` : ''}`);
  console.log(`learning_patterns   : ${pRes.count ?? 'erro'} ${pRes.error ? `(${pRes.error.message})` : ''}`);
  console.log(`insights            : ${iRes.count ?? 'erro'} ${iRes.error ? `(${iRes.error.message})` : ''}`);
  console.log(`embeddings (learnings): ${eRes.count ?? 'erro'} ${eRes.error ? `(${eRes.error.message})` : ''}`);

  if (lRes.count && lRes.count > 0 && lSample.data?.length) {
    console.log('\n── Últimos 3 learnings ────────────────────────');
    for (const l of lSample.data) {
      console.log(`  [${l.category}] conf=${l.confidence} niche=${l.niche_id ?? 'NULL'} validated=${l.validated_by_user} — ${l.created_at}`);
    }
  }

  process.exit(0);
}

main().catch(e => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
