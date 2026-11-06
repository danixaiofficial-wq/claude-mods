import { atom, read, update } from 'claude-code'
import type { AgentInfo, EngineInterface, Register, Timer } from 'claude-code'

import type { AgentRecord, AgentState } from '../types'
import {
  MASCOT_COLUMNS, STATE_LABEL, activityOf, colorOf, formatDuration, formatTokens,
  isPlaceholder, mascotOf, ordered, propOf, tallyByType, touch, truncate,
} from './lounge'

const PANE = 'agent-lounge'
const TITLE = '✻ Agent Lounge'
const HEADER_ROWS = 5
const ROWS_PER_AGENT = 2
const TALLY_BAR_MAX = 12
const TICK_MS = 1000

// Change the shape tag when AgentRecord changes: an older stored list is declined.
const agents = atom({ plugin: 'agent-lounge', key: 'agents' } as const, [], {
  shape: 'agents-2',
})

// Started once per module load from session.start, the hook whose work may
// outlive its dispatch; a timer started inside a shorter hook ends with it.
let ticker: Timer | undefined

const FINISHED: ReadonlySet<string> = new Set(['completed', 'failed', 'killed'])

/** Folds what the engine's agent list says into the records. */
const reconcile = (list: readonly AgentRecord[], infos: readonly AgentInfo[], now: number): AgentRecord[] =>
  infos.reduce((acc, info) => {
    const known = acc.find(a => a.id === info.id)
    // Only agents we already track, or ones still at work, are worth a row.
    if (!known && FINISHED.has(info.status)) return acc
    return touch(acc, info.id, now, a => ({
      ...a,
      type: isPlaceholder(a) ? info.type : a.type,
      description: a.description === '' ? info.description : a.description,
      parentId: a.parentId ?? info.parentId,
      status: FINISHED.has(info.status) && a.status === 'running' ? (info.status as AgentState) : a.status,
    }))
  }, [...list])

/** One tick: catch up with the engine's list, then redraw while anyone works. */
async function tick($: EngineInterface): Promise<void> {
  const list = await read($, agents)
  const isBusy = list.some(a => a.status === 'running' || isPlaceholder(a))
  if (!isBusy) return
  const [infos, now] = await Promise.all([$.agent.list(), $.clock.now()])
  await update($, agents, current => reconcile(current, infos, now))
  $.ui.invalidate('ui.render')
}

function startTicker($: EngineInterface): void {
  if (ticker) return
  ticker = $.clock.every(TICK_MS, () => {
    tick($).catch((err: unknown) => $.ui.log(`agent-lounge: tick failed: ${String(err)}`, { to: 'debug' }))
  })
}

