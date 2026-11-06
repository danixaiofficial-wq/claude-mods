// 도구 두꺼비집: which tool switches exist, which are down, and how a preset sets them.

export type Section = '파일' | '실행' | '웹' | '에이전트' | '기타' | 'MCP 서버'

export const SECTIONS: readonly Section[] = ['파일', '실행', '웹', '에이전트', '기타', 'MCP 서버']

/** One breaker: a built-in tool, or every tool of one MCP server. */
export type Switch = {
  key: string
  label: string
  hint: string
  section: Section
}

export type ToolEntry = { readonly name: string; readonly mcp: boolean }

const MCP_PREFIX = 'mcp__'
const SERVER_KEY = 'mcp:'

const BUILTIN: Readonly<Record<string, readonly [Section, string]>> = {
  Read: ['파일', '파일 읽기'],
  Edit: ['파일', '파일 수정'],
  Write: ['파일', '파일 쓰기'],
  NotebookEdit: ['파일', '노트북 수정'],
  Glob: ['파일', '파일 찾기'],
  Grep: ['파일', '내용 검색'],
  LSP: ['파일', '코드 탐색'],
  Bash: ['실행', '셸 명령'],
  PowerShell: ['실행', '셸 명령'],
  Monitor: ['실행', '프로세스 감시'],
  TaskStop: ['실행', '작업 중지'],
  CronCreate: ['실행', '예약 작업'],
  CronDelete: ['실행', '예약 삭제'],
  CronList: ['실행', '예약 목록'],
  ScheduleWakeup: ['실행', '예약 깨우기'],
  RemoteTrigger: ['실행', '원격 실행'],
  WebFetch: ['웹', '웹 페이지'],
  WebSearch: ['웹', '웹 검색'],
  Agent: ['에이전트', '서브에이전트'],
  SendMessage: ['에이전트', '메시지'],
  ListAgents: ['에이전트', '에이전트 목록'],
  Workflow: ['에이전트', '워크플로'],
  Skill: ['에이전트', '스킬'],
}

/** The MCP server of `mcp__<server>__<tool>`, or null for a built-in tool. */
export const serverOf = (tool: string): string | null => {
  if (!tool.startsWith(MCP_PREFIX)) return null
  const rest = tool.slice(MCP_PREFIX.length)
  const cut = rest.indexOf('__')
  return cut < 0 ? rest : rest.slice(0, cut)
}

export const switchKeyOf = (tool: string): string => {
  const server = serverOf(tool)
  return server === null ? tool : SERVER_KEY + server
}

export const isServerKey = (key: string): boolean => key.startsWith(SERVER_KEY)

export const isBlocked = (off: readonly string[], tool: string): boolean =>
  off.includes(switchKeyOf(tool))

/** `claude_ai_Gmail` reads as `claude.ai Gmail`, as /mcp names it. */
export const serverLabel = (server: string): string =>
  server.replace(/^claude_ai_/, 'claude.ai ').replace(/_/g, ' ')

/** One switch per built-in tool and per MCP server, in section order. */
export const buildSwitches = (tools: readonly ToolEntry[]): Switch[] => {
  const servers = new Map<string, number>()
  const builtins: Switch[] = []
  for (const t of tools) {
    const server = serverOf(t.name)
    if (server !== null) {
      servers.set(server, (servers.get(server) ?? 0) + 1)
      continue
    }
    const [section, hint] = BUILTIN[t.name] ?? ['기타', '']
    builtins.push({ key: t.name, label: t.name, hint, section })
  }
  const mcp: Switch[] = [...servers].map(([server, count]) => ({
    key: SERVER_KEY + server, label: serverLabel(server), hint: `${count}개`, section: 'MCP 서버',
  }))
  const rank = (s: Switch): number => SECTIONS.indexOf(s.section)
  return [...builtins, ...mcp].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label))
}

/** Flips one switch; a new list, the old one untouched. */
export const toggle = (off: readonly string[], key: string): string[] =>
  off.includes(key) ? off.filter(k => k !== key) : [...off, key]

export type Preset = { id: string; hotkey: string; label: string; pick: (switches: readonly Switch[]) => string[] }

const named = (...keys: string[]) => (switches: readonly Switch[]): string[] =>
  switches.filter(s => keys.includes(s.key)).map(s => s.key)

export const PRESETS: readonly Preset[] = [
  { id: 'all', hotkey: '1', label: '전부 켜기', pick: () => [] },
  { id: 'readonly', hotkey: '2', label: '읽기 전용', pick: named('Edit', 'Write', 'NotebookEdit', 'Bash', 'PowerShell') },
  { id: 'offline', hotkey: '3', label: '인터넷 차단', pick: named('WebFetch', 'WebSearch') },
  { id: 'nomcp', hotkey: '4', label: 'MCP 차단', pick: switches => switches.filter(s => isServerKey(s.key)).map(s => s.key) },
]

/** Finds the switch a person named: `bash`, `Bash`, a server's name or its label. */
export const findSwitch = (switches: readonly Switch[], name: string): Switch | undefined => {
  const wanted = name.trim().toLowerCase()
  return switches.find(s =>
    s.key.toLowerCase() === wanted
    || s.label.toLowerCase() === wanted
    || (isServerKey(s.key) && s.key.slice(SERVER_KEY.length).toLowerCase() === wanted))
}

/** What the model reads in place of a blocked tool's result. */
export const denyText = (tool: string): string =>
  `"${tool}" 도구는 사용자가 도구 두꺼비집(/dukkeobi)에서 꺼 두었습니다. `
  + '이 도구 없이 진행하거나, 꼭 필요하면 사용자에게 켜 달라고 요청하세요.'

/** Only a list of strings is read back from the store; anything else is no switch down. */
export const readOff = (stored: unknown): string[] =>
  Array.isArray(stored) ? stored.filter((k): k is string => typeof k === 'string') : []

const WIDE = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/

/** Terminal cells a string takes: Hangul and other wide letters take two. */
export const cellsOf = (text: string): number =>
  Array.from(text).reduce((n, ch) => n + (WIDE.test(ch) ? 2 : 1), 0)

/** Cuts `text` to `max` cells with an ellipsis, then pads it to exactly `max`. */
export const fitCells = (text: string, max: number): string => {
  if (max <= 0) return ''
  if (cellsOf(text) <= max) return text + ' '.repeat(max - cellsOf(text))
  let out = ''
  for (const ch of Array.from(text)) {
    if (cellsOf(out + ch) > max - 1) break
    out += ch
  }
  return out + '…' + ' '.repeat(max - 1 - cellsOf(out))
}
