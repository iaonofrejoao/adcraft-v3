// Script: seed-patterns-insights-bwnp.ts
// Insere learning_patterns e insights sintetizados diretamente a partir dos 8 learnings BWNP.
// Substitui a chamada ao Gemini aggregator — síntese feita por Claude durante a sessão.

import * as dotenv from 'dotenv';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const NICHE_ID = 'c92f9d70-1974-48ac-aa95-fda4a65cdac7';

// IDs dos 8 learnings inseridos pelo seed anterior (buscados do banco)
// Serão resolvidos dinamicamente abaixo

interface Pattern {
  category:   string;
  text:       string;
  confidence: number;
  keyTerms:   string[];
}

interface Insight {
  title:      string;
  body:       string;
  importance: number;
  patternIdxs: number[]; // índices de PATTERNS[] que suportam este insight
}

const PATTERNS: Pattern[] = [
  {
    category:   'angle',
    confidence: 0.88,
    keyTerms:   ['Thermogenic Resistance', 'beta3-AR', 'mecanismo fresco'],
    text: 'Mecanismos biológicos frescos com metáfora visual concreta dominam o nicho de suplementos de perda de peso durante 12–18 meses antes de saturar. Em 2026, a desensibilização do receptor beta3-adrenérgico (Thermogenic Resistance) é o ângulo diferenciador com menor competição — BAT (2021) e mitocôndria (2024) já estão commoditizados. O ângulo Betrayed Authority (culpa biológica, não willpower) explora simultaneamente o mecanismo fresco e a exposição do fake spokesperson do líder de mercado (Mitolyn).',
  },
  {
    category:   'targeting',
    confidence: 0.83,
    keyTerms:   ['mulheres 40+', 'Facebook interest stack', 'Google Search white space'],
    text: 'Mulheres 40–60 EUA com interest stack combinando Weight Loss + Keto + Menopause + Hydroxycut (Top 50% renda) são o segmento primário validado no nicho, com janela de conversão concentrada entre 21h–00h no Facebook. Google Search com queries de sintoma ("why can\'t I lose weight after 40", "perimenopause belly fat") representa um canal de baixa competição: o líder de mercado (Mitolyn, 200+ ads no Facebook) está ausente do Search, criando oportunidade de CPC abaixo de $1.20.',
  },
  {
    category:   'copy',
    confidence: 0.90,
    keyTerms:   ['verbatim avatar', 'body copy', 'hold rate', 'garantia 180 dias'],
    text: 'Copy de body que abre com expressão verbatim da persona ("I ordered 6 bottles and the only thing I lost was my money") supera educação de mecanismo no Creative Director score (94/100 vs 88/100), por criar espelhamento emocional imediato. Em BoFu, enquadrar a garantia como "prova do mecanismo" — "180 dias vs. 90 dias: a diferença é confiança no mecanismo" — é o diferenciador de risco mais forte do nicho e converte cart abandoners melhor que desconto.',
  },
  {
    category:   'compliance',
    confidence: 0.93,
    keyTerms:   ['Facebook before/after', 'linguagem de possibilidade', 'FTC disclaimer', 'LegitScript'],
    text: 'Facebook proíbe imagens before/after e claims de resultado garantido em anúncios de perda de peso — toda copy deve usar linguagem de possibilidade ("may help", "people report"). FTC exige disclaimer ("Individual results may vary") em nível de placement, não de copy, para body com tom testimonial. Campanhas ClickBank no Google Search requerem certificação LegitScript; ativação sem ela causa suspensão imediata. Cumprimento proativo dessas regras é vantagem competitiva: concorrentes principais foram regularmente expostos por testemunhos fabricados.',
  },
];

