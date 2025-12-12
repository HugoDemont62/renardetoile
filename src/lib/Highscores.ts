export type ScoreEntry = { name: string, score: number, date: string }

const STORAGE_KEY = 'renardetoile_highscores'
const FILE_PATH = './scores.json' // used only in Node env if available

function readLocalStorage(): ScoreEntry[] {
  try {
        if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw) as ScoreEntry[]
    }
  } catch (e) { void e }
  return []
}

function writeLocalStorage(entries: ScoreEntry[]) {
  try {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    }
  } catch (e) { void e }
}

async function tryWriteFileNode(entries: ScoreEntry[]) {
  try {
    // dynamic require to avoid bundlers failing in browser
    const req = (eval('require'))
    const fs = req('fs')
    const path = req('path')
    const maybeProcess = (globalThis as unknown) as { process?: { cwd?: () => string } }
    const cwd = maybeProcess.process && maybeProcess.process.cwd ? maybeProcess.process.cwd() : '.'
    const p = path.resolve(cwd, FILE_PATH)
    fs.writeFileSync(p, JSON.stringify(entries, null, 2), 'utf-8')
  } catch (e) { void e }
}

export async function addScore (name: string | undefined, score: number) {
  const realName = name || getMachineName() || 'Player'
  const entries = readLocalStorage()
  const entry: ScoreEntry = { name: realName, score, date: new Date().toISOString() }
  entries.push(entry)
  // garder les meilleurs 50
  entries.sort((a, b) => b.score - a.score)
  const trimmed = entries.slice(0, 50)
  writeLocalStorage(trimmed)
  await tryWriteFileNode(trimmed)
  return trimmed
}

export function getScores (): ScoreEntry[] {
  return readLocalStorage()
}

export function getMachineName (): string | undefined {
  try {
    // Node environment (use dynamic require)
    const req = (eval('require'))
    const os = req('os')
    return os.hostname()
  } catch (e) { void e }

  try {
    if (typeof navigator !== 'undefined') {
      // fallback to platform/userAgent
      return (navigator.userAgent || navigator.platform || undefined)
    }
  } catch (e) { void e }

  return undefined
}
