// Копирует анимации из общей папки проекта: SVG и manifest.json в public/animations,
// интерактивную библиотеку тренажёров (machines.js/css) в src/vendor/gym-machines
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'

const src = process.env.ANIMATIONS_DIR ?? '/mnt/project-files/exercise-animations'
const dst = new URL('../public/animations/', import.meta.url).pathname
const vendor = new URL('../src/vendor/gym-machines/', import.meta.url).pathname
if (!existsSync(src)) {
  console.log(`Анимации не найдены в ${src}, пропускаю`)
  process.exit(0)
}
rmSync(dst, { recursive: true, force: true })
mkdirSync(dst, { recursive: true })
cpSync(`${src}/svg`, dst, { recursive: true })
if (existsSync(`${src}/thumb`)) cpSync(`${src}/thumb`, `${dst}/thumb`, { recursive: true })
if (existsSync(`${src}/manifest.json`)) cpSync(`${src}/manifest.json`, `${dst}/manifest.json`)
if (existsSync(`${src}/interactive`)) {
  mkdirSync(vendor, { recursive: true })
  cpSync(`${src}/interactive`, vendor, { recursive: true })
}
console.log(`Анимации скопированы из ${src}`)
