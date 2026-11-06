import type { EngineInterface, Register } from 'claude-code'

import { rescue } from './hangul'
import type { Rescue } from './hangul'

const STORE_ENABLED = 'enabled'
const STORE_RESCUED = 'rescued'
const PREVIEW_CHANGES = 3

// Read from $.store at session.start; a reload starts the module, and this, over.
let isEnabled = true

const countOf = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

const describe = (r: Rescue): string => {
  const shown = r.changes.slice(0, PREVIEW_CHANGES).map(c => `${c.from} → ${c.to}`).join(', ')
  const more = r.changes.length - PREVIEW_CHANGES
  return more > 0 ? `${shown} 외 ${more}건` : shown
}

/** Tells the model what was typed, so a word converted by mistake can be read back. */
const noteFor = (original: string): string =>
  `[hanyoung-119] 사용자가 영문 자판 상태로 친 한글을 변환해서 전달했습니다. 변환이 어색하면 원문을 참고하세요. 원문: ${JSON.stringify(original)}`

async function bumpRescued($: EngineInterface): Promise<number> {
  const total = countOf(await $.store.get(STORE_RESCUED)) + 1
  await $.store.set(STORE_RESCUED, total)
  return total
}

async function statusText($: EngineInterface): Promise<string> {
  const total = countOf(await $.store.get(STORE_RESCUED))
  return `⛑ 한영키 구조대: ${isEnabled ? '출동 대기 중 (on)' : '휴무 중 (off)'} · 누적 구조 ${total}건\n`
    + '사용법: /hanyoung on | off | <영문으로 친 글> (미리보기)'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      const stored = await $.store.get(STORE_ENABLED)
      isEnabled = stored !== false
      await $.command.register({
        name: 'hanyoung',
        description: '한영키 구조대: on | off | 미리보기할 글',
      })
    } catch (err: unknown) {
      // Logged, not thrown: the rest of the chain still runs below.
      $.ui.log(`hanyoung-119: setup failed: ${String(err)}`)
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // A slash command's text is not rewritten, and a prompt the person did not type is left alone.
    if (!isEnabled || e.command || e.isMeta) return next(e)
    const fixed = rescue(e.text)
    if (!fixed) return next(e)

    try {
      const total = await bumpRescued($)
      void $.ui.toast(`⛑ 한영키 구조대 출동! ${describe(fixed)} (누적 ${total}건)`)
    } catch (err: unknown) {
      $.ui.log(`hanyoung-119: could not count the rescue: ${String(err)}`, { to: 'debug' })
    }

    return next({ ...e, text: fixed.text, context: [...(e.context ?? []), noteFor(e.text)] })
  })

  on('command.run', { command: 'hanyoung' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'on' || arg === 'off') {
      isEnabled = arg === 'on'
      await $.store.set(STORE_ENABLED, isEnabled)
      return { text: isEnabled ? '⛑ 한영키 구조대가 다시 출동 대기합니다.' : '⛑ 한영키 구조대가 휴무에 들어갑니다. /hanyoung on 으로 깨우세요.' }
    }
    if (arg === '' || arg === 'status') return { text: await statusText($) }

    const preview = rescue(arg)
    return {
      text: preview
        ? `미리보기: ${preview.text}\n(${describe(preview)})`
        : `미리보기: 바꿀 것이 없습니다. 한글을 영문 자판으로 친 글로 보이지 않아요.`,
    }
  })
}
