/**
 * scripts/apply-v2-migrations.ts
 *
 * Aplica as migrations v2 manuais (SQL puro) no Supabase, na ordem correta.
 * Uso: pnpm tsx scripts/apply-v2-migrations.ts
 */

import postgres from 'postgres';
import fs from 'fs';

const DB_URL = process.env.DATABASE_URL;

if (!DB_URL) {
  throw new Error('DATABASE_URL deve estar no .env');
}

async function runFile(sql: postgres.Sql, file: string, splitOnBreakpoint = false) {
  console.log(`\nApplying ${file} …`);

  // Limpa qualquer transação abortada da execução anterior
  try { await sql.unsafe('ROLLBACK'); } catch { /* noop — sem transação aberta */ }

  const content = fs.readFileSync(file, 'utf8');
  const statements = splitOnBreakpoint
    ? content.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean)
    : [content];

  let ok = 0, skip = 0, fail = 0;
  for (const stmt of statements) {
    try {
      await sql.unsafe(stmt);
      ok++;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Rollback para limpar estado após qualquer erro
      try { await sql.unsafe('ROLLBACK'); } catch { /* noop */ }
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        skip++;
      } else {
        console.error('  STMT ERROR:', msg.slice(0, 200));
        fail++;
      }
    }
  }
  console.log(`  done — ok:${ok} skip:${skip} fail:${fail}`);
  return fail;
}

async function main() {
  const sql = postgres(DB_URL, { ssl: 'require', max: 1 });

  // 1. pgvector extension
  await runFile(sql, 'migrations/v2/000_enable_pgvector.sql');

  // 2. Main v2 tables (Drizzle-generated, has breakpoints)
  await runFile(sql, 'migrations/v2/0000_mean_greymalkin.sql', true);

  // 3. Custom triggers, SKU column, RLS
  await runFile(sql, 'migrations/v2/0001_custom_triggers_rls.sql');

  // 4. write_artifact RPC
  await runFile(sql, 'migrations/v2/0002_write_artifact_rpc.sql');

  // 5. Niche intelligence RPCs
  await runFile(sql, 'migrations/v2/0003_niche_intelligence_rpcs.sql');

  // 6. llm_calls payload column
  await runFile(sql, 'migrations/v2/0004_llm_calls_payload.sql');

  // 7. tasks confirmed + oversized columns
  await runFile(sql, 'migrations/v2/0005_tasks_confirmed_oversized.sql');

  // 8. Complete RLS policies
  await runFile(sql, 'migrations/v2/0006_complete_rls.sql');

  // 9. Fix find_nearest_niche type
  await runFile(sql, 'migrations/v2/0007_fix_find_nearest_niche_type.sql');

  // 10. uuid default gen_random
  await runFile(sql, 'migrations/v2/0008_uuid_default_gen_random.sql');

  // 11. Schema integrity fixes
  await runFile(sql, 'migrations/v2/0009_schema_integrity_fixes.sql');

  // 12. Copy components approval flow
  await runFile(sql, 'migrations/v2/0010_copy_components_approval_flow.sql');

  // 13. FK: messages.pipeline_id → pipelines.id
  await runFile(sql, 'migrations/v2/0011_add_messages_pipeline_fk.sql');

  // 14. products.platform nullable (remove NOT NULL)
  await runFile(sql, 'migrations/v2/0012_products_platform_nullable.sql');

  // Força reload do schema cache do PostgREST
  console.log('\nReloading PostgREST schema cache…');
  try {
    await sql.unsafe("NOTIFY pgrst, 'reload schema'");
    console.log('  schema cache reload notified.');
  } catch (err) {
    console.warn('  NOTIFY failed (not fatal):', err instanceof Error ? err.message : err);
  }

  await sql.end();
  console.log('\nAll migrations applied.');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
