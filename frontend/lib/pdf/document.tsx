import { Document } from '@react-pdf/renderer'
import { CoverPage }     from './sections/cover'
import { TocPage }       from './sections/toc'
import { MarketSection } from './sections/market'
import { AvatarSection } from './sections/avatar'
import { BenchmarkSection } from './sections/benchmark'
import { AnglesSection } from './sections/angles'
import { CampaignSection } from './sections/campaign'
import { CopySection }   from './sections/copy'
import type { MarketData }   from './sections/market'
import type { AvatarData }   from './sections/avatar'
import type { BenchmarkData } from './sections/benchmark'
import type { AnglesData }   from './sections/angles'
import type { CampaignData } from './sections/campaign'
import type { CopyComponent } from './sections/copy'

interface Product {
  name:              string
  sku?:              string
  platform?:         string | null
  ticket_price?:     string | null
  commission_percent?: string | null
  niche_name?:       string | null
}

interface ArtifactEntry {
  data:      Record<string, unknown>
  createdAt: string
}

interface ProductStudyPDFProps {
  product:        Product
  sku:            string
  artifacts:      Record<string, ArtifactEntry>
  copyComponents: CopyComponent[]
}

export function ProductStudyPDF({ product, sku, artifacts, copyComponents }: ProductStudyPDFProps) {
  const market    = artifacts['market']
  const avatar    = artifacts['avatar']
  const benchmark = artifacts['benchmark']
  const angles    = artifacts['angles']
  const campaign  = artifacts['campaign_strategy']

  const hooks  = copyComponents.filter((c) => c.component_type === 'hook')
  const bodies = copyComponents.filter((c) => c.component_type === 'body')
  const ctas   = copyComponents.filter((c) => c.component_type === 'cta')

  const tocSections = [
    { number: '01', title: 'Análise de Mercado e Viabilidade', subtitle: 'Score de viabilidade, concorrência, tendências e margem', available: !!market },
    { number: '02', title: 'Avatar do Cliente',                subtitle: 'Perfil demográfico, psicografia, dores e desejos',           available: !!avatar },
    { number: '03', title: 'Inteligência Competitiva',         subtitle: 'Análise de concorrentes, gaps de mercado',                    available: !!benchmark },
    { number: '04', title: 'Ângulos e Posicionamento',         subtitle: 'Ângulo campeão, USP, gatilho emocional, hooks',              available: !!angles },
    { number: '05', title: 'Estratégia de Campanha',           subtitle: 'Objetivo, budget, KPIs, públicos e sequência de lançamento', available: !!campaign },
    { number: '06', title: 'Componentes de Copy',              subtitle: `Hooks, bodies e CTAs — ${copyComponents.length} variantes`,  available: copyComponents.length > 0 },
  ]

  return (
    <Document
      title={`Estudo de Produto — ${product.name}`}
      author="AdCraft AI"
      subject="Estudo completo de produto gerado automaticamente"
      creator="AdCraft AI Platform"
      producer="AdCraft AI"
    >
      <CoverPage
        productName={product.name}
        sku={sku}
        platform={product.platform}
        ticketPrice={product.ticket_price}
        niche={product.niche_name}
        generatedAt={new Date().toISOString()}
      />

      <TocPage
        productName={product.name}
        sku={sku}
        sections={tocSections}
      />

      {market && (
        <MarketSection
          data={market.data as unknown as MarketData}
          productName={product.name}
          sku={sku}
          createdAt={market.createdAt}
        />
      )}

      {avatar && (
        <AvatarSection
          data={avatar.data as unknown as AvatarData}
          productName={product.name}
          sku={sku}
          createdAt={avatar.createdAt}
        />
      )}

      {benchmark && (
        <BenchmarkSection
          data={benchmark.data as unknown as BenchmarkData}
          productName={product.name}
          sku={sku}
          createdAt={benchmark.createdAt}
        />
      )}

      {angles && (
        <AnglesSection
          data={angles.data as unknown as AnglesData}
          productName={product.name}
          sku={sku}
          createdAt={angles.createdAt}
        />
      )}

      {campaign && (
        <CampaignSection
          data={campaign.data as unknown as CampaignData}
          productName={product.name}
          sku={sku}
          createdAt={campaign.createdAt}
        />
      )}

      <CopySection
        hooks={hooks}
        bodies={bodies}
        ctas={ctas}
        productName={product.name}
        sku={sku}
      />
    </Document>
  )
}
