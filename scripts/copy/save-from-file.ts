/**
 * Uso: npx tsx scripts/copy/save-from-file.ts --pipeline-id <uuid> --sku <SKU> --file <path>
 * Alternativa ao save-components.ts para evitar limite de tamanho de linha de comando no Windows.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
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
      'file':        { type: 'string' },
    },
  });

  const pipelineId = values['pipeline-id'];
  const sku        = values['sku'];
  const filePath   = values['file'];

  if (!pipelineId || !sku || !filePath) {
    console.error('Erro: --pipeline-id, --sku e --file são obrigatórios');
    process.exit(1);
  }

  const dataStr = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(dataStr) as {
    hooks?: Array<{ variant_id: string; hook_text: string; hook_type: string; rationale: string }>;
    bodies?: Array<{ variant_id: string; body_short: string; body_long: string; rationale: string }>;
    ctas?: Array<{ variant_id: string; cta_text: string; rationale: string }>;
  };

  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, pipelineId as any));
  if (!pipeline) {
    console.error(`Pipeline ${pipelineId} não encontrado`);
    process.exit(1);
  }

  const version = pipeline.product_version ?? 1;
  const components: Parameters<typeof saveCopyComponents>[0]['components'] = [];

  for (const h of data.hooks ?? []) {
    components.push({
      pipeline_id: pipelineId,
      product_id: pipeline.product_id as string,
      product_version: version,
      component_type: 'hook',
      slot_number: parseInt(h.variant_id.replace('H', '')),
      tag: buildHookTag(sku, version, parseInt(h.variant_id.replace('H', ''))),
      content: h.hook_text,
      rationale: h.rationale,
      register: h.hook_type,
    });
  }

  for (const b of data.bodies ?? []) {
    const slot = parseInt(b.variant_id.replace('B', ''));
    components.push({
      pipeline_id: pipelineId,
      product_id: pipeline.product_id as string,
      product_version: version,
      component_type: 'body',
      slot_number: slot,
      tag: buildBodyTag(sku, version, slot),
      content: b.body_long,
      structure: b.body_short,
      rationale: b.rationale,
    });
  }

  for (const c of data.ctas ?? []) {
    components.push({
      pipeline_id: pipelineId,
      product_id: pipeline.product_id as string,
      product_version: version,
      component_type: 'cta',
      slot_number: parseInt(c.variant_id.replace('C', '')),
      tag: buildCtaTag(sku, version, parseInt(c.variant_id.replace('C', ''))),
      content: c.cta_text,
      rationale: c.rationale,
    });
  }

  await saveCopyComponents({ pipeline_id: pipelineId, components });
  console.log(`Salvos ${components.length} componentes para pipeline ${pipelineId}`);
}

main().catch(e => { console.error(e); process.exit(1); });