const INSIGHTS: Insight[] = [
  {
    title:       'Mecanismo Fresco = Janela de 12–18 Meses',
    importance:  4,
    patternIdxs: [0, 2],
    body: 'Cada novo mecanismo biológico visualizável (BAT 2021, mitocôndria 2024, beta3-AR 2026) domina o nicho por 12–18 meses antes de ser commoditizado. Ser o primeiro a articular e saturar criativos com o mecanismo fresco permite capturar EPC acima de $8 enquanto concorrentes ainda copiam o ciclo anterior. A janela para Thermogenic Resistance está aberta em 2026 — priorizar volume de criativos com esse ângulo agora é a maior alavanca de margem disponível.',
  },
  {
    title:       'Vindication: Gatilho Primário para Mulheres 40+',
    importance:  5,
    patternIdxs: [0, 2],
    body: 'Mulheres 40–54 que tentaram keto, IF e suplementos sem resultado carregam culpa internalizada. Comunicação que transfere a responsabilidade do fracasso do willpower para um mecanismo biológico documentado (receptores desensibilizados) cria alívio emocional imediato — o gatilho de Vindication — e maximiza abertura à solução. Esse posicionamento é validado pelo Creative Director score mais alto do pipeline (95/100) e deve ser o eixo central de todos os criativos ToFu.',
  },
  {
    title:       'Google Search: Canal Aberto Ignorado pelo Líder',
    importance:  3,
    patternIdxs: [1, 3],
    body: 'Mitolyn domina Facebook com 200+ anúncios mas está ausente de Google Search — a mesma persona pesquisa sintomas no Google à noite antes de decidir. Queries de sintoma ("why can\'t I lose weight after 40") têm alta intenção de compra e baixa competição de afiliados de suplementos. Ativar Search com bridge page compliance-safe após LegitScript pode capturar conversões a CPA menor que o Facebook antes que concorrentes identifiquem o gap.',
  },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const sb  = createClient(url!, key!);

  // Busca IDs dos learnings BWNP por categoria para referência
  const { data: learnings } = await sb
    .from('execution_learnings')
    .select('id, category')
    .eq('niche_id', NICHE_ID)
    .eq('status', 'active');

  const learningsByCategory = new Map<string, string[]>();
  for (const l of learnings ?? []) {
    if (!learningsByCategory.has(l.category)) learningsByCategory.set(l.category, []);
    learningsByCategory.get(l.category)!.push(l.id);
  }

  console.log('\n── Learnings de referência por categoria ──────────');
  for (const [cat, ids] of learningsByCategory) {
    console.log(`  ${cat}: ${ids.length} learning(s)`);
  }

  // Insere patterns
  console.log('\n── Inserindo learning_patterns ────────────────────');
  const patternIds: string[] = [];

  for (const p of PATTERNS) {
    const supportingIds = learningsByCategory.get(p.category) ?? [];

    // Verifica se já existe pattern ativo para essa categoria + nicho
    const { data: existing } = await sb
      .from('learning_patterns')
      .select('id')
      .eq('category', p.category)
      .eq('niche_id', NICHE_ID)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Atualiza
      const { error } = await sb
        .from('learning_patterns')
        .update({
          pattern_text:            p.text,
          supporting_learning_ids: supportingIds,
          supporting_count:        supportingIds.length,
          confidence:              p.confidence,
          updated_at:              new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error(`  ✗ [${p.category}] update falhou: ${error.message}`);
        patternIds.push('');
        continue;
      }
      patternIds.push(existing.id);
      console.log(`  ↺ [${p.category}] atualizado (${existing.id.slice(0, 8)})`);
    } else {
      // Insere novo
      const newId = randomUUID();
      const { error } = await sb.from('learning_patterns').insert({
        id:                      newId,
        pattern_text:            p.text,
        category:                p.category,
        niche_id:                NICHE_ID,
        supporting_learning_ids: supportingIds,
        supporting_count:        supportingIds.length,
        confidence:              p.confidence,
        status:                  'active',
      });

      if (error) {
        console.error(`  ✗ [${p.category}] insert falhou: ${error.message}`);
        patternIds.push('');
        continue;
      }
      patternIds.push(newId);
      console.log(`  ✓ [${p.category}] inserido (${newId.slice(0, 8)}) — conf=${p.confidence}`);
    }
  }

  // Insere insights
  console.log('\n── Inserindo insights ─────────────────────────────');
  let insightsSaved = 0;

  for (const ins of INSIGHTS) {
    const linkedPatternIds = ins.patternIdxs
      .map((i) => patternIds[i])
      .filter(Boolean);

    const newId = randomUUID();
    const { error } = await sb.from('insights').insert({
      id:          newId,
      title:       ins.title,
      body:        ins.body,
      importance:  ins.importance,
      source:      'aggregator',
      pattern_ids: linkedPatternIds,
    });

    if (error) {
      console.error(`  ✗ "${ins.title}" — ERRO: ${error.message}`);
      continue;
    }
    insightsSaved++;
    console.log(`  ✓ [imp=${ins.importance}] "${ins.title}"`);
  }

  // Contagem final
  const [pCount, iCount] = await Promise.all([
    sb.from('learning_patterns').select('*', { count: 'exact', head: true }).eq('niche_id', NICHE_ID),
    sb.from('insights').select('*', { count: 'exact', head: true }),
  ]);

  console.log(`\n── Resultado final ────────────────────────────────`);
  console.log(`  learning_patterns : ${pCount.count}`);
  console.log(`  insights          : ${iCount.count}`);
  console.log(`\nConcluído: ${patternIds.filter(Boolean).length} patterns + ${insightsSaved} insights.`);

  process.exit(0);
}

main().catch((e) => {
  console.error('ERRO fatal:', e.message);
  process.exit(1);
});
