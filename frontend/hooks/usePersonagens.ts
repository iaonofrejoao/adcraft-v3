'use client'
import { useEffect, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PhysicalDescription {
  age_appearance?: string
  gender?:         string
  ethnicity?:      string
  hair?:           string
  style?:          string
  expression?:     string
}

export interface VisualAnchors {
  clothing_color?:       string
  clothing_type?:        string
  style_description?:    string
  primary_setting?:      string
  secondary_setting?:    string
  lighting?:             string
  signature_expression?: string
}

export interface CharacterEntry {
  character_id?:           string
  character_name?:         string
  character_role?:         string
  physical_description?:   PhysicalDescription
  personality_traits?:     string[]
  visual_anchors?:         VisualAnchors
  image_prompt_en?:        string
  video_prompt_en?:        string
  style_reference?:        string
  prompt_compliance_note?: string | null
  rationale?:              string
  // Old flat-format fallback fields
  character_anchor?:          string
  appearance?:                Record<string, string>
  personality?:               string
  midjourney_anchor_prompt?:  string
  character_rationale?:       string
}

export interface CharacterArtifactData {
  // New format
  characters?:           CharacterEntry[]
  primary_character_id?: string
  consistency_notes?:    string
  // Old flat format
  combination_tag?:          string
  character_role?:           string
  character_anchor?:         string
  appearance?:               Record<string, string>
  personality?:              string
  midjourney_anchor_prompt?: string
  character_rationale?:      string
}

export interface CharacterArtifact {
  id:                  string
  artifact_data:       CharacterArtifactData
  copy_combination_id: string | null
  copy_combinations:   { tag: string; script_status: string } | null
}

export interface CharacterBoard {
  drive_urls:    string[]
  image_urls?:   string[]
  generated_at?: string
}

export interface PersonaAsset {
  id:                          string
  status:                      'creating' | 'ready' | 'failed' | string
  nano_banana_character_board: CharacterBoard | null
  character_boards_by_persona: Record<string, { image_url: string; prompt: string; generated_at: string }> | null
  error_message?:              string | null
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePersonagens(sku: string) {
  const [characters,       setCharacters]       = useState<CharacterArtifact[]>([])
  const [personaAsset,     setPersonaAsset]     = useState<PersonaAsset | null>(null)
  const [characterArtifact, setCharacterArtifact] = useState<CharacterArtifactData | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [error,            setError]            = useState<string | null>(null)

  useEffect(() => {
    if (!sku) return
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`/api/products/${sku}/creative-artifacts?type=character`).then(r => r.json()),
      fetch(`/api/products/${sku}/persona`).then(r => r.json()),
    ])
      .then(([artifactsRes, personaRes]) => {
        setCharacters(artifactsRes.artifacts ?? [])
        setPersonaAsset(personaRes.persona ?? null)
        setCharacterArtifact((personaRes.characterArtifact as CharacterArtifactData | null) ?? null)
      })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [sku])

  return { characters, personaAsset, characterArtifact, loading, error }
}
