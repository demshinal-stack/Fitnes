/**
 * Миниатюры и manifest потока анимаций, встроенные прямо в сборку:
 * так приложение работает и одним HTML-файлом, без папки animations рядом.
 */
import manifest from '../../public/animations/manifest.json'

const raw = import.meta.glob('../../public/animations/thumb/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const thumbs: Record<string, string> = {}
for (const [path, svg] of Object.entries(raw)) {
  const id = path.split('/').pop()!.replace('.svg', '')
  // Метаданные подписи (c2pa) занимают половину файла и рисунку не нужны
  thumbs[id] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace(/<metadata>[\s\S]*?<\/metadata>/, ''))
}

export const thumbSrc = (id: string): string | undefined => thumbs[id]

export interface ManifestEntry {
  id: string
  tempo?: string
  rest_sec?: number
}

export const manifestEntry = (id: string): ManifestEntry | null =>
  ((manifest as { exercises?: ManifestEntry[] }).exercises ?? []).find((e) => e.id === id) ?? null
