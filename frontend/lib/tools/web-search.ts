export const WEB_SEARCH_TOOL = {
  name: "search_web",
  description:
    "Realiza busca na web e retorna lista de resultados relevantes. " +
    "Use para pesquisar informações sobre mercados, produtos, concorrentes, " +
    "tendências de nicho e qualquer dado factual externo ao contexto. " +
    "Toda afirmação factual deve ser embasada em resultados desta tool — " +
    "nunca invente dados que deveriam vir de uma busca real.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Consulta de busca. Seja específico — 2 a 6 palavras produzem " +
          "os melhores resultados. " +
          "Exemplos: 'suplemento detox mercado brasil 2024', " +
          "'anúncios emagrecimento facebook concorrentes'.",
      },
      num_results: {
        type: "integer",
        description: "Número de resultados a retornar. Default 5, máximo 10.",
        default: 5,
        minimum: 1,
        maximum: 10,
      },
    },
    required: ["query"],
  },
};

export async function executeSearchWeb(query: string, numResults: number = 5): Promise<any[]> {
  const num = Math.max(1, Math.min(numResults, 10));
  return _mockResults(query, num);
}

function _mockResults(query: string, numResults: number): any[] {
  const q = query.trim();
  const qTitle = q.charAt(0).toUpperCase() + q.slice(1);

  const templates = [
    {
      title: `${qTitle} — Guia Completo 2024`,
      url: "https://exemplo.com/guia-completo",
      snippet: `Tudo o que você precisa saber sobre ${q}. Análise detalhada do mercado, principais players e tendências para 2024.`,
    },
    {
      title: `Mercado de ${qTitle}: Crescimento e Oportunidades`,
      url: "https://mercadoanalytics.com.br/relatorio",
      snippet: `O mercado de ${q} apresentou crescimento de 23% em 2023. Saiba quais produtos lideram as vendas e como se posicionar.`,
    },
    {
      title: `Os Melhores Produtos de ${qTitle} — Ranking Atualizado`,
      url: "https://rankingprodutos.com.br/lista",
      snippet: `Comparativo dos principais produtos de ${q} no mercado brasileiro. Avaliações de consumidores e análise de custo-benefício.`,
    },
    {
      title: `${qTitle}: O que os Consumidores Dizem`,
      url: "https://forum.consumidor.com.br/topico",
      snippet: `Mais de 1.200 comentários sobre ${q}. Experiências reais, reclamações frequentes e recomendações de quem usou.`,
    },
    {
      title: `Como Funciona ${qTitle} — Evidências e Análise`,
      url: "https://saude.portal.com.br/artigo",
      snippet: `Especialistas explicam o mecanismo de ${q} e quais evidências suportam seu uso. Indicações e contraindicações detalhadas.`,
    },
  ];

  return templates.slice(0, numResults);
}
