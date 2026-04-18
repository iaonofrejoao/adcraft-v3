/**
 * scripts/copy/update-compliance.ts
 * Atualiza o compliance_status de componentes de copy na tabela copy_components.
 *
 * Uso:
 *   npx tsx scripts/copy/update-compliance.ts \
 *     --results '[{"tag":"ABCD_v1_H1","status":"approved","violations":null}, ...]'
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { updateComplianceStatus } from '../../workers/lib/knowledge';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { 'results': { type: 'string' } },
  });

  if (!values['results']) {
    console.error('Erro: --results é obrigatório (JSON array)');
    process.exit(1);
  }

  const results = JSON.parse(values['results']) as Array<{
    tag: string;
    status: 'approved' | 'rejected';
    violations: any;
  }>;

  await updateComplianceStatus({ results });

  const approved = results.filter(r => r.status === 'approved').length;
  const rejected = results.filter(r => r.status === 'rejected').length;
  console.log(`✅ Compliance atualizado: ${approved} aprovados, ${rejected} rejeitados`);
  process.exit(0);
}

main().catch(err => {
  console.error('[update-compliance] erro:', err);
  process.exit(1);
});
