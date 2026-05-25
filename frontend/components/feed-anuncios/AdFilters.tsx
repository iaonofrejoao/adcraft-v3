'use client'
import { useState } from 'react'
import { Search, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { type AdLibraryFilters, DEFAULT_FILTERS } from '@/hooks/useAdLibrary'

const COUNTRY_OPTIONS = [
  { value: 'BR', label: 'Brasil' },
  { value: 'US', label: 'EUA' },
  { value: 'PT', label: 'Portugal' },
  { value: 'ES', label: 'Espanha' },
  { value: 'MX', label: 'México' },
  { value: 'AR', label: 'Argentina' },
  { value: 'CO', label: 'Colômbia' },
  { value: 'CL', label: 'Chile' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'DE', label: 'Alemanha' },
]

const STATUS_OPTIONS = [
  { value: 'ALL',      label: 'Todos'    },
  { value: 'ACTIVE',   label: 'Ativos'   },
  { value: 'INACTIVE', label: 'Inativos' },
]

const MEDIA_OPTIONS = [
  { value: 'ALL',         label: 'Todos'       },
  { value: 'IMAGE',       label: 'Imagem'      },
  { value: 'VIDEO',       label: 'Vídeo'       },
  { value: 'MUTED_VIDEO', label: 'Vídeo mudo'  },
  { value: 'NONE',        label: 'Sem mídia'   },
]

const PLATFORM_OPTIONS = [
  { value: 'FACEBOOK',         label: 'Facebook'          },
  { value: 'INSTAGRAM',        label: 'Instagram'         },
  { value: 'AUDIENCE_NETWORK', label: 'Audience Network'  },
  { value: 'MESSENGER',        label: 'Messenger'         },
]

const AD_TYPE_OPTIONS = [
  { value: 'ALL',                       label: 'Todos'         },
  { value: 'POLITICAL_AND_ISSUE_ADS',   label: 'Político'      },
  { value: 'HOUSING_ADS',               label: 'Imóveis'       },
  { value: 'EMPLOYMENT_ADS',            label: 'Emprego'       },
  { value: 'CREDIT_ADS',                label: 'Crédito'       },
]

const LANGUAGE_OPTIONS = [
  { value: 'pt', label: 'PT' },
  { value: 'en', label: 'EN' },
  { value: 'es', label: 'ES' },
  { value: 'fr', label: 'FR' },
  { value: 'de', label: 'DE' },
  { value: 'it', label: 'IT' },
]

interface Props {
  onSearch: (filters: AdLibraryFilters) => void
  isLoading: boolean
}

function PillButton({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-3 py-1 rounded-full text-xs font-medium transition-colors duration-150',
        active
          ? 'bg-brand/20 text-brand ring-1 ring-brand/30'
          : 'bg-surface-low text-on-surface-muted hover:text-on-surface hover:bg-surface-high',
      )}
    >
      {children}
    </button>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="text-[0.6875rem] font-medium text-on-surface-muted uppercase tracking-widest">
      {children}
    </label>
  )
}

export function AdFilters({ onSearch, isLoading }: Props) {
  const [f, setF] = useState<AdLibraryFilters>(DEFAULT_FILTERS)

  function set<K extends keyof AdLibraryFilters>(key: K, value: AdLibraryFilters[K]) {
    setF(prev => ({ ...prev, [key]: value }))
  }

  function toggle(key: 'countries' | 'platforms' | 'languages', value: string) {
    setF(prev => {
      const arr = prev[key] as string[]
      return { ...prev, [key]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] }
    })
  }

  const canSearch = f.search_terms.trim() !== '' || f.search_page_ids.trim() !== ''

  return (
    <div className="bg-surface-container border border-white/5 rounded-md p-5 space-y-5">

      {/* Busca */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <SectionLabel>Palavras-chave</SectionLabel>
          <input
            value={f.search_terms}
            onChange={e => set('search_terms', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canSearch && onSearch(f)}
            placeholder="Ex: emagrecimento, suplemento, curso..."
            className="w-full h-9 px-3 text-sm bg-surface-low border border-white/8 rounded text-on-surface placeholder:text-on-surface-muted focus:border-brand/40 focus:ring-1 focus:ring-brand/20 outline-none transition-all duration-150"
          />
        </div>
        <div className="space-y-1.5">
          <SectionLabel>ID de página (anunciante)</SectionLabel>
          <input
            value={f.search_page_ids}
            onChange={e => set('search_page_ids', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && canSearch && onSearch(f)}
            placeholder="Ex: 123456789, 987654321"
            className="w-full h-9 px-3 text-sm bg-surface-low border border-white/8 rounded text-on-surface placeholder:text-on-surface-muted focus:border-brand/40 focus:ring-1 focus:ring-brand/20 outline-none transition-all duration-150"
          />
        </div>
      </div>

      {/* País */}
      <div className="space-y-1.5">
        <SectionLabel>País</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {COUNTRY_OPTIONS.map(opt => (
            <PillButton
              key={opt.value}
              active={f.countries.includes(opt.value)}
              onClick={() => toggle('countries', opt.value)}
            >
              {opt.label}
            </PillButton>
          ))}
        </div>
      </div>

      {/* Status + Mídia */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <SectionLabel>Status</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map(opt => (
              <PillButton
                key={opt.value}
                active={f.status === opt.value}
                onClick={() => set('status', opt.value as AdLibraryFilters['status'])}
              >
                {opt.label}
              </PillButton>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <SectionLabel>Tipo de mídia</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {MEDIA_OPTIONS.map(opt => (
              <PillButton
                key={opt.value}
                active={f.media_type === opt.value}
                onClick={() => set('media_type', opt.value as AdLibraryFilters['media_type'])}
              >
                {opt.label}
              </PillButton>
            ))}
          </div>
        </div>
      </div>

      {/* Plataforma + Idioma */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <SectionLabel>Plataforma</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_OPTIONS.map(opt => (
              <PillButton
                key={opt.value}
                active={f.platforms.includes(opt.value)}
                onClick={() => toggle('platforms', opt.value)}
              >
                {opt.label}
              </PillButton>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <SectionLabel>Idioma</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {LANGUAGE_OPTIONS.map(opt => (
              <PillButton
                key={opt.value}
                active={f.languages.includes(opt.value)}
                onClick={() => toggle('languages', opt.value)}
              >
                {opt.label}
              </PillButton>
            ))}
          </div>
        </div>
      </div>

      {/* Tipo de anúncio */}
      <div className="space-y-1.5">
        <SectionLabel>Tipo de anúncio</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {AD_TYPE_OPTIONS.map(opt => (
            <PillButton
              key={opt.value}
              active={f.ad_type === opt.value}
              onClick={() => set('ad_type', opt.value as AdLibraryFilters['ad_type'])}
            >
              {opt.label}
            </PillButton>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => setF(DEFAULT_FILTERS)}
          className="text-xs text-on-surface-muted hover:text-on-surface flex items-center gap-1.5 transition-colors duration-150"
        >
          <RotateCcw size={12} strokeWidth={1.5} />
          Limpar filtros
        </button>

        <Button
          onClick={() => onSearch(f)}
          disabled={!canSearch || isLoading}
          className="h-8 px-4 text-sm bg-gradient-to-br from-[#F28705] to-[#FFB690] text-[#131314] font-medium hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-shadow duration-150 disabled:opacity-40"
        >
          <Search size={14} strokeWidth={1.5} className="mr-1.5" />
          {isLoading ? 'Buscando…' : 'Buscar anúncios'}
        </Button>
      </div>
    </div>
  )
}
