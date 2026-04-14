"use client"

import { useState } from "react"
import { Dialog as RadixDialog } from "radix-ui"
import {
  X,
  Info,
  ArrowRight,
  Sparkles,
  HeartPulse,
} from "lucide-react"
import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { AFFILIATE_PLATFORMS } from "@/lib/constants"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ProductRegistrationData {
  tab: "url" | "manual"
  url?: string
  platform?: string
}

export interface CadastrarProdutoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit?: (data: ProductRegistrationData) => void
}

interface ExtractedProduct {
  name: string
  description: string
  niche: string
  status: "URL_READY" | "EXTRACTING" | "ERROR"
}

type Tab = "url" | "manual"

// ── Component ─────────────────────────────────────────────────────────────────

export function CadastrarProdutoModal({
  open,
  onOpenChange,
  onSubmit,
}: CadastrarProdutoModalProps) {
  const [tab, setTab] = useState<Tab>("url")
  const [url, setUrl] = useState("")
  const [platform, setPlatform] = useState("")
  const [extracted, setExtracted] = useState<ExtractedProduct | null>(null)

  function handleUrlChange(value: string) {
    setUrl(value)
    // Reset extraction when URL is cleared
    if (!value.trim()) setExtracted(null)
  }

  function handleUrlBlur() {
    // Simulate Jarvis extraction — replace with real hook call when ready
    if (url.trim()) {
      setExtracted({
        name: "Mitolyn — Metabolic Blend",
        description:
          "Advanced metabolic support formula designed to optimize energy levels and support natural weight management through botanical extracts.",
        niche: "Saúde & Bem-estar",
        status: "URL_READY",
      })
    }
  }

  function handleSubmit() {
    onSubmit?.({ tab, url, platform })
    onOpenChange(false)
  }

  function handleClose() {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/60 backdrop-blur-sm" />
        <RadixDialog.Content
          className={cn(
            "fixed top-1/2 left-1/2 z-50 w-full max-w-[520px]",
            "-translate-x-1/2 -translate-y-1/2",
            "flex flex-col",
            "bg-surface-low border border-outline-variant/15",
            "rounded-xl shadow-ambient overflow-hidden",
            "focus:outline-none",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "duration-150",
          )}
        >
          {/* Header */}
          <header className="flex items-center justify-between px-8 pt-8 pb-4">
            <RadixDialog.Title className="text-base font-semibold tracking-tight text-on-surface">
              Cadastrar novo produto
            </RadixDialog.Title>
            <RadixDialog.Close asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-highest transition-colors duration-150"
                onClick={handleClose}
              >
                <X strokeWidth={1.5} size={18} />
                <span className="sr-only">Fechar</span>
              </Button>
            </RadixDialog.Close>
          </header>

          {/* Tab Navigation + Content */}
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            className="flex flex-col flex-1"
          >
            <TabsList className="px-8 h-auto bg-transparent border-b border-outline-variant/15 rounded-none justify-start gap-0 pb-0">
              <TabsTrigger
                value="url"
                className={cn(
                  "px-4 py-3 text-sm font-medium rounded-none border-b-2 -mb-px transition-colors duration-150",
                  "data-[state=active]:border-brand data-[state=active]:text-on-surface data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  "data-[state=inactive]:border-transparent data-[state=inactive]:text-on-surface-variant hover:text-on-surface",
                )}
              >
                Via URL
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className={cn(
                  "px-4 py-3 text-sm font-medium rounded-none border-b-2 -mb-px transition-colors duration-150",
                  "data-[state=active]:border-brand data-[state=active]:text-on-surface data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  "data-[state=inactive]:border-transparent data-[state=inactive]:text-on-surface-variant hover:text-on-surface",
                )}
              >
                Manual
              </TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="px-8 py-6 space-y-6 mt-0">
              <UrlTabContent
                url={url}
                onUrlChange={handleUrlChange}
                onUrlBlur={handleUrlBlur}
                extracted={extracted}
                platform={platform}
                onPlatformChange={setPlatform}
              />
            </TabsContent>
            <TabsContent value="manual" className="px-8 py-6 mt-0">
              <ManualTabContent />
            </TabsContent>
          </Tabs>

          {/* Footer */}
          <footer className="px-8 py-4 flex items-center justify-end gap-3 bg-surface-high/30">
            <Button
              variant="ghost"
              className="text-on-surface-variant hover:text-on-surface transition-colors duration-150"
              onClick={handleClose}
            >
              Cancelar
            </Button>
            <Button
              className="bg-brand-gradient text-primary-foreground font-semibold hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)] transition-shadow duration-150"
              onClick={handleSubmit}
            >
              Continuar
              <ArrowRight strokeWidth={1.5} size={16} />
            </Button>
          </footer>
        </RadixDialog.Content>
      </DialogPortal>
    </Dialog>
  )
}

