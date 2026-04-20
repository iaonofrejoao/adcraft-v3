import type { StoryboardEntry, ArtifactRow, ScriptData, KeyframesData, VideoAssetsData } from '@/components/produto-tabs/StoryboardTab'

export async function fetchCreativeEntries(sku: string): Promise<StoryboardEntry[]> {
  const [scrRes, kfRes, vRes] = await Promise.all([
    fetch(`/api/products/${sku}/creative-artifacts?type=script`).then(r => r.json()),
    fetch(`/api/products/${sku}/creative-artifacts?type=keyframes`).then(r => r.json()),
    fetch(`/api/products/${sku}/creative-artifacts?type=video_assets`).then(r => r.json()),
  ])

  const scrRows: ArtifactRow<ScriptData>[]     = scrRes.artifacts ?? []
  const kfRows:  ArtifactRow<KeyframesData>[]  = kfRes.artifacts ?? []
  const vRows:   ArtifactRow<VideoAssetsData>[] = vRes.artifacts ?? []

  const map = new Map<string, StoryboardEntry>()
  const ensure = (cid: string, tag: string) => {
    if (!map.has(cid)) map.set(cid, { combinationId: cid, tag, script: null, keyframes: null, video: null })
  }

  scrRows.forEach(row => { const cid = row.copy_combination_id; if (!cid) return; ensure(cid, row.copy_combinations?.tag ?? cid); map.get(cid)!.script = row })
  kfRows.forEach(row  => { const cid = row.copy_combination_id; if (!cid) return; ensure(cid, row.copy_combinations?.tag ?? cid); map.get(cid)!.keyframes = row })
  vRows.forEach(row   => { const cid = row.copy_combination_id; if (!cid) return; ensure(cid, row.copy_combinations?.tag ?? cid); map.get(cid)!.video = row })

  return Array.from(map.values())
}
