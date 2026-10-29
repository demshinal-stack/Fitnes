// Собирает версию для публикации как Artifact на claude.ai: JS и CSS встроены в одну страницу,
// фото тренажёров и анимации публикуются рядом отдельными файлами.
import { build } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'

const outDir = 'dist-artifact'
await build({ base: './', plugins: [react(), viteSingleFile()], build: { outDir, emptyOutDir: true }, logLevel: 'warn' })

const html = readFileSync(`${outDir}/index.html`, 'utf8')
const pick = (re) => [...html.matchAll(re)].map((m) => m[0]).join('\n')
const fonts = pick(/<link[^>]+fonts\.googleapis\.com\/css2[^>]+>/g)
const styles = pick(/<style[^>]*>[\s\S]*?<\/style>/g)
const scripts = pick(/<script type="module"[^>]*>[\s\S]*?<\/script>/g)

const page = `<title>Jaylle fitness</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fonts}
${styles}
<div id="root"></div>
${scripts}
`
writeFileSync(`${outDir}/artifact.html`, page)
console.log(`${outDir}/artifact.html: ${(page.length / 1024).toFixed(0)} KB`)
