'use client'
import { useEffect, useRef, useMemo } from 'react'
import { Brain } from 'lucide-react'
import type { Learning, Pattern, Insight } from '@/hooks/useInsights'

// ── Cores por categoria (palette Kinetic Console) ───────────────────────────
const CAT_COLOR: Record<string, string> = {
  angle:      '#818cf8',
  copy:       '#34d399',
  persona:    '#f472b6',
  creative:   '#fb923c',
  targeting:  '#38bdf8',
  compliance: '#fbbf24',
  other:      '#94a3b8',
}

function catColor(cat: string | null | undefined): string {
  return CAT_COLOR[cat ?? 'other'] ?? CAT_COLOR.other
}

// ── Tipos internos do grafo ─────────────────────────────────────────────────
interface GNode {
  id:          string
  label:       string
  ntype:       'hub' | 'category' | 'pattern' | 'learning' | 'insight'
  category:    string
  size:        number
  description: string
  // campos mutados pelo D3
  x?:  number
  y?:  number
  vx?: number
  vy?: number
  fx?: number | null
  fy?: number | null
  index?: number
}

interface GLink {
  source:   string | GNode
  target:   string | GNode
  strength: number
}

// ── Props ───────────────────────────────────────────────────────────────────
export interface MemoryGraphProps {
  learnings: Learning[]
  patterns:  Pattern[]
  insights:  Insight[]
}

