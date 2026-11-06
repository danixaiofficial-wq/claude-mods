import { expect, test } from 'claude-code/testing'

import { buildSwitches, cellsOf, fitCells, findSwitch, isBlocked, readOff, serverOf, toggle } from '../hooks/switchboard'

const TOOLS = [
  { name: 'Read', description: 'r', mcp: false },
  { name: 'Edit', description: 'e', mcp: false },
  { name: 'Bash', description: 'b', mcp: false },
  { name: 'WebFetch', description: 'w', mcp: false },
  { name: 'Mystery', description: 'm', mcp: false },
  { name: 'mcp__claude_ai_Gmail__create_draft', description: 'g', mcp: true },
  { name: 'mcp__claude_ai_Gmail__send_message', description: 'g', mcp: true },
  { name: 'mcp__plugin-authoring__scan_secrets', description: 's', mcp: true },
]

const PANE = {
  plugin: 'dukkeobi',
  component: 'Pane',
  requestId: 'dukkeobi',
  props: {
    title: '⚡ 도구 두꺼비집',
    isFocused: true,
    bodyColumns: 90,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

/** A tool call; typed loosely to keep tsc's instantiation shallow. */
type LooseToolCall = (input: Readonly<Record<string, unknown>>) => Promise<{ deny?: string; text?: string }>

test('built-in tools get one switch each, an MCP server one for all its tools', () => {
  const switches = buildSwitches(TOOLS)

  expect(switches.map(s => s.key)).toEqual([
    'Edit', 'Read', 'Bash', 'WebFetch', 'Mystery', 'mcp:claude_ai_Gmail', 'mcp:plugin-authoring',
  ])
  expect(switches.find(s => s.key === 'mcp:claude_ai_Gmail')).toEqual({
    key: 'mcp:claude_ai_Gmail', label: 'claude.ai Gmail', hint: '2개', section: 'MCP 서버',
  })
  expect(serverOf('Bash')).toBeNull()
  expect(serverOf('mcp__plugin-authoring__scan_secrets')).toBe('plugin-authoring')
})

test('a switch down blocks its tool, and every tool of a server switched off', () => {
  const off = toggle([], 'mcp:claude_ai_Gmail')

  expect(isBlocked(off, 'mcp__claude_ai_Gmail__send_message')).toBe(true)
  expect(isBlocked(off, 'Bash')).toBe(false)
  expect(toggle(off, 'mcp:claude_ai_Gmail')).toEqual([])
  expect(off).toEqual(['mcp:claude_ai_Gmail']) // the old list is untouched
  expect(findSwitch(buildSwitches(TOOLS), 'bash')?.key).toBe('Bash')
  expect(findSwitch(buildSwitches(TOOLS), 'claude.ai gmail')?.key).toBe('mcp:claude_ai_Gmail')
  expect(readOff(['Bash', 3, null])).toEqual(['Bash'])
  expect(readOff('Bash')).toEqual([])
})

test('Hangul takes two cells, and a cell is cut and padded to fit', () => {
  expect(cellsOf('셸 명령')).toBe(7)
  expect(fitCells('Bash', 6)).toBe('Bash  ')
  expect(fitCells('claude.ai Gmail', 8)).toBe('claude.…')
  expect(cellsOf(fitCells('프로세스 감시', 9))).toBe(9)
})

test('/dukkeobi off blocks the tool for the model, and on lets it through again', async ($, on) => {
  const kept = new Map<string, unknown>()
  const toasts: string[] = []
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('tool.list', () => ({ value: TOOLS }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', (_, e) => (toasts.push(String(e.text)), { value: undefined }))
  on('tool.call', () => ({ result: 'ran', text: 'ran' }))
  const run = (args: string) => $.command.run({
    command: 'dukkeobi', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 },
  })
  const call = $.tool.call as unknown as LooseToolCall

  expect((await run('off bash')).text).toContain('Bash 차단기를 내렸습니다')
  const blocked = await call({ tool: 'Bash', command: 'rm -rf build' })
  expect(blocked.deny).toContain('/dukkeobi')
  expect(kept.get('off')).toEqual(['Bash'])
  expect(toasts.at(-1)).toContain('호출을 막았습니다')

  expect((await run('on Bash')).text).toContain('올렸습니다')
  expect((await call({ tool: 'Bash', command: 'ls' })).deny).toBeUndefined()
  expect((await run('off nothing-here')).text).toContain('찾지 못했습니다')
})

test('presets set the whole board at once', async ($, on) => {
  const kept = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('tool.list', () => ({ value: TOOLS }))
  on('ui.status', () => ({ value: undefined }))
  const run = (args: string) => $.command.run({
    command: 'dukkeobi', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 },
  })

  await run('readonly')
  expect(kept.get('off')).toEqual(['Edit', 'Bash'])
  await run('nomcp')
  expect(kept.get('off')).toEqual(['mcp:claude_ai_Gmail', 'mcp:plugin-authoring'])
  expect((await run('status')).text).toContain('내림 2')
  await run('all')
  expect(kept.get('off')).toEqual([])
})

test('the pane draws each switch, and a press flips it', async ($, on) => {
  const kept = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('tool.list', () => ({ value: TOOLS }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /켜짐 7/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /MCP 서버/ })).toBeTruthy()

  await ui.press({ key: 'sw:WebFetch' })
  expect(kept.get('off')).toEqual(['WebFetch'])
  await ui.unmount()

  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /내림 1/ })).toBeTruthy()
  await after.press({ key: 'preset:all' })
  expect(kept.get('off')).toEqual([])
  await after.unmount()
})
