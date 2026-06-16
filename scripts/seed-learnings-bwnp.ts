// Script: seed-learnings-bwnp.ts
// Insere 8 learnings extraídos manualmente dos artefatos do pipeline BWNP (CitrusBurn v2)
// Pipeline: 3e33995e-a511-44ad-b087-82b4c185c72a
// Produto:  ef90fdf7-8189-4ac2-b7ee-73ff22b8e2c3  (BWNP — CitrusBurn v2)
// Nicho:    c92f9d70-1974-48ac-aa95-fda4a65cdac7  (weight loss supplements)

import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const PIPELINE_ID = '3e33995e-a511-44ad-b087-82b4c185c72a';
const PRODUCT_ID  = 'ef90fdf7-8189-4ac2-b7ee-73ff22b8e2c3';
const NICHE_ID    = 'c92f9d70-1974-48ac-aa95-fda4a65cdac7';

interface Learning {
  category:    'angle' | 'copy' | 'persona' | 'creative' | 'targeting' | 'compliance' | 'other';
  observation: string;
  evidence:    Record<string, unknown>;
  confidence:  number;
}

const LEARNINGS: Learning[] = [
  {
    category: 'angle',
    observation: 'O mecanismo "Thermogenic Resistance" (desensibilização do receptor beta3-adrenérgico) é um ângulo completamente novo e não reclamado no nicho de suplementos para perda de peso em 2026. BAT (Exipure/Puravive) e mitocôndria (Mitolyn) estão saturados; o receptor beta3-AR é o próximo mecanismo diferenciador com janela de 12–18 meses de vantagem.',
    evidence: {
      source_agent: 'angles',
      pipeline_id: PIPELINE_ID,
      usp: 'CitrusBurn é o único termogênico que trata Thermogenic Resistance — reativando receptores beta3-adrenérgicos desensibilizados com p-sinefrina de casca de laranja de Sevilha',
      competitors_saturated: ['BAT (Exipure 2021, Puravive 2023)', 'mitocôndria (Mitolyn 2024)'],
      angle_rationale: 'betrayed_authority — explora simultaneamente: mecanismo fresco, exposição do fake spokesperson Mitolyn, e transferência de culpa de willpower para biologia',
    },
    confidence: 0.9,
  },
  {
    category: 'persona',
    observation: 'A persona primária do nicho de perda de peso para mulheres 40+ é "Jennifer" (40–54 anos, Midwest/Southeast EUA, $55–95k renda familiar). Ela já tentou keto, IF, Hydroxycut, ACV shots e garcinia sem resultado. O gatilho emocional mais alto é Vindication — transferir a culpa da falta de willpower para um mecanismo biológico documentado. Expressões verbatim de alto impacto: "I ordered 6 bottles and the only thing I lost was my money."',
    evidence: {
      source_agent: 'avatar',
      pipeline_id: PIPELINE_ID,
      age_range: '40–54',
      location: 'Suburban USA — Midwest / Southeast',
      occupation: 'Administrative manager, nurse, teacher, real estate agent',
      income_range: '$55,000–$95,000/year household',
      tried_before: ['Keto', 'IF', 'Hydroxycut', 'ACV shots', 'Garcinia Cambogia'],
      primary_emotional_trigger: 'Vindication',
      top_verbatim: 'I ordered 6 bottles and the only thing I lost was my money',
    },
    confidence: 0.88,
  },
  {
    category: 'targeting',
    observation: 'No Facebook, o interesse stack mais eficaz para mulheres 40–60 EUA no nicho de perda de peso combina: Weight loss + Keto diet + Intermittent fasting + Menopause + Thyroid health + Dr. Oz + WW (Weight Watchers) + Hydroxycut, com filtro de renda Top 50%. Mitolyn validou esse segmento com 200+ anúncios ativos, confirmando a responsividade da audiência.',
    evidence: {
      source_agent: 'campaign_strategy',
      pipeline_id: PIPELINE_ID,
      platform: 'facebook',
      validated_by_competitor: 'Mitolyn (200+ ads ativos no mesmo targeting)',
      interest_stack: ['Weight loss', 'Keto diet', 'IF', 'Menopause', 'Dr. Oz', 'WW', 'Hydroxycut'],
      income_filter: 'Top 50% household income',
      best_schedule: '9 PM–midnight US local time (janela de decisão de Jennifer)',
    },
    confidence: 0.85,
  },
  {
    category: 'copy',
    observation: 'Copy de body que abre com expressão verbatim da persona (ex.: "I ordered 6 bottles and the only thing I lost was my money") supera copy de educação de mecanismo no Creative Director scoring (94/100 vs 88/100). O espelhamento do estado emocional da persona no início do body cria identificação imediata e maximiza hold rate nos primeiros 15 segundos.',
    evidence: {
      source_agent: 'creative_brief',
      pipeline_id: PIPELINE_ID,
      top_combination: 'CITB_v1_H1_B2_C3',
      top_combination_score: 94,
      runner_up: 'CITB_v1_H1_B1_C3',
      runner_up_score: 88,
      winning_element: 'B2 — abre com verbatim "I ordered 6 bottles and the only thing I lost was my money"',
      vs_mechanism_education: 'B1 performa bem em credibilidade científica, mas perde em identificação emocional imediata',
    },
    confidence: 0.92,
  },
  {
    category: 'creative',
    observation: 'A garantia de 180 dias (vs. 90 dias do Mitolyn) é o maior diferenciador de confiança neste nicho e deve aparecer explicitamente em criativos de BoFu. Enquadrar a garantia como "prova do mecanismo" — não como promessa de marketing — converte melhor: "O Mitolyn oferece 90 dias. CitrusBurn oferece 180. A diferença é confiança no mecanismo."',
    evidence: {
      source_agent: 'facebook_ads',
      pipeline_id: PIPELINE_ID,
      bofu_ad_primary_text: 'Two supplements. One gives 90 days. CitrusBurn gives 180. The difference is confidence in the mechanism.',
      competitor_gap: 'Mitolyn 90-day + histórico de abuso de política de reembolso documentado',
      benchmark_finding: 'gap de garantia identificado como exploitável vs. Mitolyn',
    },
    confidence: 0.9,
  },
  {
    category: 'targeting',
    observation: 'Google Search com queries de sintoma ("why can\'t I lose weight after 40", "perimenopause belly fat", "weight loss not working over 40") é um canal competitivo de baixo custo neste nicho em 2026: Mitolyn concentra 200+ anúncios no Facebook mas negligencia Search. CPCs esperados abaixo do máximo de $1.20 com menor competição.',
    evidence: {
      source_agent: 'campaign_strategy',
      pipeline_id: PIPELINE_ID,
      platform: 'google_search',
      competitive_gap: 'Mitolyn ausente de Google Search (confirmado por benchmark)',
      top_keyword_categories: [
        'why cant i lose weight after 40',
        'perimenopause belly fat supplement',
        'slow metabolism after 40 women',
        'fat burning supplement no jitters women',
      ],
      max_cpc_usd: 1.2,
      strategy: 'bridge page para compliance com Google Healthcare policy',
    },
    confidence: 0.82,
  },
  {
    category: 'compliance',
    observation: 'Facebook proíbe explicitamente imagens antes/depois em anúncios de perda de peso. Toda copy deve usar linguagem de possibilidade ("may help", "people report", "clinically studied"). Disclaimers FTC ("Individual results may vary. Testimonial results not typical.") são obrigatórios a nível de placement — não de copy. Violar essa regra em criativos gera rejeição imediata; o risco de rejeição na categoria é de 15–30% na primeira submissão.',
    evidence: {
      source_agent: 'compliance_results',
      pipeline_id: PIPELINE_ID,
      facebook_policy_violations_found: 0,
      critical_rules: [
        'Nenhuma imagem before/after',
        'Nenhuma claim de resultado garantido',
        'FTC disclaimer obrigatório para copy com tom testimonial (B1, B2)',
      ],
      approved_combinations: 27,
      rejected_combinations: 0,
      risk_note: 'H3 com números específicos ("1,200 calories... gained 8 pounds") tem risco 10–20% de rejeição',
    },
    confidence: 0.95,
  },
  {
    category: 'other',
    observation: 'Campanhas de afiliado ClickBank no Google Search para suplementos requerem certificação LegitScript pela política Google Healthcare and Medicines. Ativar campanhas de Search sem verificar essa certificação causa suspensão imediata. É o bloqueador pré-lançamento mais crítico para o canal Search neste nicho.',
    evidence: {
      source_agent: 'performance_report',
      pipeline_id: PIPELINE_ID,
      platform: 'google_search',
      policy_reference: 'Google Healthcare and Medicines policy',
      action_required: 'Verificar certificação LegitScript para conta de afiliado ClickBank antes de ativar campanhas Search',
      priority: 'high',
      risk: 'Suspensão imediata de campanha',
    },
    confidence: 0.95,
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb  = createClient(url!, key!);

  console.log(`\nInserindo ${LEARNINGS.length} learnings para pipeline ${PIPELINE_ID.slice(0, 8)}…\n`);

  let saved = 0;
  const learningIds: string[] = [];

  for (const l of LEARNINGS) {
    const learningId = randomUUID();
    learningIds.push(learningId);

    const { error: lErr } = await sb.from('execution_learnings').insert({
      id:          learningId,
      pipeline_id: PIPELINE_ID,
      product_id:  PRODUCT_ID,
      niche_id:    NICHE_ID,
      category:    l.category,
      observation: l.observation,
      evidence:    l.evidence,
      confidence:  l.confidence,
      status:      'active',
    });

    if (lErr) {
      console.error(`  ✗ [${l.category}] ${l.observation.slice(0, 60)}… — ERRO: ${lErr.message}`);
      continue;
    }

    // Enfileira embedding
    const { error: eErr } = await sb.from('embeddings').insert({
      id:           randomUUID(),
      source_table: 'execution_learnings',
      source_id:    learningId,
    });

    if (eErr) {
      console.warn(`  ⚠ embedding enqueue falhou para ${learningId.slice(0, 8)}: ${eErr.message}`);
    }

    saved++;
    console.log(`  ✓ [${l.category}] conf=${l.confidence} — ${l.observation.slice(0, 80)}…`);
  }

  console.log(`\nConcluído: ${saved}/${LEARNINGS.length} learnings inseridos.`);

  // Verifica contagem final
  const { count } = await sb
    .from('execution_learnings')
    .select('*', { count: 'exact', head: true })
    .eq('pipeline_id', PIPELINE_ID);

  console.log(`execution_learnings para este pipeline: ${count}`);

  process.exit(0);
}

main().catch((e) => {
  console.error('ERRO fatal:', e.message);
  process.exit(1);
});
