'use client'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface FilterState {
  search:  string
  product: string   // 'all' or product.sku
  type:    string   // 'all' | 'video' | 'image'
  sort:    string   // 'recent' | 'oldest'
}

export interface CreativeFiltersProps {
  state:     FilterState
  products:  Array<{ sku: string; name: string }>
  onChange:  (next: FilterState) => void
}

export function CreativeFilters({ state, products, onChange }: CreativeFiltersProps) {
  function set<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    onChange({ ...state, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-1.5 bg-surface-container rounded-xl">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search
          size={16}
          strokeWidth={1.5}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-muted pointer-events-none"
        />
        <Input
          placeholder="Buscar criativos..."
          value={state.search}
          onChange={(e) => set('search', e.target.value)}
          className="h-9 bg-surface-high border-transparent text-on-surface pl-9 placeholder:text-on-surface-muted focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-150"
        />
      </div>

      {/* Produto */}
      <Select value={state.product} onValueChange={(v) => set('product', v)}>
        <SelectTrigger className="h-9 w-[160px] bg-surface-high border-transparent text-on-surface-variant text-[13px] focus:ring-primary/20">
          <SelectValue placeholder="Produto: Todos" />
        </SelectTrigger>
        <SelectContent className="bg-surface-highest border-outline-variant/20 text-on-surface">
          <SelectItem value="all" className="text-[13px] focus:bg-surface-high">Produto: Todos</SelectItem>
          {products.map((p) => (
            <SelectItem key={p.sku} value={p.sku} className="text-[13px] focus:bg-surface-high">
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Tipo */}
      <Select value={state.type} onValueChange={(v) => set('type', v)}>
        <SelectTrigger className="h-9 w-[140px] bg-surface-high border-transparent text-on-surface-variant text-[13px] focus:ring-primary/20">
          <SelectValue placeholder="Tipo: Todos" />
        </SelectTrigger>
        <SelectContent className="bg-surface-highest border-outline-variant/20 text-on-surface">
          <SelectItem value="all"   className="text-[13px] focus:bg-surface-high">Tipo: Todos</SelectItem>
          <SelectItem value="video" className="text-[13px] focus:bg-surface-high">Vídeo</SelectItem>
          <SelectItem value="image" className="text-[13px] focus:bg-surface-high">Imagem</SelectItem>
        </SelectContent>
      </Select>

      {/* Ordenar */}
      <Select value={state.sort} onValueChange={(v) => set('sort', v)}>
        <SelectTrigger className="h-9 w-[160px] bg-surface-high border-transparent text-on-surface-variant text-[13px] focus:ring-primary/20">
          <SelectValue placeholder="Ordenar: Recentes" />
        </SelectTrigger>
        <SelectContent className="bg-surface-highest border-outline-variant/20 text-on-surface">
          <SelectItem value="recent" className="text-[13px] focus:bg-surface-high">Ordenar: Recentes</SelectItem>
          <SelectItem value="oldest" className="text-[13px] focus:bg-surface-high">Mais antigos</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
