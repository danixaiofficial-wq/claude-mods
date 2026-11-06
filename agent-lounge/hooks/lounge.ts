// Pure helpers of the agent lounge: records, mascots, formatting.
import type { AgentRecord, AgentState } from '../types'

/** Records kept; past it the oldest finished agent goes first (`touch`). */
export const MAX_AGENTS = 50
export const MASCOT_COLUMNS = 9

/** Wiggles once per tool call, so a working agent looks busy. */
const RUNNING_FRAMES = ['(✻ᴗ✻)/ ', '(✻ᴗ✻)- ', '\\(✻ᴗ✻) '] as const

const RESTING: Record<Exclude<AgentState, 'running'>, string> = {
  completed: '\\(✻ᴗ✻)/',
  failed: '(✻x✻); ',
  killed: '(✻-✻)z ',
}

export const STATE_LABEL: Record<AgentState, string> = {
  running: 'working',
  completed: 'done',
  failed: 'failed',
  killed: 'stopped',
}

export const mascotOf = (a: AgentRecord): string =>
  (a.status === 'running'
    ? RUNNING_FRAMES[a.toolCalls % RUNNING_FRAMES.length] ?? RUNNING_FRAMES[0]
    : RESTING[a.status]
  ).padEnd(MASCOT_COLUMNS)

/** A small prop each agent type holds, so types tell apart at a glance. */
export const propOf = (type: string): string => {
  const t = type.toLowerCase()
  if (t.includes('explore') || t.includes('search')) return '⌕'
  if (t.includes('plan') || t.includes('architect')) return '✎'
  if (t.includes('review')) return '✓'
  if (t.includes('test') || t.includes('tdd')) return '⚗'
  if (t.includes('build') || t.includes('resolver')) return '⚒'
  if (t.includes('doc')) return '¶'
  return '✦'
}

const TYPE_COLORS = [
  'claude', 'suggestion', 'success', 'warning', 'planMode',
  'autoAccept', 'ide', 'merged', 'remember', 'permission',
] as const

/** One stable theme color per agent type. */
export const colorOf = (type: string): (typeof TYPE_COLORS)[number] => {
  let hash = 0
  for (const ch of type) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return TYPE_COLORS[hash % TYPE_COLORS.length] ?? 'claude'
}

// From here `Math.round(n / 1000)` would read 1000k: switch to M instead.
const MEGA_FROM = 999_500

export const formatTokens = (n: number): string =>
  n >= MEGA_FROM ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 10_000 ? `${Math.round(n / 1000)}k`
      : n >= 1000 ? `${(n / 1000).toFixed(1)}k`
        : String(n)

export const formatDuration = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`
}

/**
 * Cuts by code point, so a surrogate pair is never split. `width` counts code
 * points, not terminal cells: a ZWJ emoji sequence can still be cut apart, and
 * wide (CJK, Hangul) text takes more cells than `width`.
 */
export const truncate = (text: string, width: number): string => {
  if (width <= 0) return ''
  const chars = Array.from(text)
  return chars.length <= width ? text : `${chars.slice(0, width - 1).join('')}…`
}

export const newRecord = (id: string, now: number, fields: Partial<AgentRecord> = {}): AgentRecord => ({
  id,
  type: 'agent',
  description: '',
  status: 'running',
  startedAt: now,
  toolCalls: 0,
  contextTokens: 0,
  outputTokens: 0,
  ...fields,
})

/**
 * Drops one record once the list is past MAX_AGENTS: the oldest finished
 * agent, so a working one is never pushed out; the oldest of all only when
 * every record is still working.
 */
const evictOne = (list: readonly AgentRecord[]): AgentRecord[] => {
  const finished = list.findIndex(a => a.status !== 'running')
  const drop = finished === -1 ? 0 : finished
  return list.filter((_, i) => i !== drop)
}

/**
 * Applies `change` to the agent `id`, adding a record first if none exists.
 * Adding past MAX_AGENTS evicts one record (see `evictOne`).
 */
export const touch = (
  list: readonly AgentRecord[],
  id: string,
  now: number,
  change: (a: AgentRecord) => AgentRecord,
): AgentRecord[] => {
  if (list.some(a => a.id === id)) return list.map(a => (a.id === id ? change(a) : a))
  const added = [...list, change(newRecord(id, now))]
  return added.length > MAX_AGENTS ? evictOne(added) : added
}

/** Working agents first, then the most recent. */
export const ordered = (list: readonly AgentRecord[]): AgentRecord[] =>
  [...list].sort((a, b) =>
    Number(b.status === 'running') - Number(a.status === 'running') || b.startedAt - a.startedAt)

export type Tally = { type: string; count: number }

// A Map, not an object: a type named `constructor` must not read Object.prototype.
export const tallyByType = (list: readonly AgentRecord[]): Tally[] => {
  const counts = list.reduce(
    (acc, a) => new Map(acc).set(a.type, (acc.get(a.type) ?? 0) + 1),
    new Map<string, number>(),
  )
  return Array.from(counts, ([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
}

const ACTIVITY_COLUMNS = 48

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)
const baseName = (path: string): string => path.split('/').filter(Boolean).pop() ?? path
const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim()

/** What a tool call is doing, in a few words: `Read lounge.ts`, `$ git status`. */
export const activityOf = (tool: string, args: Readonly<Record<string, unknown>>): string => {
  const path = str(args.file_path) ?? str(args.notebook_path) ?? str(args.path)
  const said = ((): string => {
    switch (tool) {
      case 'Read': case 'Edit': case 'Write': case 'MultiEdit': case 'NotebookEdit':
        return path ? `${tool} ${baseName(path)}` : tool
      case 'Grep': return `Grep "${str(args.pattern) ?? ''}"`
      case 'Glob': return `Glob ${str(args.pattern) ?? ''}`
      case 'Bash': return `$ ${oneLine(str(args.command) ?? '')}`
      case 'WebFetch': return `Fetch ${str(args.url)?.replace(/^https?:\/\//, '').split('/')[0] ?? ''}`
      case 'WebSearch': return `Search "${str(args.query) ?? ''}"`
      case 'Agent': return `Agent ${str(args.description) ?? ''}`
      default: return tool.startsWith('mcp__') ? tool.split('__').slice(1).join(' ') : tool
    }
  })()
  return truncate(oneLine(said), ACTIVITY_COLUMNS)
}

/** A record built from a tool call or a step before its spawn was seen. */
export const isPlaceholder = (a: AgentRecord): boolean => a.type === 'agent' && a.description === ''
