'use client'
import { useEffect, useRef, useMemo } from 'react'
import { Brain } from 'lucide-react'
import type { Learning, Pattern, Insight, ProductRef, NicheRef } from '@/hooks/useInsights'

// ── Paleta de cores ──────────────────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  angle:      '#818cf8',
  copy:       '#34d399',
  persona:    '#f472b6',
  creative:   '#fb923c',
  targeting:  '#38bdf8',
  compliance: '#fbbf24',
  other:      '#94a3b8',
}
const NICHE_COLOR   = '#a78bfa'
const PRODUCT_PAL   = ['#06b6d4', '#10b981', '#f59e0b', '#f472b6', '#a3e635', '#c084fc']
const INSIGHT_COLOR = '#F28705'

const TAG_NS_COLOR: Record<string, string> = {
  avatar:    '#ec4899',
  dor:       '#ef4444',
  mecanismo: '#8b5cf6',
  mercado:   '#0ea5e9',
  formato:   '#22c55e',
  canal:     '#f59e0b',
  fase:      '#64748b',
}

function catColor(cat: string | null | undefined): string {
  return CAT_COLOR[cat ?? 'other'] ?? CAT_COLOR.other
}

function tagColor(tag: string): string {
  const ns = tag.replace('#', '').split('/')[0]
  return TAG_NS_COLOR[ns] ?? '#94a3b8'
}

function tagLabel(tag: string): string {
  return tag.replace('#', '').replace('/', ': ')
}

// ── Tipos internos do grafo ──────────────────────────────────────────────────
interface GNode {
  id:          string
  label:       string
  ntype:       'niche' | 'product' | 'category' | 'pattern' | 'learning' | 'insight' | 'tag'
  category:    string
  color:       string
  size:        number
  description: string
  x?:  number; y?:  number
  vx?: number; vy?: number
  fx?: number | null; fy?: number | null
  index?: number
}

interface GLink {
  source:   string | GNode
  target:   string | GNode
  strength: number
}

// ── Props ────────────────────────────────────────────────────────────────────
export interface MemoryGraphProps {
  learnings: Learning[]
  patterns:  Pattern[]
  insights:  Insight[]
  products:  ProductRef[]
  niches:    NicheRef[]
}

