import { Package, Target, Calendar } from 'lucide-react'

export function KanbanFilters() {
  return (
    <div className="flex items-center bg-[#1C1B1C] p-1.5 rounded-lg border border-[#584237]/10">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <Package size={14} strokeWidth={1.5} className="text-[#6B6460]" />
        <span className="text-[12px] font-semibold text-[#6B6460]">Produto: Todos</span>
      </div>

      <div className="w-px h-4 bg-[#584237]/20" />

      <div className="flex items-center gap-2 px-3 py-1.5">
        <Target size={14} strokeWidth={1.5} className="text-[#6B6460]" />
        <span className="text-[12px] font-semibold text-[#6B6460]">Goal: Todos</span>
      </div>

      <div className="w-px h-4 bg-[#584237]/20" />

      <div className="flex items-center gap-2 px-3 py-1.5">
        <Calendar size={14} strokeWidth={1.5} className="text-[#6B6460]" />
        <span className="text-[12px] font-semibold text-[#6B6460]">Período: Últimos 30 dias</span>
      </div>
    </div>
  )
}
