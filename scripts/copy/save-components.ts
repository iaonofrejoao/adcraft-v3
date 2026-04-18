/**
 * scripts/copy/save-components.ts
 * Salva componentes de copy (hooks, bodies, CTAs) na tabela copy_components.
 *
 * Uso:
 *   npx tsx scripts/copy/save-components.ts \
 *     --pipeline-id <uuid> \
 *     --sku <ABCD> \
 *     --data '<json com hooks[], bodies[], ctas[]>'
 *
 * O campo --sku deve ser as 4 letras maiúsculas do produto (SKU).
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { eq } from 'drizzle-orm';
import { db } from '../../workers/lib/db';
import { pipelines } from '../../frontend/lib/schema/index';
import { saveCopyComponents } from '../../workers/lib/knowledge';
import { buildHookTag, buildBodyTag, buildCtaTag } from '../../workers/lib/tagging';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'pipeline-id': { type: 'string' },
      'sku':         { type: 'string' },
      'data':        { type: 'string' },
    },
  });

  const pipelineId = values['pipeline-id'];
  const sku        = values['sku'];
  const dataStr    = values['data'];

  if (!pipelineId || !sku || !dataStr) {
    console.error('Erro: --pipeline-id, --sku e --data são obrigatórios');
    process.exit(1);
  }

  const data = JSON.parse(dataStr) as {
    hooks?: Array<{ variant_id: string; hook_text: string; hook_type: string; rationale: string }>;
    bodies?: Array<{ variant_id: string; body_short: string; body_long: string; rationale: string }>;
    ctas?: Array<{ variant_id: string; cta_text: string; rationale: string }>;
  };

  // Busca versão do produto a partir do pipeline
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, pipelineId as any));
  if (!pipeline) {
    console.error(`Pipeline ${pipelineId} não encontrado`);
    process.exit(1);
  }

  const version = pipeline.product_version;
  const components: Parameters<typeof saveCopyComponents>[0]['components'] = [];

  // Mapeia hooks
  for (const hook of data.hooks ?? []) {
    const slot = parseInt(hook.variant_id.replace('H', ''));
    components.push({
      component_type: 'hook',
      slot_number: slot,
      tag: buildHookTag(sku, version, slot),
      content: hook.hook_text,
      rationale: hook.rationale,
      register: hook.hook_type,
    });
  }

  // Mapeia bodies
  for (const body of data.bodies ?? []) {
    const slot = parseInt(body.variant_id.replace('B', ''));
    components.push({
      component_type: 'body',
      slot_number: slot,
      tag: buildBodyTag(sku, version, slot),
      content: body.body_long,
      rationale: body.rationale,
      structure: body.body_short,
    });
  }

  // Mapeia CTAs
  for (const cta of data.ctas ?? []) {
    const slot = parseInt(cta.variant_id.replace('C', ''));
    components.push({
      component_type: 'cta',
      slot_number: slot,
      tag: buildCtaTag(sku, version, slot),
      content: cta.cta_text,
      rationale: cta.rationale,
    });
  }

  await saveCopyComponents({
    product_id: pipeline.product_id as string,
    product_version: version,
    pipeline_id: pipelineId,
    components,
  });

  console.log(`✅ ${components.length} componentes salvos (${data.hooks?.length ?? 0} hooks, ${data.bodies?.length ?? 0} bodies, ${data.ctas?.length ?? 0} CTAs)`);
  process.exit(0);
}

main().catch(err => {
  console.error('[save-components] erro:', err);
  process.exit(1);
});
