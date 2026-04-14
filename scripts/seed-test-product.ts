/**
 * scripts/seed-test-product.ts
 *
 * Cadastra um produto de teste chamando a API real POST /api/products.
 * Imprime o SKU gerado no console ao final.
 *
 * Pré-requisitos:
 *   - Next.js dev server rodando em http://localhost:3000
 *   - frontend/.env.local com SUPABASE_URL, SUPABASE_SERVICE_KEY, GEMINI_API_KEY
 *
 * Uso:
 *   pnpm tsx scripts/seed-test-product.ts
 */

import { createClient } from '@supabase/supabase-js';

const API_BASE = process.env.NEXT_PUBLIC_API_URL_LOCAL ?? 'http://localhost:3000';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY
  ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error(
    'SUPABASE_URL e SUPABASE_SERVICE_KEY devem estar no .env'
  );
}

// UUID fixo para o usuário de teste
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

async function ensureTestUser() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await sb
    .from('users')
    .upsert(
      { id: TEST_USER_ID, email: 'seed-test@adcraft.local', name: 'Seed Test User' },
      { onConflict: 'id', ignoreDuplicates: true }
    );
  if (error) {
    console.error('[WARN] Não foi possível criar usuário de teste:', error.message);
    console.error('       Certifique-se de que o users.id existe no banco.');
  } else {
    console.log('  Usuário de teste garantido (id:', TEST_USER_ID, ')');
  }
}

const payload = {
  user_id:            TEST_USER_ID,
  name:               'Mitolyn – Metabolic Blend',
  platform:           'clickbank' as const,
  product_url:        'https://mitolyn.com/',
  affiliate_link:     'https://mitolyn.com/?hop=test',
  commission_percent: 75,
  ticket_price:       59,
  target_country:     'US',
  target_language:    'en-US',
  vsl_url:            null,
};

async function main() {
  console.log('Garantindo usuário de teste no banco …');
  await ensureTestUser();

  console.log(`\nPosting to ${API_BASE}/api/products …`);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  const res = await fetch(`${API_BASE}/api/products`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });

  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error('\n[ERRO] A API retornou status', res.status, 'com body não-JSON:');
    console.error(text || '(body vazio)');
    console.error('\nDica: verifique se o Next.js dev server foi reiniciado após criar frontend/.env.local');
    process.exit(1);
  }

  if (!res.ok) {
    console.error('\n[ERRO] A API retornou status', res.status);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log('\n[OK] Produto criado com sucesso:');
  console.log(JSON.stringify(body, null, 2));
  console.log('\n✔ SKU gerado:', body.sku ?? '(nulo — trigger não rodou?)');
  console.log('  niche_id  :', body.niche_id ?? '(classificação async pendente)');
}

main().catch((err) => {
  console.error('\n[FATAL]', err);
  process.exit(1);
});
