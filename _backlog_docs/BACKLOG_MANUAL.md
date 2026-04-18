1 - Não está adicionando produtos na tela de produtos
2 - Subir a VSL para insumo do produto
3 - http://localhost:3000/demandas?view=kanban quero poder clicar em qualquer demanda da lista ou do Kanban e abrir um popup para ver os detalhes da demanda
4 - Melhorar informações do card de produto na tela. Inserir nota, e icones indicando se já possuem estudo de mercado, avatar, copy, video, etc. http://localhost:3000/products. Retirar botão de criar copy e copies
5 - Pertimir editar nome do produto e botão para ativar e desativar o produto http://localhost:3000/products
6 - Tornar o jarvis menos chegado
7 - http://localhost:3000/products/PCFU/copies nessa página o menu que antes existia nessa tela http://localhost:3000/products/PCFU/copies (Mercado, Personas, Copy, Criativos, Campanhas, Histórico) sumiu
8 - quando o chat retorna algo do tipo "Pipeline em execução! 1 tasks enfileiradas. Acompanhe o progresso em /demandas?pipeline=c039c35e-8e61-4f29-9c7c-6bd05a3d4b24." quero que ele me mande um hyper link com o nome da demanda para que eu possa clicar e ver o progresso. Exemplo: "Pipeline em execução! 1 tasks enfileiradas. Acompanhe o progresso em [nome da demanda]".
9 - Não aplicou componentes do Shadcn em nenhuma página

--------------------------


10 - Opção de escolher o país que vai rodar aquele produto par que todos os materiais sejam gerados naquele idioma e com as devidas adaptações culturais.
11 - Adição de filtros úteis em cada tela
12 - Ao clicar no lápis do nome do produto quebra o front aqui:

[components\detalhes-produto\ProductDetailHeader.tsx (143:57) @ length

  141 |                     'min-w-[200px] w-auto'
  142 |                   )}
> 143 |                   style={{ width: `${Math.max(nameValue.length, 10)}ch` }}
      |                                                         ^
  144 |                   autoFocus
  145 |                 />
  146 |                 {savingName && (]
13 - Mostrar uma tag no card do produto da tela /products quando o produto estiver inativo
14 - Quando entrar no produto e ele for um produto novo, permitir que ao clicar em "Gerar etudo de mercado" ou "Gerar Personas" ele já inicie o pipeline automaticamente.
15 - Duração das demandas está em segundos negativos, imagino que por conta do horário do servidor ou algo assim, conseguimos mudar isso para refletir o tempo real?
16 - Ao clicar em ver detalhes completos na demanda, ele abre a tela porém apresenta o erro:

[app\demandas\[id]\page.tsx (98:22) @ params

   96 |   params: Promise<{ id: string }>
   97 | }) {
>  98 |   const { id } = use(params)
      |                      ^
   99 |   const { pipeline, isLoading, error, reload, rerunTask } = usePipelineDetail(id)
  100 |
  101 |   const [rerunAllOpen, setRerunAllOpen] = useState(false)]

17 - Opção para refazer o estudo de mercado, a persona, etc
18 - Retirar sessão de "Últimas atualizações" do produto de dentro do card das demandas
19 - Ao clicar em "Ver detalhes completos" quero que abra a demanda com o input que ela recebeu, o output que ela gerou e todos os passos que ela executou
20 - Quero poder deletar demandas do kandan e da lista
21 - Melhorar o layout o card de quando clica em uma demanda.

------------------------------

22 - Insights não estão salvando automaticamente insights
23 - centralizar mais todos os layouts
24 - Aplicar os componentes do shadcn em todas as páginas
25 - Adicionar menu slider