// ── Componente ───────────────────────────────────────────────────────────────
export function MemoryGraph({ learnings, patterns, insights, products, niches }: MemoryGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const tooltipRef   = useRef<HTMLDivElement>(null)

  // ── Construção dos nós e links ────────────────────────────────────────────
  const { nodes, links } = useMemo<{ nodes: GNode[]; links: GLink[] }>(() => {
    const nodes: GNode[] = []
    const links: GLink[] = []

    const prodColorMap = new Map(products.map((p, i) => [p.id, PRODUCT_PAL[i % PRODUCT_PAL.length]]))

    // 1. Niche nodes
    niches.forEach(niche => {
      const pCount = products.filter(p => p.niche_id === niche.id).length
      const lCount = learnings.filter(l => l.niche_id === niche.id).length
      nodes.push({
        id:          `niche_${niche.id}`,
        label:       niche.name,
        ntype:       'niche',
        category:    'niche',
        color:       NICHE_COLOR,
        size:        22,
        description: `Nicho: ${niche.name}\n${pCount} produtos · ${lCount} learnings`,
      })
    })

    // 2. Product nodes
    products.forEach(p => {
      const color  = prodColorMap.get(p.id) ?? PRODUCT_PAL[0]
      const lCount = learnings.filter(l => l.product_id === p.id).length
      const label  = p.name.length > 22 ? p.name.slice(0, 22) + '…' : p.name
      nodes.push({
        id: `prod_${p.id}`, label, ntype: 'product',
        category: p.id, color, size: 16,
        description: `Produto: ${p.name}\n${lCount} learnings`,
      })
      if (p.niche_id && niches.some(n => n.id === p.niche_id)) {
        links.push({ source: `niche_${p.niche_id}`, target: `prod_${p.id}`, strength: 0.75 })
      }
    })

    // 3. Category nodes (detectados dos dados)
    const cats = new Set<string>()
    learnings.forEach(l => cats.add(l.category))
    patterns.forEach(p => p.category && cats.add(p.category))

    cats.forEach(cat => {
      const lCount = learnings.filter(l => l.category === cat).length
      const pCount = patterns.filter(p => p.category === cat).length
      nodes.push({
        id: `cat_${cat}`, label: cat, ntype: 'category',
        category: cat, color: catColor(cat), size: 13,
        description: `Categoria: ${cat}\n${lCount} learnings · ${pCount} patterns`,
      })
    })

    // Mapa learning_id → product_id para cruzar patterns com produtos
    const lrnToProduct = new Map(
      learnings.filter(l => l.product_id).map(l => [l.id, l.product_id!])
    )

    // 4. Learning nodes (top 40 por confiança)
    learnings.slice(0, 40).forEach(l => {
      const label = l.observation.length > 32 ? l.observation.slice(0, 32) + '…' : l.observation
      nodes.push({
        id: `lrn_${l.id}`, label, ntype: 'learning',
        category: l.category, color: catColor(l.category),
        size: 5 + Math.round(l.confidence * 4),
        description: `${l.observation}\n\nConfiança: ${(l.confidence * 100).toFixed(0)}%`,
      })
      // produto → learning
      if (l.product_id && products.some(p => p.id === l.product_id)) {
        links.push({ source: `prod_${l.product_id}`, target: `lrn_${l.id}`, strength: 0.5 })
      }
      // categoria → learning
      links.push({ source: `cat_${l.category}`, target: `lrn_${l.id}`, strength: 0.35 })
    })

    // 5. Pattern nodes
    patterns.forEach(p => {
      const label = p.pattern_text.length > 36 ? p.pattern_text.slice(0, 36) + '…' : p.pattern_text
      nodes.push({
        id: `pat_${p.id}`, label, ntype: 'pattern',
        category: p.category ?? 'other', color: catColor(p.category),
        size: 8 + Math.min(p.supporting_count, 8),
        description: `${p.pattern_text}\n\nConfiança: ${(p.confidence * 100).toFixed(0)}% · ${p.supporting_count} learnings suporte`,
      })
      // categoria → pattern
      if (p.category) {
        links.push({ source: `cat_${p.category}`, target: `pat_${p.id}`, strength: 0.55 })
      }
      // nicho → pattern
      if (p.niche_id && niches.some(n => n.id === p.niche_id)) {
        links.push({ source: `niche_${p.niche_id}`, target: `pat_${p.id}`, strength: 0.4 })
      }
      // produto → pattern (via supporting_learning_ids — conexão cross-produto)
      const supportedPids = new Set(
        (p.supporting_learning_ids ?? [])
          .map(lid => lrnToProduct.get(lid))
          .filter((pid): pid is string => !!pid)
      )
      supportedPids.forEach(pid => {
        if (products.some(pr => pr.id === pid)) {
          links.push({ source: `prod_${pid}`, target: `pat_${p.id}`, strength: 0.35 })
        }
      })
    })

    // 6. Insight nodes
    insights.forEach(ins => {
      const label = ins.title.length > 36 ? ins.title.slice(0, 36) + '…' : ins.title
      const tagStr = ins.tags?.length ? `\n\nTags: ${ins.tags.join(' ')}` : ''
      nodes.push({
        id: `ins_${ins.id}`, label, ntype: 'insight',
        category: 'insight', color: INSIGHT_COLOR,
        size: 10 + ins.importance * 2,
        description: `${ins.title}\n\n${ins.body}\n\nImportância: ${'★'.repeat(ins.importance)}${'☆'.repeat(5 - ins.importance)}${tagStr}`,
      })
      const matchNiche = niches.find(n =>
        ins.source?.toLowerCase().includes(n.name.toLowerCase())
      )
      if (matchNiche) {
        links.push({ source: `niche_${matchNiche.id}`, target: `ins_${ins.id}`, strength: 0.5 })
      }
    })

    // 7. Tag nodes — apenas tags com 2+ ocorrências viram nós no grafo
    const tagCount = new Map<string, string[]>()  // tag → [node ids que a possuem]

    const addTagRef = (tag: string, nodeId: string) => {
      if (!tagCount.has(tag)) tagCount.set(tag, [])
      tagCount.get(tag)!.push(nodeId)
    }

    learnings.slice(0, 40).forEach(l => l.tags?.forEach(t => addTagRef(t, `lrn_${l.id}`)))
    patterns.forEach(p => p.tags?.forEach(t => addTagRef(t, `pat_${p.id}`)))
    insights.forEach(i => i.tags?.forEach(t => addTagRef(t, `ins_${i.id}`)))

    tagCount.forEach((nodeIds, tag) => {
      if (nodeIds.length < 2) return  // tag única — não vira nó, só aparece no tooltip
      const color = tagColor(tag)
      nodes.push({
        id: `tag_${tag}`, label: tagLabel(tag), ntype: 'tag',
        category: 'tag', color,
        size: 6 + Math.min(nodeIds.length * 1.5, 10),
        description: `Tag: ${tag}\nPresente em ${nodeIds.length} memórias`,
      })
      nodeIds.forEach(nid => {
        links.push({ source: `tag_${tag}`, target: nid, strength: 0.25 })
      })
    })

    return { nodes, links }
  }, [learnings, patterns, insights, products, niches])

  // ── Renderização D3 ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return

    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let simRef: any = null

    import('d3').then((d3) => {
      if (cancelled || !svgRef.current || !containerRef.current) return

      const container = containerRef.current
      const width     = container.clientWidth
      const height    = container.clientHeight

      const svg = d3.select(svgRef.current)
      svg.selectAll('*').remove()

      // Defs: filtro de glow
      const defs = svg.append('defs')
      defs.append('filter').attr('id', 'mg-glow')
        .append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'coloredBlur')
      defs.select('filter')
        .append('feMerge').selectAll('feMergeNode').data(['coloredBlur', 'SourceGraphic'])
        .join('feMergeNode').attr('in', d => d)

      const g = svg.append('g')

      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on('zoom', (event) => g.attr('transform', event.transform))
      svg.call(zoom)

      const simNodes: GNode[] = nodes.map(n => ({ ...n }))
      const nodeById           = new Map(simNodes.map(n => [n.id, n]))

      const simLinks = links
        .map(l => ({
          source:   nodeById.get(typeof l.source === 'string' ? l.source : l.source.id)!,
          target:   nodeById.get(typeof l.target === 'string' ? l.target : l.target.id)!,
          strength: l.strength,
        }))
        .filter(l => l.source && l.target)

      // ── Adjacência para seleção de trilha (grafo não-direcional) ──────
      const adjMap = new Map<string, Set<string>>()
      simLinks.forEach(l => {
        const src = l.source.id, tgt = l.target.id
        if (!adjMap.has(src)) adjMap.set(src, new Set())
        if (!adjMap.has(tgt)) adjMap.set(tgt, new Set())
        adjMap.get(src)!.add(tgt)
        adjMap.get(tgt)!.add(src)
      })

      // BFS com limite de hops por tipo de nó
      function getTrail(nodeId: string): Set<string> {
        const node    = nodeById.get(nodeId)
        const maxHops = !node || node.ntype === 'niche' || node.ntype === 'insight' ? 1 : 2
        const sel     = new Set<string>([nodeId])
        let frontier  = new Set<string>([nodeId])
        for (let hop = 0; hop < maxHops; hop++) {
          const next = new Set<string>()
          frontier.forEach(id => {
            ;(adjMap.get(id) ?? new Set()).forEach(nid => {
              if (!sel.has(nid)) { sel.add(nid); next.add(nid) }
            })
          })
          frontier = next
        }
        return sel
      }

      let selectedId: string | null = null
      let wasDragged = false
      // eslint-disable-next-line prefer-const
      let applySelection: (trail: Set<string> | null) => void = () => {}

      // ── Links ─────────────────────────────────────────────────────────
      const linkEls = g.append('g')
        .selectAll<SVGLineElement, typeof simLinks[0]>('line')
        .data(simLinks)
        .join('line')
        .attr('stroke', d => {
          if (d.strength >= 0.7) return 'rgba(255,255,255,0.40)'
          if (d.strength >= 0.5) return 'rgba(255,255,255,0.26)'
          return 'rgba(255,255,255,0.15)'
        })
        .attr('stroke-width', d => {
          if (d.strength >= 0.7) return 2
          if (d.strength >= 0.5) return 1.5
          return 1
        })

      // ── Halos (niche + product) ────────────────────────────────────────
      g.append('g')
        .selectAll<SVGCircleElement, GNode>('circle')
        .data(simNodes.filter(n => n.ntype === 'niche' || n.ntype === 'product'))
        .join('circle')
        .attr('r',       n => n.size * 2.4)
        .attr('fill',    n => n.color)
        .attr('opacity', 0.07)
        .attr('filter',  'url(#mg-glow)')

      // ── Nós principais ─────────────────────────────────────────────────
      const baseOpacity = (n: GNode) => {
        if (n.ntype === 'niche')    return 1.0
        if (n.ntype === 'product')  return 0.90
        if (n.ntype === 'insight')  return 0.88
        if (n.ntype === 'category') return 0.80
        if (n.ntype === 'pattern')  return 0.66
        if (n.ntype === 'tag')      return 0.60
        return 0.44
      }

      const nodeEls = g.append('g')
        .selectAll<SVGCircleElement, GNode>('circle')
        .data(simNodes)
        .join('circle')
        .attr('r',            n => n.size)
        .attr('fill',         n => n.color)
        .attr('opacity',      n => baseOpacity(n))
        .attr('cursor',       'pointer')
        .attr('stroke',       'none')
        .attr('stroke-width', 0)
        .call(
          d3.drag<SVGCircleElement, GNode>()
            .on('start', (event, d) => {
              if (!event.active) simRef?.alphaTarget(0.3).restart()
              d.fx = d.x; d.fy = d.y
            })
            .on('drag', (event, d) => { wasDragged = true; d.fx = event.x; d.fy = event.y })
            .on('end',  (event, d) => {
              if (!event.active) simRef?.alphaTarget(0)
              d.fx = null; d.fy = null
            })
        )
        .on('click', (event, d) => {
          event.stopPropagation()
          if (wasDragged) { wasDragged = false; return }
          if (selectedId === d.id) {
            selectedId = null; applySelection(null)
          } else {
            selectedId = d.id; applySelection(getTrail(d.id))
          }
        })
        .on('mouseover', (_event, d) => {
          const tip = tooltipRef.current
          if (!tip) return
          tip.innerHTML = `
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;color:${d.color};opacity:.8">${d.ntype}</div>
            <div style="font-size:13px;font-weight:600;color:#e8e3dd;margin-bottom:5px">${d.label}</div>
            <div style="font-size:11.5px;color:#9e9489;white-space:pre-line;line-height:1.6">${d.description}</div>
          `
          tip.style.display = 'block'
        })
        .on('mousemove', (event: MouseEvent) => {
          const tip  = tooltipRef.current
          if (!tip) return
          const rect = container.getBoundingClientRect()
          const x    = event.clientX - rect.left + 14
          const y    = event.clientY - rect.top  - 10
          tip.style.left = Math.min(x, width  - 290) + 'px'
          tip.style.top  = Math.min(Math.max(y, 8), height - 140) + 'px'
        })
        .on('mouseout', () => {
          if (tooltipRef.current) tooltipRef.current.style.display = 'none'
        })

      // ── Labels (todos os nós) ─────────────────────────────────────────
      const labelEls = g.append('g')
        .selectAll<SVGTextElement, GNode>('text')
        .data(simNodes)
        .join('text')
        .text(n => n.label)
        .attr('text-anchor', 'middle')
        .attr('font-size', n => {
          if (n.ntype === 'niche')    return 14
          if (n.ntype === 'product')  return 12
          if (n.ntype === 'category') return 11
          if (n.ntype === 'insight')  return 11
          if (n.ntype === 'pattern')  return 10
          if (n.ntype === 'tag')      return 9
          return 9
        })
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('fill', n => {
          if (n.ntype === 'niche')    return 'rgba(240,236,232,0.97)'
          if (n.ntype === 'product')  return 'rgba(225,220,214,0.93)'
          if (n.ntype === 'category') return 'rgba(210,205,200,0.90)'
          if (n.ntype === 'insight')  return 'rgba(210,205,200,0.90)'
          if (n.ntype === 'pattern')  return 'rgba(190,186,180,0.80)'
          return 'rgba(170,166,160,0.70)'
        })
        .attr('stroke',       '#0d0c0f')
        .attr('stroke-width', n => {
          if (n.ntype === 'niche')   return 5
          if (n.ntype === 'product') return 4
          return 3
        })
        .attr('paint-order',    'stroke')
        .attr('pointer-events', 'none')

      // ── Seleção de trilha ─────────────────────────────────────────────
      applySelection = (trail: Set<string> | null) => {
        const FADE = 320
        nodeEls.transition().duration(FADE).ease(d3.easeCubicOut)
          .attr('opacity', n => trail
            ? (trail.has(n.id) ? Math.min(baseOpacity(n) + 0.12, 1) : 0.06)
            : baseOpacity(n))
          .attr('stroke',       n => trail && trail.has(n.id) && n.id === selectedId ? 'rgba(255,255,255,0.85)' : 'none')
          .attr('stroke-width', n => trail && n.id === selectedId ? 2.5 : 0)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        linkEls.each(function(d: any) {
          const inTrail = trail && trail.has(d.source.id) && trail.has(d.target.id)
          const str: number = d.strength
          d3.select(this).transition().duration(FADE).ease(d3.easeCubicOut)
            .attr('stroke', inTrail || !trail
              ? str >= 0.7 ? 'rgba(255,255,255,0.55)' : str >= 0.5 ? 'rgba(255,255,255,0.38)' : 'rgba(255,255,255,0.22)'
              : 'rgba(255,255,255,0.04)')
            .attr('stroke-width', inTrail || !trail
              ? str >= 0.7 ? 2.5 : str >= 0.5 ? 2 : 1.5
              : 0.8)
        })

        labelEls.transition().duration(FADE).ease(d3.easeCubicOut)
          .attr('opacity', n => trail ? (trail.has(n.id) ? 1 : 0.05) : 1)
      }

      svg.on('click', () => { selectedId = null; applySelection(null) })

      // ── Simulação de forças ───────────────────────────────────────────
      const sim = d3.forceSimulation(simNodes)
        .force('link', d3.forceLink(simLinks)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .id((d: any) => d.id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .distance((d: any) => {
            const src = d.source as GNode, tgt = d.target as GNode
            if (src.ntype === 'niche'    || tgt.ntype === 'niche')    return 170
            if (src.ntype === 'product'  || tgt.ntype === 'product')  return 105
            if (src.ntype === 'category' || tgt.ntype === 'category') return 80
            if (src.ntype === 'tag'      || tgt.ntype === 'tag')      return 65
            return 55
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .strength((d: any) => d.strength * 0.4)
        )
        .force('charge', d3.forceManyBody<GNode>().strength(n => {
          if (n.ntype === 'niche')    return -n.size * 50
          if (n.ntype === 'product')  return -n.size * 32
          if (n.ntype === 'category') return -n.size * 24
          if (n.ntype === 'tag')      return -n.size * 20
          return -n.size * 18
        }))
        .force('center',    d3.forceCenter(width / 2, height / 2).strength(0.04))
        .force('collision', d3.forceCollide<GNode>().radius(n => n.size + 8))
        .on('tick', () => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          linkEls.each(function(d: any) {
            const sx = d.source.x ?? 0, sy = d.source.y ?? 0
            const tx = d.target.x ?? 0, ty = d.target.y ?? 0
            const dx = tx - sx, dy = ty - sy
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const ux = dx / dist, uy = dy / dist
            d3.select(this)
              .attr('x1', sx + ux * (d.source.size + 1))
              .attr('y1', sy + uy * (d.source.size + 1))
              .attr('x2', tx - ux * (d.target.size + 1))
              .attr('y2', ty - uy * (d.target.size + 1))
          })
          nodeEls.attr('cx', d => d.x ?? 0).attr('cy', d => d.y ?? 0)
          labelEls.attr('x', d => d.x ?? 0).attr('y', d => (d.y ?? 0) + d.size + 14)
        })

      simRef = sim
    })

    return () => { cancelled = true; simRef?.stop() }
  }, [nodes, links])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Brain size={32} strokeWidth={1} className="text-on-surface-muted mb-3" />
        <p className="text-[14px] text-on-surface-variant font-medium">Sem dados para o grafo</p>
        <p className="text-[12px] text-on-surface-muted mt-1 max-w-xs text-center">
          Execute pipelines para gerar learnings, patterns e insights.
        </p>
      </div>
    )
  }

  // ── Legenda ───────────────────────────────────────────────────────────────
  const legendItems = [
    { color: NICHE_COLOR,    label: 'Nicho'   },
    { color: PRODUCT_PAL[0], label: 'Produto' },
    { color: INSIGHT_COLOR,  label: 'Insight' },
    ...Object.entries(CAT_COLOR).slice(0, 4).map(([cat, color]) => ({ color, label: cat })),
    { color: 'rgba(150,146,140,0.5)', label: 'Learning' },
    { color: TAG_NS_COLOR.avatar,    label: '#avatar'    },
    { color: TAG_NS_COLOR.dor,       label: '#dor'       },
    { color: TAG_NS_COLOR.mecanismo, label: '#mecanismo' },
    { color: TAG_NS_COLOR.mercado,   label: '#mercado'   },
  ]

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: '#0d0c0f' }}>
      <svg ref={svgRef} className="w-full h-full" />

      <div
        ref={tooltipRef}
        className="absolute pointer-events-none hidden max-w-[270px] rounded-lg border border-outline-variant/20 bg-surface-container px-3 py-2.5 shadow-2xl z-10"
      />

      <p className="absolute top-3 right-4 text-[10px] text-on-surface-muted/50 pointer-events-none">
        Scroll: zoom · Arrastar: mover · Hover: detalhes · Clique: selecionar trilha
      </p>

      <div className="absolute bottom-4 left-4 rounded-lg border border-outline-variant/10 bg-surface-container/60 backdrop-blur-sm px-3 py-2.5 space-y-1.5">
        {legendItems.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-[11px] text-on-surface-muted">
            <div className="size-2 rounded-full shrink-0" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>

      <p className="absolute bottom-4 right-4 text-[10px] text-on-surface-muted/40">
        {nodes.length} nós · {links.length} conexões
      </p>
    </div>
  )
}
