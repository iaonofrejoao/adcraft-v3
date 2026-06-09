import React from 'react'
import { Page, Text, View } from '@react-pdf/renderer'
import { C } from '../styles'

interface CoverProps {
  productName: string
  sku: string
  platform?: string | null
  ticketPrice?: string | null
  niche?: string | null
  generatedAt: string
}

export function CoverPage({ productName, sku, platform, ticketPrice, niche, generatedAt }: CoverProps) {
  const date = new Date(generatedAt).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <Page size="A4" style={{ fontFamily: 'Helvetica', backgroundColor: C.coverBg, padding: 0 }}>
      {/* Faixa superior */}
      <View style={{ paddingHorizontal: 48, paddingTop: 44, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14, color: C.brand, letterSpacing: 2 }}>
            ADCRAFT
          </Text>
          <View style={{ width: 1, height: 14, backgroundColor: '#334155', marginHorizontal: 10 }} />
          <Text style={{ fontSize: 9, color: '#64748B', letterSpacing: 0.5 }}>
            Plataforma de Marketing com IA
          </Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: '#334155', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontSize: 7.5, color: '#64748B', letterSpacing: 1, fontFamily: 'Helvetica-Bold' }}>
            CONFIDENCIAL
          </Text>
        </View>
      </View>

      {/* Corpo central */}
      <View style={{ flex: 1, paddingHorizontal: 48, justifyContent: 'center' }}>
        {/* Label acima */}
        <Text style={{ fontSize: 9, color: '#64748B', letterSpacing: 3, fontFamily: 'Helvetica-Bold', marginBottom: 18, textTransform: 'uppercase' }}>
          Estudo Completo de Produto
        </Text>

        {/* Nome do produto */}
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 38, color: C.textInverse, lineHeight: 1.15, marginBottom: 20 }}>
          {productName}
        </Text>

        {/* Linha de destaque laranja */}
        <View style={{ width: 56, height: 4, backgroundColor: C.brand, borderRadius: 2, marginBottom: 28 }} />

        {/* Chips de metadados */}
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {platform && (
            <View style={{ backgroundColor: '#1E2A3A', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 8.5, color: '#94A3B8', fontFamily: 'Helvetica-Bold' }}>
                {platform}
              </Text>
            </View>
          )}
          {ticketPrice && (
            <View style={{ backgroundColor: '#1E2A3A', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 8.5, color: '#94A3B8', fontFamily: 'Helvetica-Bold' }}>
                R$ {parseFloat(ticketPrice).toLocaleString('pt-BR')}
              </Text>
            </View>
          )}
          {niche && (
            <View style={{ backgroundColor: '#1E2A3A', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 }}>
              <Text style={{ fontSize: 8.5, color: '#94A3B8', fontFamily: 'Helvetica-Bold' }}>
                {niche}
              </Text>
            </View>
          )}
          <View style={{ borderWidth: 1, borderColor: `${C.brand}40`, backgroundColor: `${C.brand}10`, borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5 }}>
            <Text style={{ fontSize: 8.5, color: C.brand, fontFamily: 'Helvetica-Bold' }}>
              {sku}
            </Text>
          </View>
        </View>
      </View>

      {/* Rodapé da capa */}
      <View style={{ paddingHorizontal: 48, paddingBottom: 44 }}>
        <View style={{ height: 1, backgroundColor: '#1E2A3A', marginBottom: 20 }} />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <View>
            <Text style={{ fontSize: 8, color: '#475569', marginBottom: 3 }}>Documento gerado automaticamente por</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 9, color: C.brand, fontFamily: 'Helvetica-Bold' }}>AdCraft AI</Text>
              <Text style={{ fontSize: 9, color: '#475569' }}>— Sistema de Marketing com Inteligência Artificial</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 7.5, color: '#475569', marginBottom: 2 }}>Data de geração</Text>
            <Text style={{ fontSize: 9, color: '#94A3B8', fontFamily: 'Helvetica-Bold' }}>{date}</Text>
          </View>
        </View>
      </View>
    </Page>
  )
}
