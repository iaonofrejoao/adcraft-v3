/**
 * scripts/products/fetch-logos.ts
 * Vasculha as URLs dos produtos, extrai a melhor imagem disponível
 * (og:image → twitter:image → apple-touch-icon → favicon .png)
 * e salva em products.logo_url para todos os produtos sem logo.
 *
 * Uso:
 *   npx tsx scripts/products/fetch-logos.ts [--all]
 *
 *   --all   força atualização mesmo em produtos que já têm logo_url
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// ── Config ─────────────────────────────────────────────────────────────────────

const TIMEOUT_MS   = 12_000;
const DELAY_MS     = 600;   // delay entre requests para não sobrecarregar servidores
const USER_AGENT   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveUrl(raw: string, base: string): string | null {
  if (!raw) return null;
  raw = raw.trim().replace(/^['"]+|['"]+$/g, '');
  try {
    return new URL(raw, base).href;
  } catch {
    return null;
  }
}

/** Extrai o melhor candidato de imagem do HTML da página. */
function extractBestImage(html: string, pageUrl: string): string | null {
  // Priority 1: og:image
  const og =
    html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1];
  if (og) return resolveUrl(og, pageUrl);

  // Priority 2: twitter:image
  const tw =
    html.match(/name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i)?.[1];
  if (tw) return resolveUrl(tw, pageUrl);

  // Priority 3: apple-touch-icon
  const appleIcon = html.match(/<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i)?.[1];
  if (appleIcon) return resolveUrl(appleIcon, pageUrl);

  // Priority 4: link rel=icon preferindo .png
  const pngIcon = html.match(/<link[^>]+href=["']([^"']+\.png[^"']*)["'][^>]*rel=["'][^"']*icon[^"']*["']/i)?.[1]
               ?? html.match(/<link[^>]*rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+\.png[^"']*)["']/i)?.[1];
  if (pngIcon) return resolveUrl(pngIcon, pageUrl);

  return null;
}

/** Faz fetch de uma URL com timeout e User-Agent. */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Tenta extrair imagem da página fornecida e, se não encontrar,
 * tenta novamente com a URL raiz do domínio.
 */
async function extractImageWithFallback(productUrl: string): Promise<{ imageUrl: string | null; tried: string[] }> {
  const tried: string[] = [];

  // Tentativa 1: URL original do produto
  const html1 = await fetchPage(productUrl);
  tried.push(productUrl);
  if (html1) {
    const img = extractBestImage(html1, productUrl);
    if (img) return { imageUrl: img, tried };
  }

  // Tentativa 2: root do domínio (útil quando product_url aponta para /text.html ou /vsl)
  try {
    const rootUrl = new URL(productUrl).origin + '/';
    if (rootUrl !== productUrl && rootUrl !== productUrl + '/') {
      const html2 = await fetchPage(rootUrl);
      tried.push(rootUrl);
      if (html2) {
        const img = extractBestImage(html2, rootUrl);
        if (img) return { imageUrl: img, tried };
      }
    }
  } catch {
    // URL inválida — ignora
  }

  return { imageUrl: null, tried };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { values } = parseArgs({ options: { all: { type: 'boolean', default: false } } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_KEY não configurados');
    process.exit(1);
  }
  const supabase = createClient(url, key);

  // Busca produtos com product_url mas sem logo_url (ou todos se --all)
  let query = supabase
    .from('products')
    .select('id, name, sku, product_url, logo_url')
    .not('product_url', 'is', null);

  if (!values.all) {
    query = query.is('logo_url', null);
  }

  const { data: products, error } = await query;
  if (error) { console.error('Erro ao buscar produtos:', error.message); process.exit(1); }
  if (!products || products.length === 0) {
    console.log('Nenhum produto para processar.');
    return;
  }

  console.log(`Processando ${products.length} produto(s)...\n`);

  let updated = 0;
  let skipped = 0;

  for (const product of products) {
    const productUrl: string = product.product_url as string;
    process.stdout.write(`[${product.sku}] ${product.name} — ${productUrl} ... `);

    const { imageUrl, tried } = await extractImageWithFallback(productUrl);
    const triedLabel = tried.length > 1 ? ` (tentou ${tried.length} URLs)` : '';

    if (!imageUrl) {
      console.log(`nenhuma imagem encontrada${triedLabel}`);
      skipped++;
      await sleep(DELAY_MS);
      continue;
    }

    const { error: updateErr } = await supabase
      .from('products')
      .update({ logo_url: imageUrl })
      .eq('id', product.id);

    if (updateErr) {
      console.log(`erro ao salvar: ${updateErr.message}`);
      skipped++;
    } else {
      console.log(`✓ ${imageUrl}`);
      updated++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nConcluído: ${updated} atualizados, ${skipped} ignorados.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
