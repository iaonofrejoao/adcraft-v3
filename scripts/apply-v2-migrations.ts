/**
 * scripts/apply-v2-migrations.ts
 *
 * Aplica as migrations v2 manuais (SQL puro) no Supabase, na ordem correta.
 * Uso: pnpm tsx scripts/apply-v2-migrations.ts
 */

import postgres from 'postgres';
import fs from 'fs';

const DB_URL =
  'postgresql://postgres:2UhYCyYFJxZTn8hF@db.yocbgubxvxpqctbpgpfz.supabase.co:5432/postgres';

async function runFile(sql: postgres.Sql, file: string, splitOnBreakpoint = false) {
  console.log(`\nApplying ${file} …`);
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

  await sql.end();
  console.log('\nAll migrations applied.');
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
