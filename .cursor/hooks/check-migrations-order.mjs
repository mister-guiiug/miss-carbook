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
    for (const v of Object.values(node)) collectPossiblePaths(v, out)
  }
}

function normalizeRepoPath(p) {
  const t = String(p ?? '').trim()
  if (!t) return null
  if (/^[a-z]+:\/\//i.test(t)) return null
  return t.replace(/\\/g, '/').replace(/^([a-zA-Z]:)?\//, '')
}

function isMigrationFile(rel) {
  return /^supabase\/migrations\/\d{14}_.+\.sql$/i.test(rel)
}

function tsFromName(rel) {
  const m = rel.match(/supabase\/migrations\/(\d{14})_/i)
  return m ? m[1] : null
}

function listMigrationTimestamps(migrationsDir) {
  const out = []
  for (const name of fs.readdirSync(migrationsDir)) {
    const m = String(name).match(/^(\d{14})_.+\.sql$/)
    if (m) out.push(m[1])
  }
  out.sort()
  return out
}

async function main() {
  const raw = await readStdin()
  const payload = safeJsonParse(raw) ?? {}

  const paths = new Set()
  collectPossiblePaths(payload, paths)

  const touched = [...paths].map(normalizeRepoPath).filter(Boolean)
  const migrationTouched = touched.filter((p) => isMigrationFile(p))
  if (migrationTouched.length === 0) process.exit(0)

  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations')
  if (!fs.existsSync(migrationsDir)) process.exit(0)

  const allTs = listMigrationTimestamps(migrationsDir)
  if (allTs.length === 0) process.exit(0)

  const maxTs = allTs[allTs.length - 1]
  for (const rel of migrationTouched) {
    const ts = tsFromName(rel)
    if (!ts) continue
    if (ts < maxTs) {
      // Avertissement non bloquant: empêche de répéter le piège "migration dans le passé".
      // (Le remote peut avoir encore plus loin; ce hook reste un garde-fou local.)
      process.stderr.write(
        [
          '',
          '[cursor-hook] Migration potentiellement “dans le passé” détectée.',
          `- Fichier: ${rel}`,
          `- Timestamp: ${ts}`,
          `- Dernière migration locale: ${maxTs}`,
          'Conseil: renomme la migration avec un timestamp > dernière migration (remote comprise) pour éviter `supabase db push --include-all`.',
          '',
        ].join('\n')
      )
    }
  }

  process.exit(0)
}

void main()