// ── URL Tab ───────────────────────────────────────────────────────────────────

interface UrlTabContentProps {
  url: string
  onUrlChange: (value: string) => void
  onUrlBlur: () => void
  extracted: ExtractedProduct | null
  platform: string
  onPlatformChange: (value: string) => void
}

function UrlTabContent({
  url,
  onUrlChange,
  onUrlBlur,
  extracted,
  platform,
  onPlatformChange,
}: UrlTabContentProps) {
  return (
    <>
      {/* URL Field */}
      <div className="space-y-2">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
          Link da página de venda do produto
        </label>
        <div className="relative">
          <Input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => onUrlChange(e.target.value)}
            onBlur={onUrlBlur}
            className={cn(
              "h-10 bg-surface-low border-outline-variant/20",
              "text-on-surface placeholder:text-on-surface-muted pr-10",
              "focus-visible:border-brand focus-visible:ring-brand/20",
            )}
          />
          <Sparkles
            strokeWidth={1.5}
            size={16}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-brand pointer-events-none"
          />
        </div>
        <p className="text-[11px] text-on-surface-muted flex items-center gap-1.5">
          <Info strokeWidth={1.5} size={14} className="shrink-0" />
          Cole o link e o Jarvis vai extrair os detalhes automaticamente
        </p>
      </div>

      {/* Extracted Product Card */}
      {extracted && (
        <div className="relative bg-surface-container rounded-lg p-4 border border-brand/20 flex gap-4 items-start overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-brand/[0.05] to-transparent pointer-events-none" />
          <div className="w-12 h-12 bg-surface-low rounded-md flex items-center justify-center shrink-0 border border-outline-variant/20">
            <HeartPulse strokeWidth={1.5} size={20} className="text-agent-research" />
          </div>
          <div className="flex-grow space-y-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-on-surface truncate">
                {extracted.name}
              </h3>
              {extracted.status === "URL_READY" && (
                <span className="shrink-0 font-mono text-[10px] bg-brand-muted text-agent-strategy px-1.5 py-0.5 rounded">
                  URL_READY
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-2">
              {extracted.description}
            </p>
          </div>
        </div>
      )}

      {/* Quick-glance Fields */}
      <div className="grid grid-cols-2 gap-4">
        {/* Nicho Sugerido — read-only */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Nicho Sugerido
          </label>
          <div className="h-9 bg-surface-high rounded flex items-center px-3 border border-outline-variant/10">
            <HeartPulse
              strokeWidth={1.5}
              size={16}
              className="text-agent-research shrink-0 mr-2"
            />
            <span className="text-xs text-on-surface truncate">
              {extracted?.niche ?? "—"}
            </span>
          </div>
        </div>

        {/* Plataforma */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant">
            Plataforma
          </label>
          <Select value={platform} onValueChange={onPlatformChange}>
            <SelectTrigger
              className={cn(
                "w-full h-9 bg-surface-high border-outline-variant/10",
                "text-xs text-on-surface",
                "data-placeholder:text-on-surface-muted",
              )}
            >
              <SelectValue placeholder="Selecionar..." />
            </SelectTrigger>
            <SelectContent>
              {AFFILIATE_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p} className="text-xs capitalize">
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </>
  )
}

// ── Manual Tab ────────────────────────────────────────────────────────────────

function ManualTabContent() {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
      <p className="text-sm text-on-surface-variant">
        Preenchimento manual em breve.
      </p>
      <p className="text-xs text-on-surface-muted">
        Use a aba Via URL para cadastrar agora.
      </p>
    </div>
  )
}
