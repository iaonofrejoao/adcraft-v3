Vou explicar a estrutura completa com base no que foi analisado. É um sistema bem coeso — deixa eu montar o mapa mental.

  ---
  A lógica central: pipeline de manufatura

  Pensa no sistema como uma linha de produção em 3 fases sequenciais. O produto entra como insumo bruto (URL da VSL + dados básicos) e sai como   uma campanha completa pronta para ir ao ar. Cada agente é uma estação que transforma o que recebeu e passa adiante.

  PRODUTO (product_id + target_country)
          ↓
    [ FASE 1: PESQUISA ]
          ↓
    [ FASE 2: CRIATIVO ]
          ↓
    [ FASE 3: LANÇAMENTO ]
          ↓
    CAMPANHA NO AR

  ---
  Fase 1 — Pesquisa (Agentes 1 a 6)

  O objetivo desta fase é entender o mercado antes de criar qualquer coisa.

  Agente 1 — VSL Analysis
     "Lê a página de vendas e extrai o DNA do produto"
     → product_name, main_promise, ticket, mecanismo, oferta, garantia
     → Todos os outros agentes partem daqui
           ↓
     ┌─────┴──────┐
     ↓            ↓
  Agente 2     Agente 3
  Market       Avatar
  Research     Research
  "Como está    "Quem é o
   o mercado?"  comprador?"
     ↓            ↓
  Agente 4 ←──────┘
  Benchmark Intelligence
  "O que os concorrentes estão fazendo?"
           ↓
  Agente 5
  Angle Generator
  "Qual é o posicionamento diferente que vamos usar?"
           ↓
  Agente 6
  Campaign Strategy
  "Onde, para quem, com quanto budget?"

  Fluxo de dependências explicado:
  - VSL Analysis não depende de ninguém — é a porta de entrada
  - Market Research e Avatar Research rodam em paralelo (só precisam do produto)
  - Benchmark Intelligence espera o Market Research terminar (precisa saber o nível de concorrência)
  - Angle Generator espera os 4 anteriores — ele sintetiza tudo para criar o posicionamento
  - Campaign Strategy fecha a fase pesquisa definindo o plano de execução

  ---
  Fase 2 — Criativo (Agentes 7 a 12)

  Com a estratégia definida, a fase criativa produz os materiais do anúncio.

           Agente 7          Agente 8         Agente 9
         Script Writer      Copywriting    Character Generator
       "Escreve o roteiro  "Escreve hooks,  "Define o personagem
        do vídeo cena       bodies e CTAs"   visual do criativo"
        a cena"
             |                   |                  |
             |                   |                  ↓
             |                   |           Agente 10
             |                   |         Keyframe Generator
             |                   |       "Transforma cada cena
             |                   |        em prompt p/ VEO 3"
             ↓                   |                  |
          Agente 11 ←────────────┘──────────────────┘
          Video Maker
      "Monta o storyboard final integrando
       roteiro + keyframes + copy aprovada"
             ↓
          Agente 12
        Creative Director
     "Avalia tudo, ranqueia combinações,
      aprova ou bloqueia para produção"

  O detalhe crítico desta fase: O Creative Director é o único filtro antes do lançamento. Ele pontua cada combinação (Hook × Body × CTA) de 0 a   100 e emite approved_for_production: true/false. Se bloquear, o pipeline volta para o agente indicado (máximo 2 tentativas).

  ---
  Fase 3 — Lançamento (Agentes 13 a 18)

  Com o pacote criativo aprovado, a fase de lançamento prepara e executa a campanha.

  Agente 13                    Agente 14
  Compliance Check             UTM Builder
  "Audita copy contra          "Gera os links
   políticas FTC/ASA/CONAR"     rastreados por criativo"
        |                             |
        └──────────────┬──────────────┘
                       ↓
           ┌───────────┴───────────┐
           ↓                       ↓
     Agente 15               Agente 16
     Facebook Ads             Google Ads
     "Monta estrutura         "Monta estrutura
      de campanha Meta"        de campanha Google"
           └───────────┬───────────┘
                       ↓
                 Agente 17
             Performance Analysis
           "Analisa dados reais após
            campanha ir ao ar"
                       ↓
                 Agente 18
             Scaling Strategy
           "Define o plano de escala:
            pausar, aumentar, testar"

  O detalhe crítico desta fase: O Compliance e o UTM Builder rodam em paralelo — são independentes. Facebook e Google Ads só podem usar        
  combinações que o Compliance aprovou (approved_combinations). Se o Compliance bloqueou o criativo principal, eles automaticamente caem para o   próximo da fila.

  ---
  A espinha dorsal: como o contexto flui

  Cada agente grava seu output no banco como um artefato (product_knowledge). O próximo agente lê esse artefato como input. É como um
  "passa-e-pega" estruturado:

  VSL Analysis → salva artifact_type: "product"
      ↓
  Market Research lê "product" → salva artifact_type: "market"
      ↓
  Benchmark Intelligence lê "market" → salva artifact_type: "benchmark"
      ↓
  Angle Generator lê "product" + "avatar" + "market" + "benchmark"
  → salva artifact_type: "angles"
      ...e assim por diante

  Todo agente tem seu artifact_type fixo. Nunca há ambiguidade sobre quem produziu o quê.

  ---
  Os 3 loops de revisão

  O pipeline não é linear de forma rígida — tem pontos de retorno:

  Loop 1 — Creative Director bloqueia:
  Creative Director diz "não aprovado"
    → identifica qual agente refazer (copywriting? script_writer?)
    → re-invoca aquele agente com o mesmo pipeline_id
    → artefato anterior vira status 'superseded'
    → Creative Director avalia de novo
    → máximo 2 tentativas, depois escala para o usuário

  Loop 2 — Compliance bloqueia a combinação principal:
  Compliance rejeita top_combination
    → Facebook/Google pegam a próxima combinação aprovada
    → Se approved_combinations vazia → pipeline trava, aguarda usuário

  Loop 3 — Scaling: todos os criativos são losers:
  Performance Analysis: todos criativos com hook_rate < 15% por 14 dias
    → Scaling Strategy sinaliza
    → Cria um novo pipeline criativo filho (--type criativo)
    → Reutiliza pesquisa do pipeline pai
    → Vai direto para Fase 2 com novo ângulo

  ---
  O filtro de mercado que atravessa tudo

  Quando você cadastra um produto com target_country: US e target_language: en-US, esse par é injetado no prompt de todo agente como um bloco  
  de contexto obrigatório:

  ## Mercado-alvo do produto
  - target_country: US
  - target_language: en-US

  Isso faz com que:
  - Market Research pesquisa no mercado americano (ClickBank, Trustpilot, Reddit US)
  - Avatar Research constrói perfil de comprador americano
  - Compliance aplica FTC (não ANVISA)
  - Copywriting escreve em inglês americano
  - Facebook Ads configura countries: ["US"]
  - Google Ads gera keywords em inglês, sem negativar "Portugal/Angola"

  Um único campo no banco propaga comportamento diferente por toda a cadeia.

  ---
  O papel do Claude Code (você, conversando com ele)

  O Claude Code é o orquestrador — não é um dos 18 agentes, é quem os spawna na ordem certa. Quando você diz "roda pipeline para o produto X", 
  o Claude:

  1. Lê o full-pipeline.yaml para saber a ordem e dependências
  2. Busca no banco os learnings vetoriais do nicho (memória cumulativa)
  3. Spawna cada agente como subagente com o skill file + artefatos dos anteriores
  4. Gerencia os loops de revisão
  5. Grava artefatos no banco via scripts
  6. Ao final, extrai learnings para a memória do nicho

  ---
  Em resumo: é um pipeline de manufatura com memória cumulativa, filtro de mercado transversal, 3 pontos de retorno controlados e um
  orquestrador central (Claude Code) que mantém o estado no banco. Cada agente é especializado, stateless e intercambiável — o estado vive no  
  banco, não no agente.