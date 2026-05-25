/**
 * scripts/pipeline/record-tokens.ts
 * Registra o uso de tokens de um agente e atualiza o agregado do pipeline.
 *
 * Uso (após cada agente concluir):
 *   npx tsx scripts/pipeline/record-tokens.ts \
 *     --task-id   <uuid> \
 *     --total     <n>          # total_tokens do bloco <usage> do agente
 *     [--input    <n>]         # input_tokens (opcional)
 *     [--output   <n>]         # output_tokens (opcional)
 *     [--model    <model-id>]  # padrão: claude-sonnet-4-6
 *
 * Preços (USD por 1M tokens) — atualizar conforme nova tabela de preços Anthropic:
 *   claude-sonnet-4-6  → input $3.00 / output $15.00
 *   claude-opus-4-7    → input $15.00 / output $75.00
 *   claude-haiku-4-5   → input $0.80 / output $4.00
 *
 * Se apenas total_tokens for fornecido, estima custo com razão 80/20 input/output.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { parseArgs } from 'node:util';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../workers/lib/db';
import { tasks, pipelines } from '../../frontend/lib/schema/index';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/* ── Pricing table ──────────────────────────────────────────────────── */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6':          { input: 3.00,  output: 15.00 },
  'claude-opus-4-7':            { input: 15.00, output: 75.00 },
  'claude-haiku-4-5':           { input: 0.80,  output:  4.00 },
  'claude-haiku-4-5-20251001':  { input: 0.80,  output:  4.00 },
}

const DEFAULT_MODEL = 'claude-sonnet-4-6'

function calcCost(inputTok: number, outputTok: number, model: string): number {
  const price = PRICING[model] ?? PRICING[DEFAULT_MODEL]
  return (inputTok * price.input + outputTok * price.output) / 1_000_000
}

/* ── Main ───────────────────────────────────────────────────────────── */
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'task-id': { type: 'string' },
      'total':   { type: 'string' },
      'input':   { type: 'string' },
      'output':  { type: 'string' },
      'model':   { type: 'string' },
    },
  })

  const taskId = values['task-id']
  if (!taskId) { console.error('Erro: --task-id é obrigatório'); process.exit(1) }

  const totalTok  = values['total']  ? parseInt(values['total'])  : null
  const inputTok  = values['input']  ? parseInt(values['input'])  : null
  const outputTok = values['output'] ? parseInt(values['output']) : null
  const model     = values['model']  ?? DEFAULT_MODEL

  if (!totalTok && inputTok == null) {
    console.error('Erro: forneça --total ou --input + --output'); process.exit(1)
  }

  // Resolve tokens
  const resolvedInput  = inputTok  ?? Math.round((totalTok ?? 0) * 0.80)
  const resolvedOutput = outputTok ?? Math.round((totalTok ?? 0) * 0.20)
  const resolvedTotal  = totalTok  ?? (resolvedInput + resolvedOutput)
  const costUsd        = calcCost(resolvedInput, resolvedOutput, model)

  // Busca task para obter pipeline_id
  const [task] = await db.select({ id: tasks.id, pipeline_id: tasks.pipeline_id })
    .from(tasks).where(eq(tasks.id, taskId as any))
  if (!task) { console.error(`Task ${taskId} não encontrada`); process.exit(1) }

  // Atualiza task
  await db.update(tasks).set({
    input_tokens:  resolvedInput,
    output_tokens: resolvedOutput,
    total_tokens:  resolvedTotal,
    cost_usd:      costUsd.toFixed(6) as any,
    model_used:    model,
  }).where(eq(tasks.id, taskId as any))

  // Atualiza agregado do pipeline
  await db.update(pipelines).set({
    total_tokens:   sql`COALESCE(total_tokens, 0) + ${resolvedTotal}`,
    total_cost_usd: sql`COALESCE(total_cost_usd, 0) + ${costUsd.toFixed(6)}`,
  }).where(eq(pipelines.id, task.pipeline_id as any))

  console.log(`tokens: ${resolvedTotal.toLocaleString()} (in: ${resolvedInput.toLocaleString()} / out: ${resolvedOutput.toLocaleString()}) | custo: $${costUsd.toFixed(4)} | modelo: ${model}`)
  process.exit(0)
}

main().catch(e => { console.error('[record-tokens] erro:', e); process.exit(1) })
