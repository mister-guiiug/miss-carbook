import { spawnSync } from 'node:child_process'

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

function extractCommand(payload) {
  if (!payload || typeof payload !== 'object') return ''
  const c = payload.command
  if (typeof c === 'string') return c
  const input = payload.input
  if (input && typeof input === 'object' && typeof input.command === 'string') return input.command
  return ''
}

function hasFlag(cmd, flag) {
  return new RegExp(`\\s${flag}(\\s|$)`, 'i').test(cmd)
}

function isSupabaseCmd(cmd) {
  return /\bsupabase\b/i.test(cmd)
}

function isSupabaseDbReset(cmd) {
  return /\bsupabase\b.*\bdb\b.*\breset\b/i.test(cmd)
}

function isSupabaseDbPush(cmd) {
  return /\bsupabase\b.*\bdb\b.*\bpush\b/i.test(cmd)
}

function isSupabaseMigrationNew(cmd) {
  // supabase migration new <name>
  return /\bsupabase\b.*\bmigration\b.*\bnew\b/i.test(cmd)
}

function isIncludeAllRisk(cmd) {
  return hasFlag(cmd, '--include-all')
}

function isLinkedOrRemote(cmd) {
  // heuristique : --linked ou --db-url (risque d'agir sur remote)
  return hasFlag(cmd, '--linked') || hasFlag(cmd, '--db-url') || /\bdb-url\b/i.test(cmd)
}

function respond(obj) {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

function commandExists(bin) {
  const which = process.platform === 'win32' ? 'where' : 'command'
  const args = process.platform === 'win32' ? [bin] : ['-v', bin]
  const r = spawnSync(which, args, { stdio: 'ignore', shell: false })
  return r.status === 0
}

async function main() {
  const raw = await readStdin()
  const payload = safeJsonParse(raw) ?? {}
  const cmd = extractCommand(payload)

  if (!cmd || !isSupabaseCmd(cmd)) {
    respond({ permission: 'allow' })
    return
  }

  if (!commandExists('supabase')) {
    // ne bloque pas : le binaire peut ne pas être sur PATH dans l'environnement hook.
    respond({ permission: 'allow' })
    return
  }

  // 1) reset : toujours confirmation
  if (isSupabaseDbReset(cmd)) {
    respond({
      permission: 'ask',
      user_message:
        'Commande risquée détectée : `supabase db reset` (efface/recrée la base cible). Confirme avant exécution.',
      agent_message: 'Hook : supabase db reset → confirmation requise.',
    })
    return
  }

  // 2) push avec --include-all : confirmation forte
  if (isSupabaseDbPush(cmd) && isIncludeAllRisk(cmd)) {
    respond({
      permission: 'ask',
      user_message:
        'Commande risquée détectée : `supabase db push --include-all` (applique aussi des migrations “dans le passé”). Confirme avant exécution.',
      agent_message: 'Hook : supabase db push --include-all → confirmation requise.',
    })
    return
  }

  // 3) push vers remote / linked : confirmation
  if (isSupabaseDbPush(cmd) && isLinkedOrRemote(cmd)) {
    respond({
      permission: 'ask',
      user_message:
        'Commande sensible détectée : `supabase db push` avec un contexte remote/linked (`--linked`/`--db-url`). Confirme avant exécution.',
      agent_message: 'Hook : supabase db push (linked/remote) → confirmation requise.',
    })
    return
  }

  // 4) migration new : autoriser (faible risque), mais on laisse passer
  if (isSupabaseMigrationNew(cmd)) {
    respond({ permission: 'allow' })
    return
  }

  respond({ permission: 'allow' })
}

void main()
