import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function readStdin() {
  return new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (c) => (data += c))
    process.stdin.on('end', () => resolve(data))
    process.stdin.resume()
  })
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function collectPossiblePaths(node, out) {
  if (!node) return
  if (typeof node === 'string') {
    if (node.includes('/') || node.includes('\\')) out.add(node)
    return
  }
  if (Array.isArray(node)) {
    for (const x of node) collectPossiblePaths(x, out)
    return
  }
  if (typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      // champs fréquents qu’on tente en premier (mais on parcourt tout ensuite)
      if (k === 'path' || k === 'filePath' || k === 'file' || k === 'filename')
        collectPossiblePaths(v, out)
      collectPossiblePaths(v, out)
    }
  }
}

function normalizeRepoPath(p) {
  const t = String(p ?? '').trim()
  if (!t) return null
  // ignorer chemins URL/URI
  if (/^[a-z]+:\/\//i.test(t)) return null
  // on veut uniquement des fichiers du repo
  const rel = t.replace(/^([a-zA-Z]:)?[\\/]+/, '')
  const cleaned = rel.replace(/\\/g, '/')
  if (cleaned.startsWith('.cursor/')) return null
  return cleaned
}

function isLikelyCodeFile(p) {
  return /\.(ts|tsx|js|jsx|css|json|md|yml|yaml)$/i.test(p)
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: process.cwd(),
    shell: false,
  })
  return typeof r.status === 'number' ? r.status : 1
}

async function main() {
  const lockPath = path.join(process.cwd(), '.cursor', 'hooks', '.quality-lock')
  if (fs.existsSync(lockPath)) {
    // Anti-boucle: si notre propre formatage déclenche afterFileEdit, on s’arrête.
    process.exit(0)
  }
  fs.writeFileSync(lockPath, String(Date.now()), 'utf8')

  try {
    const raw = await readStdin()
    const payload = safeJsonParse(raw) ?? {}

    const paths = new Set()
    collectPossiblePaths(payload, paths)

    const files = [...paths]
      .map(normalizeRepoPath)
      .filter(Boolean)
      .filter(isLikelyCodeFile)
      .map((p) => p.replace(/\\/g, '/'))

    const uniqFiles = [...new Set(files)]
    if (uniqFiles.length === 0) process.exit(0)

    const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'

    // Prettier (write) puis ESLint (fix) pour garder la CI "quality" verte.
    // Si ESLint échoue (ex: fichier non couvert), on ne bloque pas l’édition.
    run(npx, ['prettier', '--write', ...uniqFiles])
    run(npx, ['eslint', '--fix', ...uniqFiles])

    process.exit(0)
  } finally {
    try {
      fs.unlinkSync(lockPath)
    } catch {
      // ignore
    }
  }
}

void main()
