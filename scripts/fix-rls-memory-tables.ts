// Script: fix-rls-memory-tables.ts
// Concede permissões de leitura ao role 'anon' e 'authenticated' nas tabelas de memória.
// O migration 014_learnings_system.sql ativou RLS mas não incluiu GRANT SELECT para anon.
// Sem o GRANT, queries com anon key retornam 0 rows mesmo com policy USING (true).

import * as dotenv from 'dotenv';
import * as path from 'path';
import postgres from 'postgres';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida no .env');

  const sql = postgres(url);

  console.log('\nAplicando GRANTs nas tabelas de memória…\n');

  // Grant SELECT para anon e authenticated poderem ler via frontend
  await sql`GRANT SELECT ON execution_learnings TO anon, authenticated`;
  console.log('  ✓ GRANT SELECT ON execution_learnings TO anon, authenticated');

  await sql`GRANT SELECT ON learning_patterns TO anon, authenticated`;
  console.log('  ✓ GRANT SELECT ON learning_patterns TO anon, authenticated');

  await sql`GRANT SELECT ON insights TO anon, authenticated`;
  console.log('  ✓ GRANT SELECT ON insights TO anon, authenticated');

  // Grant UPDATE em validated_by_user (ações de validação do frontend)
  await sql`GRANT UPDATE (validated_by_user) ON execution_learnings TO anon, authenticated`;
  console.log('  ✓ GRANT UPDATE(validated_by_user) ON execution_learnings');

  await sql`GRANT UPDATE (validated_by_user) ON insights TO anon, authenticated`;
  console.log('  ✓ GRANT UPDATE(validated_by_user) ON insights');

  // Garante que as policies existentes cobrem anon (recria se necessário)
  // Verifica policies atuais
  const policies = await sql`
    SELECT policyname, cmd, roles
    FROM pg_policies
    WHERE tablename IN ('execution_learnings', 'learning_patterns', 'insights')
    ORDER BY tablename, policyname
  `;

  console.log('\nPolicies RLS atuais:');
  for (const p of policies) {
    console.log(`  [${p.tablename ?? '?'}] ${p.policyname} — ${p.cmd} — roles: ${JSON.stringify(p.roles)}`);
  }

  // Se as policies existentes forem apenas para 'authenticated', cria para anon também
  // Verifica se há policy que cubra anon nas 3 tabelas
  const tables = ['execution_learnings', 'learning_patterns', 'insights'];
  for (const table of tables) {
    const existing = policies.filter((p: any) => p.tablename === table);
    const coversAnon = existing.some((p: any) =>
      !p.roles || p.roles.length === 0 || (p.roles as string[]).includes('anon') || (p.roles as string[]).includes('PUBLIC')
    );

    if (!coversAnon) {
      const policyName = `anon_read_${table}`;
      // Drop se existir e recria
      await sql`DROP POLICY IF EXISTS ${sql(policyName)} ON ${sql(table)}`;
      await sql`
        CREATE POLICY ${sql(policyName)}
        ON ${sql(table)}
        FOR SELECT
        TO anon
        USING (true)
      `;
      console.log(`  ✓ Criada policy SELECT TO anon em ${table}`);
    }
  }

  await sql.end();

  console.log('\nConcluído. Teste novamente com anon key.\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