// ── Componente ──────────────────────────────────────────────────────────────
export function MemoryGraph({ learnings, patterns, insights }: MemoryGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef       = useRef<SVGSVGElement>(null)
  const tooltipRef   = useRef<HTMLDivElement>(null)

  // ── Constrói nós e links a partir dos dados ─────────────────────────────
  const { nodes, links } = useMemo<{ nodes: GNode[]; links: GLink[] }>(() => {
    const nodes: GNode[] = []
    const links: GLink[] = []

    // Hub central
    nodes.push({
      id: 'hub', label: 'Memória', ntype: 'hub', category: 'hub',
      size: 22,
      description: 'Base de conhecimento cumulativa do AdCraft\n\n' +
        `${learnings.length} learnings · ${patterns.length} patterns · ${insights.length} insights`,
    })

    // Categorias detectadas nos dados
    const cats = new Set<string>()
    learnings.forEach(l => cats.add(l.category))
    patterns.forEach(p => p.category && cats.add(p.category))

    cats.forEach(cat => {
      const lCount = learnings.filter(l => l.category === cat).length
      const pCount = patterns.filter(p => p.category === cat).length
      nodes.push({
        id: `cat_${cat}`, label: cat, ntype: 'category', category: cat,
        size: 14,
        description: `Categoria: ${cat}\n${lCount} learnings · ${pCount} patterns`,
      })
      links.push({ source: 'hub', target: `cat_${cat}`, strength: 0.8 })
    })

    // Patterns
    patterns.forEach(p => {
      nodes.push({
        id:          `pat_${p.id}`,
        label:       p.pattern_text.length > 38 ? p.pattern_text.slice(0, 38) + '…' : p.pattern_text,
        ntype:       'pattern',
        category:    p.category ?? 'other',
        size:        8 + Math.min(p.supporting_count, 8),
        description: `${p.pattern_text}\n\nConfiança: ${(p.confidence * 100).toFixed(0)}% · ${p.supporting_count} learnings suporte`,
      })
      links.push({
        source:   `cat_${p.category ?? 'other'}`,
        target:   `pat_${p.id}`,
        strength: 0.5,
      })
    })

    // Learnings (top 35 por confiança)
    learnings.slice(0, 35).forEach(l => {
      nodes.push({
        id:          `lrn_${l.id}`,
        label:       l.observation.slice(0, 30) + '…',
        ntype:       'learning',
        category:    l.category,
        size:        5 + Math.round(l.confidence * 4),
        description: `${l.observation}\n\nConfiança: ${(l.confidence * 100).toFixed(0)}%`,
      })
      links.push({
        source:   `cat_${l.category}`,
        target:   `lrn_${l.id}`,
        strength: 0.3,
      })
    })

    // Insights (conectam ao hub)
    insights.forEach(ins => {
      nodes.push({
        id:          `ins_${ins.id}`,
        label:       ins.title,
        ntype:       'insight',
        category:    'insight',
        size:        10 + ins.importance * 2,
        description: `${ins.title}\n\n${ins.body}\n\nImportância: ${'★'.repeat(ins.importance)}${'☆'.repeat(5 - ins.importance)}`,
      })
      links.push({ source: 'hub', target: `ins_${ins.id}`, strength: 0.6 })
    })

    return { nodes, links }
  }, [learnings, patterns, insights])

  // ── Renderização D3 ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length <= 1) return

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

      // Zoom + pan
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.15, 6])
        .on('zoom', (event) => g.attr('transform', event.transform))
      svg.call(zoom)

      // Clonar nós para D3 mutar sem afetar useMemo
      const simNodes: GNode[] = nodes.map(n => ({ ...n }))
      const nodeById           = new Map(simNodes.map(n => [n.id, n]))

      const simLinks = links.map(l => ({
        source:   nodeById.get(typeof l.source === 'string' ? l.source : l.source.id)!,
        target:   nodeById.get(typeof l.target === 'string' ? l.target : l.target.id)!,
        strength: l.strength,
      }))

      // ── Links ─────────────────────────────────────────────────────────
      const linkEls = g.append('g')
        .selectAll<SVGLineElement, typeof simLinks[0]>('line')
        .data(simLinks)
        .join('line')
        .attr('stroke', d => d.strength >= 0.7 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.07)')
        .attr('stroke-width', d => d.strength >= 0.7 ? 1.5 : 1)

      // ── Halos (glow atrás dos nós grandes) ───────────────────────────
      g.append('g')
        .selectAll<SVGCircleElement, GNode>('circle')
        .data(simNodes.filter(n => n.ntype === 'hub' || n.ntype === 'category'))
        .join('circle')
        .attr('r',       n => n.size * 2.2)
        .attr('fill',    n => n.ntype === 'hub' ? '#A78BFA' : catColor(n.category))
        .attr('opacity', 0.07)
        .attr('filter',  'url(#mg-glow)')

      // ── Nós principais ────────────────────────────────────────────────
      const nodeColor = (n: GNode): string => {
        if (n.ntype === 'hub')     return '#A78BFA'
        if (n.ntype === 'insight') return '#F28705'
        return catColor(n.category)
      }

      const nodeEls = g.append('g')
        .selectAll<SVGCircleElement, GNode>('circle')
        .data(simNodes)
        .join('circle')
        .attr('r',       n => n.size)
        .attr('fill',    nodeColor)
        .attr('opacity', n => n.ntype === 'learning' ? 0.6 : 0.85)
        .attr('cursor',  'pointer')
        .call(
          d3.drag<SVGCircleElement, GNode>()
            .on('start', (event, d) => {
              if (!event.active) simRef?.alphaTarget(0.3).restart()
              d.fx = d.x; d.fy = d.y
            })
            .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y })
            .on('end',  (event, d) => {
              if (!event.active) simRef?.alphaTarget(0)
              d.fx = null; d.fy = null
            })
        )
        .on('mouseover', (_event, d) => {
          const tip = tooltipRef.current
          if (!tip) return
          tip.innerHTML = `
            <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px;color:${nodeColor(d)};opacity:.8">${d.ntype}</div>
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

      // ── Labels (hub, categorias, insights) ───────────────────────────
      const labelData = simNodes.filter(n =>
        n.ntype === 'hub' || n.ntype === 'category' || n.ntype === 'insight'
      )

      const labelEls = g.append('g')
        .selectAll<SVGTextElement, GNode>('text')
        .data(labelData)
        .join('text')
        .text(n => n.label)
        .attr('text-anchor', 'middle')
        .attr('font-size',   n => n.ntype === 'hub' ? 13 : 11)
        .attr('font-family', 'Inter, system-ui, sans-serif')
        .attr('fill',        n => n.ntype === 'hub' ? 'rgba(232,227,221,0.9)' : 'rgba(200,196,190,0.7)')
        .attr('pointer-events', 'none')

      // ── Simulação de forças ───────────────────────────────────────────
      const sim = d3.forceSimulation(simNodes)
        .force('link', d3.forceLink(simLinks)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .id((d: any) => d.id)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .distance((d: any) => {
            const src = d.source as GNode
            const tgt = d.target as GNode
            if (src.ntype === 'hub'      || tgt.ntype === 'hub')      return 130
            if (src.ntype === 'category' || tgt.ntype === 'category') return 85
            return 55
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .strength((d: any) => d.strength * 0.35)
        )
        .force('charge', d3.forceManyBody<GNode>().strength(n => -n.size * 22))
        .force('center',    d3.forceCenter(width / 2, height / 2).strength(0.05))
        .force('collision', d3.forceCollide<GNode>().radius(n => n.size + 7))
        .on('tick', () => {
          linkEls
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .attr('x1', (d: any) => d.source.x ?? 0)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .attr('y1', (d: any) => d.source.y ?? 0)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .attr('x2', (d: any) => d.target.x ?? 0)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .attr('y2', (d: any) => d.target.y ?? 0)

          nodeEls
            .attr('cx', d => d.x ?? 0)
            .attr('cy', d => d.y ?? 0)

          labelEls
            .attr('x', d => d.x ?? 0)
            .attr('y', d => (d.y ?? 0) + d.size + 14)
        })

      simRef = sim
    })

    return () => {
      cancelled = true
      simRef?.stop()
    }
  }, [nodes, links])

  // ── Empty state ──────────────────────────────────────────────────────────
  if (nodes.length <= 1) {
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

  // ── Legenda ──────────────────────────────────────────────────────────────
  const legendItems = [
    { color: '#A78BFA', label: 'Hub central' },
    { color: '#F28705', label: 'Insight' },
    ...Object.entries(CAT_COLOR).slice(0, 4).map(([cat, color]) => ({ color, label: cat })),
  ]

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ background: '#0d0c0f' }}>
      <svg ref={svgRef} className="w-full h-full" />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="absolute pointer-events-none hidden max-w-[270px] rounded-lg border border-outline-variant/20 bg-surface-container px-3 py-2.5 shadow-2xl z-10"
      />

      {/* Instrução de uso */}
      <p className="absolute top-3 right-4 text-[10px] text-on-surface-muted/50 pointer-events-none">
        Scroll: zoom · Arrastar: mover · Hover: detalhes
      </p>

      {/* Legenda */}
      <div className="absolute bottom-4 left-4 rounded-lg border border-outline-variant/10 bg-surface-container/60 backdrop-blur-sm px-3 py-2.5 space-y-1.5">
        {legendItems.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2 text-[11px] text-on-surface-muted">
            <div className="size-2 rounded-full shrink-0" style={{ background: color }} />
            {label}
          </div>
        ))}
        <div className="flex items-center gap-2 text-[11px] text-on-surface-muted">
          <div className="size-2 rounded-full bg-on-surface-muted/40 shrink-0" />
          Learning
        </div>
      </div>

      {/* Contagem de nós */}
      <p className="absolute bottom-4 right-4 text-[10px] text-on-surface-muted/40">
        {nodes.length} nós · {links.length} conexões
      </p>
    </div>
  )
}
