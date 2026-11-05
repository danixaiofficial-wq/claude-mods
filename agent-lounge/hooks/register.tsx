import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { AgentRecord } from '../types'
import {
  MASCOT_COLUMNS, STATE_LABEL, colorOf, formatDuration, formatTokens,
  mascotOf, ordered, propOf, tallyByType, touch, truncate,
} from './lounge'

const PANE = 'agent-lounge'
const TITLE = '✻ Agent Lounge'
const HEADER_ROWS = 5
const ROWS_PER_AGENT = 2
const TALLY_BAR_MAX = 12

// Change the shape tag when AgentRecord changes: an older stored list is declined.
const agents = atom({ plugin: 'agent-lounge', key: 'agents' } as const, [], {
  shape: 'agents-1',
})

const TICK_MS = 1000
// One ticker for the module; a reload starts the module, and this, over.
let ticker: Timer | undefined

/** Redraws once a second while any agent works, so its elapsed time moves. */
function ensureTicker($: EngineInterface): void {
  if (ticker) return
  ticker = $.clock.every(TICK_MS, () => {
    void read($, agents).then(list => {
      if (list.some(a => a.status === 'running')) {
        $.ui.invalidate('ui.render')
        return
      }
      ticker?.cancel()
      ticker = undefined
    })
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'agent-lounge',
        description: '서브에이전트 활동을 보여 주는 Agent Lounge 창을 엽니다',
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

  on('command.run', { command: 'agent-lounge' }, async $ => {
    // Pick up agents that started before this mod loaded.
    const now = await $.clock.now()
    const known = await $.agent.list()
    await update($, agents, list => known.reduce(
      (acc, info) => touch(acc, info.id, now, a => ({
        ...a,
        type: info.type,
        description: info.description,
        parentId: info.parentId,
        status: info.status === 'completed' || info.status === 'failed' || info.status === 'killed'
          ? info.status : a.status,
      })),
      list,
    ))
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
      startedAt: now,
    })))
    ensureTicker($)

    return result
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId
    if (id === undefined) return next(e)

    const now = await $.clock.now()
    await update($, agents, list => touch(list, id, now, a => ({
      ...a, toolCalls: a.toolCalls + 1, lastTool: e.tool,
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
        ...a, status, durationMs: e.durationMs,
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
          const elapsed = a.durationMs ?? now - a.startedAt
          const isResting = a.status !== 'running'
          return (
            <Box flexDirection="column">
              <Text>
                <Text color={isResting ? undefined : 'claude'} dimColor={isResting}>{mascotOf(a)}</Text>
                <Text color={colorOf(a.type)} bold>{propOf(a.type)} {a.type}</Text>
                <Text dimColor> {truncate(a.description, Math.max(0, textColumns - a.type.length - 3))}</Text>
              </Text>
              <Text dimColor>
                {' '.repeat(MASCOT_COLUMNS)}
                {STATE_LABEL[a.status]} {formatDuration(elapsed)} · {a.toolCalls} tools
                {a.lastTool && !isResting ? ` (${a.lastTool})` : ''} · ctx {formatTokens(a.contextTokens)} · out {formatTokens(a.outputTokens)}
              </Text>
            </Box>
          )
        })}
      </Box>
    )
  })
}
