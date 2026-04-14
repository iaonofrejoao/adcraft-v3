import type { Metadata } from 'next'
import { Sidebar } from '@/components/layout/Sidebar'
import './globals.css'
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'AdCraft v2',
  description: 'Plataforma de marketing autônomo com IA',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={cn("font-sans", inter.variable)}>
      <body className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-page)' }}>
        <Sidebar />
        <TooltipProvider>
          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {children}
          </main>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  )
}
