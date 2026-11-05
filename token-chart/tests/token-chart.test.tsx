import { expect, test } from 'claude-code/testing'

import { formatCost, formatTokens, sizeSegments } from '../hooks/register'

const PANE = {
  plugin: 'token-chart',
  component: 'Pane',
  requestId: 'token-chart',
  props: {
    title: 'Token usage',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

/** Reads a streaming dispatch to its end, so the hooks beneath it run. */
const drain = async <C, R>(stream: AsyncGenerator<C, R> & { result: Promise<R> }): Promise<R> => {
  for await (const _chunk of stream) { /* chunks are not checked here */ }
  return stream.result
}

const USAGE = {
  model: 'claude-opus-5-5',
  input_tokens: 2_000,
  output_tokens: 1_500,
  cache_read_input_tokens: 80_000,
  cache_creation_input_tokens: 18_000,
}

test('formatTokens shortens large counts', () => {
  expect(formatTokens(950)).toBe('950')
  expect(formatTokens(1_500)).toBe('1.5k')
  expect(formatTokens(98_000)).toBe('98k')
  expect(formatTokens(1_200_000)).toBe('1.2M')
  expect(formatTokens(999_999)).toBe('1.0M')
})

test('sizeSegments scales to the window and keeps tiny segments visible', () => {
  const step = {
    turnId: 't', index: 0, model: 'm',
    input: 10, output: 0, cacheRead: 100_000, cacheWrite: 0,
  }
  const sized = sizeSegments(step, 200_000, 40)

  expect(sized.map(s => s.cells)).toEqual([20, 0, 1])
})

test('the lifted cells never push a bar past its width', () => {
  const step = {
    turnId: 't', index: 0, model: 'm',
    input: 5, output: 0, cacheRead: 199_990, cacheWrite: 5,
  }
  const sized = sizeSegments(step, 200_000, 10)

  expect(sized.reduce((sum, s) => sum + s.cells, 0)).toBe(10)
  expect(sized.map(s => s.cells)).toEqual([8, 1, 1])
})

test('formatCost shows a dash before the first reading', () => {
  expect(formatCost(null)).toBe('-')
  expect(formatCost(1.234)).toBe('$1.23')
})

test('a main-thread request shows up as a chart row', async ($, on) => {
  on('command.register', () => ({ value: { command: 'token-chart' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId, index: e.index, answer: '', toolUses: [],
      stopReason: 'end_turn' as const, usage: USAGE,
    }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await drain($.turn.step({ turnId: 't1', index: 0, model: 'opus', messageCount: 1 }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^1 requests/ }))?.text).toContain('output total 1.5k')
  expect(await ui.find({ type: 'Text', text: /#1/ })).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /Session cost/ }))?.text).toBe('Session cost -')
  await ui.unmount()
})

test('a subagent request is left out', async ($, on) => {
  on('turn.step', async function* (_, e) {
    return {
      turnId: e.turnId, index: e.index, answer: '', toolUses: [],
      stopReason: 'end_turn' as const, usage: USAGE,
    }
  })

  await drain($.turn.step({ turnId: 't1', index: 0, model: 'opus', messageCount: 1, agentId: 'a1' }))

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /No requests yet/ }))?.text).toBe('No requests yet.')
  await ui.unmount()
})
