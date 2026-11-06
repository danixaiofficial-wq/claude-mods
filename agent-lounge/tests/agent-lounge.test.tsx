import type { AgentInfo } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { MAX_AGENTS, activityOf, colorOf, formatDuration, formatTokens, mascotOf, newRecord, ordered, tallyByType, touch, truncate } from '../hooks/lounge'

const PANE = {
  plugin: 'agent-lounge',
  component: 'Pane',
  requestId: 'agent-lounge',
  props: {
    title: '✻ Agent Lounge',
    isFocused: false,
    bodyColumns: 64,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** A tool call from a subagent's loop; typed loosely to keep tsc's instantiation shallow. */
type LooseToolCall = (input: Readonly<Record<string, unknown>>) => Promise<unknown>

/** Reads a streaming dispatch to its end, so the hooks beneath it run. */
const drain = async <C, R>(stream: AsyncGenerator<C, R> & { result: Promise<R> }): Promise<R> => {
  for await (const _chunk of stream) { /* chunks are not checked here */ }
  return stream.result
}

test('mascots change with the state and wiggle per tool call', () => {
  const a = newRecord('a', 0)
  expect(mascotOf(a)).not.toBe(mascotOf({ ...a, toolCalls: 1 }))
  expect(mascotOf({ ...a, status: 'completed' }).trim()).toBe('\\(✻ᴗ✻)/')
  expect(mascotOf({ ...a, status: 'failed' }).trim()).toBe('(✻x✻);')
})

test('touch adds a missing agent and updates a known one without mutating', () => {
  const first = touch([], 'a', 10, r => ({ ...r, toolCalls: 1 }))
  const second = touch(first, 'a', 20, r => ({ ...r, toolCalls: r.toolCalls + 1 }))
  expect(first[0]?.toolCalls).toBe(1)
  expect(second).toHaveLength(1)
  expect(second[0]?.toolCalls).toBe(2)
})

test('working agents come first and types are tallied', () => {
  const list = [
    newRecord('old', 1, { type: 'Explore', status: 'completed' }),
    newRecord('new', 2, { type: 'Explore', status: 'completed' }),
    newRecord('busy', 0, { type: 'Plan' }),
  ]
  expect(ordered(list).map(a => a.id)).toEqual(['busy', 'new', 'old'])
  expect(tallyByType(list)).toEqual([{ type: 'Explore', count: 2 }, { type: 'Plan', count: 1 }])
  expect(colorOf('Explore')).toBe(colorOf('Explore'))
  expect(formatDuration(83_000)).toBe('1m23s')
})

test('review fixes: 1.0M boundary, prototype-named types, code-point truncation', () => {
  expect(formatTokens(999_999)).toBe('1.0M')
  expect(formatTokens(999_499)).toBe('999k')
  const odd = [newRecord('a', 0, { type: 'constructor' }), newRecord('b', 0, { type: 'constructor' })]
  expect(tallyByType(odd)).toEqual([{ type: 'constructor', count: 2 }])
  expect(truncate('a😀bc', 3)).toBe('a😀…')
  expect(truncate('abc', 0)).toBe('')
})

test('a full list drops the oldest finished agent, never a working one', () => {
  const working = newRecord('busy', 0)
  const done = Array.from({ length: MAX_AGENTS - 1 }, (_, i) => newRecord(`d${i}`, i + 1, { status: 'completed' }))
  const next = touch([working, ...done], 'new', 100, r => r)

  expect(next).toHaveLength(MAX_AGENTS)
  expect(next.map(a => a.id)).toContain('busy')
  expect(next.map(a => a.id)).not.toContain('d0')
})

test('activityOf says what a tool call works on', () => {
  expect(activityOf('Read', { file_path: '/a/b/lounge.ts' })).toBe('Read lounge.ts')
  expect(activityOf('Grep', { pattern: 'auth' })).toBe('Grep "auth"')
  expect(activityOf('Bash', { command: 'git   status\n -s' })).toBe('$ git status -s')
  expect(activityOf('WebFetch', { url: 'https://docs.example.com/a/b' })).toBe('Fetch docs.example.com')
  expect(activityOf('mcp__github__get_issue', {})).toBe('github get_issue')
})

test('an agent whose spawn was missed is filled in from the engine list', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('turn.step', async function* (_, e) {
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage: null }
  })
  const lost: AgentInfo = { id: 'lost', type: 'Explore', description: 'map the repo', status: 'running' }
  on('agent.list', () => ({ value: [lost] }))

  await drain($.turn.step({ turnId: 't9', index: 0, model: 'haiku', messageCount: 1, agentId: 'lost' }))
  const run = await $.command.run({
    command: 'agent-lounge', args: 'status', origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 },
  })

  expect(run.text).toContain('running   Explore · map the repo · 0 tools')
})

test('a spawned agent shows its tools, tokens and finish in the pane', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  on('clock.every', () => ({ value: undefined }))
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'ag1' }))
  on('tool.call', () => ({ result: {} }))
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const,
      usage: {
        model: 'claude-haiku-5-5', input_tokens: 1000, output_tokens: 2500,
        cache_read_input_tokens: 30_000, cache_creation_input_tokens: 0,
      },
    }
  })
  on('turn.complete', () => ({ text: 'ok' }))

  await $.agent.spawn({
    tool_use_id: 'tu1', prompt: 'find the auth code', description: 'find auth code', subagentType: 'Explore',
    provider: { plugin: 'engine', tier: 'core' }, parentModel: 'claude-opus-5-5', background: false, fork: false,
  })
  await ($.tool.call as unknown as LooseToolCall)({ tool: 'Bash', command: 'grep -r auth .', agentId: 'ag1' })
  await ($.tool.call as unknown as LooseToolCall)({ tool: 'Read', file_path: '/x', agentId: 'ag1' })
  await drain($.turn.step({ turnId: 't1', index: 0, model: 'haiku', messageCount: 2, agentId: 'ag1' }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /Explore find auth code/ }))?.text).toContain('⌕')
  expect((await ui.find({ type: 'Text', text: /2 tools/ }))?.text).toContain('▸ Read x')
  expect((await ui.find({ type: 'Text', text: /1 working/ }))).toBeTruthy()
  await ui.unmount()

  await $.turn.complete({
    turnId: 't1', agentId: 'ag1', answer: 'found', durationMs: 4000, isAborted: false, reason: 'answer',
  })
  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await after.find({ type: 'Text', text: /done 4s/ }))?.text).toContain('ctx 31k · out 2.5k')
  expect((await after.find({ type: 'Text', text: /0 working/ }))).toBeTruthy()
  await after.unmount()
})

test('an empty lounge shows a sleeping mascot', async ($, on) => {
  on('clock.now', () => ({ value: 1_000_000 }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /zZ/ }))?.text).toBe('(✻ᴗ✻)zZ')
  await ui.unmount()
})
