import type { EngineInterface, Register } from 'claude-code'

import {
  PRESETS, SECTIONS, buildSwitches, cellsOf, denyText, findSwitch, fitCells, isBlocked, readOff, toggle,
} from './switchboard'
import type { Preset, Switch } from './switchboard'

const PANE = 'dukkeobi'
const TITLE = '⚡ 도구 두꺼비집'
const STORE_OFF = 'off'
const CELL_MAX = 30
const CELL_MIN = 18

// Read from $.store at session.start; a reload starts the module, and this, over.
let off: readonly string[] = []

async function switchesOf($: EngineInterface): Promise<Switch[]> {
  return buildSwitches(await $.tool.list())
}

/** Writes the switches down for later sessions, then redraws the pane and the status line. */
async function save($: EngineInterface, next: readonly string[]): Promise<void> {
  off = next
  await $.store.set(STORE_OFF, [...next])
  showStatus($)
  $.ui.invalidate('ui.render')
}

function showStatus($: EngineInterface): void {
  void $.ui.status(off.length > 0 ? `⚡ 도구 ${off.length}개 내림` : undefined)
}

async function applyPreset($: EngineInterface, preset: Preset): Promise<string> {
  const picked = preset.pick(await switchesOf($))
  await save($, picked)
  return picked.length === 0
    ? `⚡ ${preset.label}: 모든 차단기를 올렸습니다.`
    : `⚡ ${preset.label}: ${picked.join(', ')} 차단기를 내렸습니다.`
}

async function flip($: EngineInterface, s: Switch): Promise<string> {
  const isGoingDown = !off.includes(s.key)
  await save($, toggle(off, s.key))
  return `⚡ ${s.label} 차단기를 ${isGoingDown ? '내렸습니다 (OFF)' : '올렸습니다 (ON)'}`
}

async function statusText($: EngineInterface): Promise<string> {
  const switches = await switchesOf($)
  const down = switches.filter(s => off.includes(s.key))
  return [
    `⚡ 도구 두꺼비집: 켜짐 ${switches.length - down.length} · 내림 ${down.length}`,
    down.length > 0 ? `내린 차단기: ${down.map(s => s.label).join(', ')}` : '내린 차단기 없음',
    `사용법: /dukkeobi (창 열기) | on <도구> | off <도구> | ${PRESETS.map(p => p.id).join(' | ')}`,
  ].join('\n')
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      off = readOff(await $.store.get(STORE_OFF))
      await $.command.register({
        name: 'dukkeobi',
        description: '도구 두꺼비집: 도구 ON/OFF 창 (on|off <도구>, all, readonly, offline, nomcp)',
      })
      showStatus($)
      if (off.length > 0) void $.ui.toast(`⚡ 도구 두꺼비집: ${off.join(', ')} 차단기가 내려가 있어요 (/dukkeobi)`)
    } catch (err: unknown) {
      // Logged, not thrown: the rest of the chain still runs below.
      $.ui.log(`dukkeobi: setup failed: ${String(err)}`)
    }

    return next(e)
  })

  // Every call, the main thread's and each subagent's, passes this breaker.
  on('tool.call', async ($, e, next) => {
    if (!isBlocked(off, e.tool)) return next(e)
    void $.ui.toast(`⚡ ${e.tool} 차단기가 내려가 있어 호출을 막았습니다`)
    return { deny: denyText(e.tool) }
  })

  on('command.run', { command: 'dukkeobi' }, async ($, e) => {
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    const target = rest.join(' ')
    const preset = PRESETS.find(p => p.id === verb)
    if (preset) return { text: await applyPreset($, preset) }
    if (verb === 'status') return { text: await statusText($) }

    if (verb === 'on' || verb === 'off') {
      const s = findSwitch(await switchesOf($), target)
      if (!s) return { text: `⚡ "${target}" 도구를 찾지 못했습니다. /dukkeobi status 로 이름을 확인하세요.` }
      if (off.includes(s.key) === (verb === 'off')) return { text: `⚡ ${s.label}는 이미 ${verb.toUpperCase()}입니다.` }
      return { text: await flip($, s) }
    }

    await $.ui.open({ id: PANE, title: TITLE, focus: true })
    return { text: '⚡ 도구 두꺼비집을 열었습니다. Tab으로 고르고 Enter로 켜고 끕니다. 숫자 1-4는 프리셋입니다.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const switches = await switchesOf($)
    const columns = Math.max(CELL_MIN, e.props.bodyColumns)
    const perRow = Math.max(1, Math.floor(columns / CELL_MAX))
    const cell = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor(columns / perRow)))
    const down = switches.filter(s => off.includes(s.key)).length
    const run = (work: () => Promise<string>) => () => {
      work()
        .then(text => $.ui.toast(text))
        .catch((err: unknown) => $.ui.log(`dukkeobi: switch failed: ${String(err)}`))
    }

    return (
      <Box flexDirection="column">
        <Text>
          <Text color="warning" bold>⚡ 두꺼비집 </Text>
          <Text color="success">● 켜짐 {switches.length - down}</Text>
          <Text dimColor>  ·  </Text>
          <Text color={down > 0 ? 'error' : undefined} dimColor={down === 0}>○ 내림 {down}</Text>
        </Text>
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          {PRESETS.map(p => (
            <Button key={`preset:${p.id}`} hotkey={p.hotkey} plain onPress={run(() => applyPreset($, p))}>
              {p.label}
            </Button>
          ))}
        </Box>
        <Text dimColor>{'─'.repeat(columns)}</Text>
        {SECTIONS.map(section => {
          const inSection = switches.filter(s => s.section === section)
          if (inSection.length === 0) return null
          return (
            <Box key={`section:${section}`} flexDirection="column">
              <Text bold color="claude">{section}</Text>
              <Box flexDirection="row" flexWrap="wrap">
                {inSection.map(s => {
                  const isOff = off.includes(s.key)
                  const room = cell - 3
                  const name = fitCells(s.label, Math.max(4, room - (s.hint ? 8 : 0))).trimEnd()
                  return (
                    <Box key={`cell:${s.key}`} width={cell}>
                      <Button key={`sw:${s.key}`} plain onPress={run(() => flip($, s))}>
                        <Text color={isOff ? 'error' : 'success'}>{isOff ? '○ ' : '● '}</Text>
                        <Text strikethrough={isOff} dimColor={isOff}>{name}</Text>
                        <Text dimColor> {fitCells(s.hint, Math.max(0, room - cellsOf(name) - 1)).trimEnd()}</Text>
                      </Button>
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )
        })}
        <Text dimColor>{'─'.repeat(columns)}</Text>
        <Text dimColor>
          {e.props.isFocused
            ? 'Tab 이동 · Enter 켜고 끄기 · 1-4 프리셋 · Esc 나가기'
            : 'ctrl+x tab 또는 클릭으로 창을 잡으면 켜고 끌 수 있어요'}
        </Text>
      </Box>
    )
  })
}