const statusReport = (list: readonly AgentRecord[]): string =>
  list.length === 0
    ? 'agent-lounge: 기록된 에이전트가 없습니다.'
    : [`agent-lounge: ${list.length}개 기록, 타이머 ${ticker ? '동작 중' : '멈춤'}`,
      ...ordered(list).map(a =>
        `${a.status.padEnd(9)} ${a.type} · ${a.description || '(설명 없음)'} · ${a.toolCalls} tools${a.activity ? ` · ${a.activity}` : ''}`),
    ].join('\n')

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      startTicker($)
      await $.command.register({
        name: 'agent-lounge',
        description: 'Agent Lounge 창을 엽니다 (status: 기록 확인)',
      })
      // Opened unasked, a pane waits undrawn on a narrow terminal: say how to open it.
      void $.ui.open({ id: PANE, title: TITLE })
        .then(opened => {
          if (!opened.isPlaced) void $.ui.toast('(✻ᴗ✻) Agent Lounge는 /agent-lounge 로 열 수 있어요')
        })
        .catch((err: unknown) => $.ui.log(`agent-lounge: could not open the pane: ${String(err)}`, { to: 'debug' }))
    } catch (err: unknown) {
      // Logged, not thrown: the rest of the chain still runs below.
      $.ui.log(`agent-lounge: /agent-lounge is unavailable: ${String(err)}`)
    }

    return next(e)
  })

  on('command.run', { command: 'agent-lounge' }, async ($, e) => {
    const [infos, now] = await Promise.all([$.agent.list(), $.clock.now()])
    await update($, agents, list => reconcile(list, infos, now))
    if (e.args.trim() === 'status') return { text: statusReport(await read($, agents)) }
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: 'Agent Lounge 창을 열었습니다.' }
  })

  on('agent.spawn', async ($, e, next) => {
    const result = await next(e)
    const id = result.agentId
    if (!id) return result

    const now = await $.clock.now()
    await update($, agents, list => touch(list, id, now, a => ({
      ...a,
      type: e.subagentType,
      description: e.description,
      model: result.model,
      parentId: e.parentAgentId,
      startedAt: a.toolCalls === 0 ? now : a.startedAt,
    })))
    $.ui.invalidate('ui.render')

    return result
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    if (id === undefined) return next(e)

    const now = await $.clock.now()
    const activity = activityOf(e.tool, e as unknown as Readonly<Record<string, unknown>>)
    await update($, agents, list => touch(list, id, now, a => ({
      ...a, toolCalls: a.toolCalls + 1, lastTool: e.tool, activity,
    })))

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const id = e.agentId
    const usage = result?.usage
    if (id === undefined || !usage) return result

    const now = await $.clock.now()
    const context = usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens
    await update($, agents, list => touch(list, id, now, a => ({
      ...a, contextTokens: context, outputTokens: a.outputTokens + usage.output_tokens,
    })))

    return result
  })

  on('turn.complete', async ($, e, next) => {
    const id = e.agentId
    if (id !== undefined) {
      const now = await $.clock.now()
      const status = e.isAborted ? 'killed' : e.reason === 'error' ? 'failed' : 'completed'
      await update($, agents, list => touch(list, id, now, a => ({
        ...a, status, durationMs: e.durationMs, activity: undefined,
      })))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const list: AgentRecord[] = await read($, agents)
    const now = await $.clock.now()
    const columns = Math.max(24, e.props.bodyColumns ?? 40)
    const rows = e.props.scroll?.bodyRows ?? e.viewport?.rows ?? 24
    const room = Math.max(1, Math.floor((rows - HEADER_ROWS) / ROWS_PER_AGENT))
    const shown = ordered(list).slice(0, room)
    const running = list.filter(a => a.status === 'running').length
    const tally = tallyByType(list)
    const top = tally[0]?.count ?? 1
    const textColumns = columns - MASCOT_COLUMNS - 2

    return (
      <Box flexDirection="column">
        <Text>
          <Text color="claude" bold>✻ </Text>
          <Text bold>{list.length} agents</Text>
          <Text dimColor> · </Text>
          <Text color="claude">{running} working</Text>
          <Text dimColor> · {list.length - running} resting</Text>
        </Text>
        {tally.slice(0, 2).map(t => (
          <Text>
            <Text color={colorOf(t.type)}>{propOf(t.type)} {truncate(t.type, 16).padEnd(17)}</Text>
            <Text color={colorOf(t.type)}>{'■'.repeat(Math.max(1, Math.round((t.count / top) * TALLY_BAR_MAX)))}</Text>
            <Text dimColor> {t.count}</Text>
          </Text>
        ))}
        <Text dimColor>{'─'.repeat(columns)}</Text>
        {shown.length === 0 && (
          <Box flexDirection="column">
            <Text color="claude">(✻ᴗ✻)zZ</Text>
            <Text dimColor>아직 에이전트가 없습니다. 쉬는 중이에요.</Text>
          </Box>
        )}
        {shown.map(a => {
          const elapsed = formatDuration(a.durationMs ?? now - a.startedAt)
          const isResting = a.status !== 'running'
          const about = a.description || '(작업 설명 확인 중…)'
          const detail = isResting
            ? `${STATE_LABEL[a.status]} ${elapsed} · ${a.toolCalls} tools · ctx ${formatTokens(a.contextTokens)} · out ${formatTokens(a.outputTokens)}`
            : `▸ ${a.activity ?? '생각하는 중…'} · ${elapsed} · ${a.toolCalls} tools`
          return (
            <Box flexDirection="column">
              <Text>
                <Text color={isResting ? undefined : 'claude'} dimColor={isResting}>{mascotOf(a)}</Text>
                <Text color={colorOf(a.type)} bold>{propOf(a.type)} {a.type}</Text>
                <Text dimColor={isResting}> {truncate(about, Math.max(0, textColumns - a.type.length - 3))}</Text>
              </Text>
              <Text dimColor={isResting} color={isResting ? undefined : 'suggestion'}>
                {' '.repeat(MASCOT_COLUMNS)}{truncate(detail, textColumns)}
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}
