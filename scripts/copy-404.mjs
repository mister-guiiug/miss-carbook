import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const index = join(dist, 'index.html')
const dest = join(dist, '404.html')

if (!existsSync(index)) {
  console.error('copy-404: dist/index.html introuvable — lancez vite build avant.')
  process.exit(1)
}
copyFileSync(index, dest)
console.log('copy-404: 404.html créé pour le routing SPA sur GitHub Pages.')
