import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { ContextFill, StepUsage, Totals } from '../types'

const PANE = 'token-chart'
const TITLE = 'Token usage'
const MAX_STEPS = 200
const DEFAULT_WINDOW = 200_000
const HEADER_ROWS = 6
const LABEL_COLUMNS = 5 // "#123 "
const VALUE_COLUMNS = 13 // " 123k ↑12.3k"

// Change a shape tag when its value's fields change: an older stored value is declined.
const steps = atom({ plugin: 'token-chart', key: 'steps' } as const, [], {
  shape: 'steps-1',
})
const context = atom({ plugin: 'token-chart', key: 'context' } as const, null, {
  shape: 'context-1',
})
// Counted over the whole session, not just the last MAX_STEPS rows kept.
const totals = atom({ plugin: 'token-chart', key: 'totals' } as const, { requests: 0, output: 0 }, {
  shape: 'totals-1',
})
const cost = atom({ plugin: 'token-chart', key: 'cost' } as const, null, {
  shape: 'cost-1',
})

const SEGMENTS = [
  { field: 'cacheRead', color: 'subtle', glyph: '▓', label: 'cache read' },
  { field: 'cacheWrite', color: 'warning', glyph: '█', label: 'cache write' },
  { field: 'input', color: 'suggestion', glyph: '█', label: 'input' },
] as const

export const contextOf = (s: StepUsage): number => s.cacheRead + s.cacheWrite + s.input

// From here `Math.round(n / 1000)` would read 1000k: switch to M instead.
const MEGA_FROM = 999_500

export const formatTokens = (n: number): string =>
  n >= MEGA_FROM ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 10_000 ? `${Math.round(n / 1000)}k`
      : n >= 1000 ? `${(n / 1000).toFixed(1)}k`
        : String(n)

type Segment = (typeof SEGMENTS)[number]
export type SizedSegment = Segment & { cells: number }

/**
 * Splits `width` cells among the segments by their share of `window`. A
 * non-zero segment gets at least one cell, so small writes stay visible; the
 * cells that lift adds are taken back from the widest segment, so the bar
 * never runs past `width`.
 */
export const sizeSegments = (s: StepUsage, window: number, width: number): SizedSegment[] => {
  const scale = width / Math.max(window, contextOf(s), 1)
  const lifted = SEGMENTS.map(seg => {
    const cells = Math.floor(s[seg.field] * scale)
    return { ...seg, cells: cells === 0 && s[seg.field] > 0 ? 1 : cells }
  })
  const overflow = lifted.reduce((sum, seg) => sum + seg.cells, 0) - width
  if (overflow <= 0) return lifted
  const widest = lifted.reduce((best, seg, i) => (seg.cells > (lifted[best]?.cells ?? 0) ? i : best), 0)
  return lifted.map((seg, i) => (i === widest ? { ...seg, cells: Math.max(0, seg.cells - overflow) } : seg))
}

export const formatCost = (usd: number | null): string => (usd === null ? '-' : `$${usd.toFixed(2)}`)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'token-chart',
        description: '요청별 토큰 사용량 차트를 옆 창에 엽니다',
      })
      void $.ui.open({ id: PANE, title: TITLE })
        .catch((err: unknown) => $.ui.log(`token-chart: could not open the pane: ${String(err)}`, { to: 'debug' }))
    } catch (err: unknown) {
      // Logged, not thrown: the rest of the chain still runs below.
      $.ui.log(`token-chart: /token-chart is unavailable: ${String(err)}`)
    }

    return next(e)
  })

  on('command.run', { command: 'token-chart' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Token usage 창을 열었습니다.' }
  })

  // Every model request of the main thread: record what it cost.
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result?.usage
    if (e.agentId !== undefined || !usage) return result

    const step: StepUsage = {
      turnId: e.turnId,
      index: e.index,
      model: usage.model,
      input: usage.input_tokens,
      output: usage.output_tokens,
      cacheRead: usage.cache_read_input_tokens,
      cacheWrite: usage.cache_creation_input_tokens,
    }
    await update($, steps, list => [...list, step].slice(-MAX_STEPS))
    await update($, totals, t => ({ requests: t.requests + 1, output: t.output + step.output }))

    return result
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) {
      const { tokens, window, percent } = e.context
      await update($, context, () => ({ tokens, window, percent }))
    }
    const usd = e.cost?.usd
    if (e.changed.includes('cost') && usd !== undefined) {
      await update($, cost, () => usd)
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list = await read($, steps)
    const fill: ContextFill | null = await read($, context)
    const sum: Totals = await read($, totals)
    const usd: number | null = await read($, cost)
    const columns = Math.max(20, e.props.bodyColumns ?? 40)
    const rows = e.props.scroll?.bodyRows ?? e.viewport?.rows ?? 24
    const window = fill?.window ?? DEFAULT_WINDOW
    const barWidth = Math.max(4, columns - LABEL_COLUMNS - VALUE_COLUMNS)
    const shown = list.slice(-Math.max(1, rows - HEADER_ROWS))
    // Numbered over the session, so a row keeps its number as older rows drop off.
    const firstNumber = Math.max(1, sum.requests - shown.length + 1)
    const isTrimmed = sum.requests > list.length

    return (
      <Box flexDirection="column">
        <Text bold>Session cost {formatCost(usd)}</Text>
        <Text bold>
          Context {fill?.percent ?? '-'}% ({formatTokens(fill?.tokens ?? 0)} / {formatTokens(window)})
        </Text>
        <Text dimColor>
          {sum.requests} requests · output total {formatTokens(sum.output)}
          {isTrimmed ? ` · showing last ${list.length}` : ''}
        </Text>
        <Text>
          {SEGMENTS.map(seg => (
            <Text color={seg.color}>{seg.glyph} {seg.label}  </Text>
          ))}
        </Text>
        <Text dimColor>{'─'.repeat(columns)}</Text>
        {shown.length === 0 && <Text dimColor>No requests yet.</Text>}
        {shown.map((s, i) => {
          const sized = sizeSegments(s, window, barWidth)
          const used = sized.reduce((total, seg) => total + seg.cells, 0)
          return (
            <Text>
              <Text dimColor>{`#${firstNumber + i}`.padEnd(LABEL_COLUMNS)}</Text>
              {sized.map(seg => (
                <Text color={seg.color}>{seg.glyph.repeat(seg.cells)}</Text>
              ))}
              <Text dimColor>{'·'.repeat(Math.max(0, barWidth - used))}</Text>
              <Text> {formatTokens(contextOf(s)).padStart(5)} </Text>
              <Text color="success">↑{formatTokens(s.output)}</Text>
            </Text>
          )
        })}
      </Box>
    )
  })
}
