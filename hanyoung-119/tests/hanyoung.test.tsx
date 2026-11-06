import { expect, test } from 'claude-code/testing'

import { compose, englishVowelShare, rescue, toJamo } from '../hooks/hangul'

const typed = (letters: string): string => {
  const jamo = toJamo(letters)
  return jamo ? compose(jamo).text : ''
}

test('두벌식 keys compose into syllables, compound vowels and finals included', () => {
  expect(typed('dkssudgktpdy')).toBe('안녕하세요')
  expect(typed('rhkwk')).toBe('과자') // ㅗ+ㅏ
  expect(typed('dlfrdj')).toBe('읽어') // ㄹ+ㄱ, then ㅇ opens the next syllable
  expect(typed('Tkdtj')).toBe('쌍서') // shift gives ㅆ
  expect(typed('qkfqdms')).toBe('밟은')
  expect(compose(toJamo('ehdk') ?? []).isComplete).toBe(true)
  expect(compose(toJamo('hello') ?? []).isComplete).toBe(false) // ㅗ cannot start a syllable
})

test('Korean typed in English mode is rescued', () => {
  expect(rescue('dkssudgktpdy')?.text).toBe('안녕하세요')
  expect(rescue('rmfjgrp gownj')?.text).toBe('그렇게 해줘')
  expect(rescue('ehdwkr gowntpdy?')?.text).toBe('동작 해주세요?')
  expect(rescue('이거 rmfjgrp 해줘')?.text).toBe('이거 그렇게 해줘')
  expect(rescue('zjavbxj tlfgod')?.changes).toEqual([
    { from: 'zjavbxj', to: '컴퓨터' }, { from: 'tlfgod', to: '실행' },
  ])
})

test('English, commands, code and URLs are left alone', () => {
  for (const text of [
    'git status', 'fix the bug', 'npm run build', 'please refactor this function',
    'make it faster', 'add tests for login', 'check', 'always', 'show', 'sorry',
    '/compact', '!ls -la', 'see `dkssud` here', 'https://dkssud.com',
    '```\ndkssudgktpdy\n```',
  ]) {
    expect(rescue(text)).toBeNull()
  }
})

test('next to Hangul, short Latin words stay as they are', () => {
  expect(rescue('이 함수 fix 해줘')).toBeNull()
  expect(rescue('git push 해줘')).toBeNull()
})

test('the English-vowel share tells typing apart from words', () => {
  expect(englishVowelShare('dkssud')).toBe(1 / 6)
  expect(englishVowelShare('always')).toBe(2 / 6)
})

test('a rescued prompt reaches the model in Hangul, with the original as context', async ($, on) => {
  const kept = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('command.register', () => ({ value: { command: 'hanyoung' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('prompt.submit', (_, e) => ({ text: e.text, context: e.context }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const sent = await $.prompt.submit({ text: 'rmfjgrp gownj', wait: false, origin: { kind: 'composer' } })

  expect(sent.text).toBe('그렇게 해줘')
  expect(sent.context?.[0]).toContain('원문: "rmfjgrp gownj"')
  expect(kept.get('rescued')).toBe(1)
})

test('/hanyoung off stops the rescue until /hanyoung on', async ($, on) => {
  const kept = new Map<string, unknown>()
  on('store.get', (_, e) => ({ value: kept.get(e.key) }))
  on('store.set', (_, e) => (kept.set(e.key, e.value), { value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => ({ text: e.text }))
  const run = (args: string) => $.command.run({
    command: 'hanyoung', args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 },
  })

  expect((await run('off')).text).toContain('휴무')
  expect((await $.prompt.submit({ text: 'dkssud', wait: false, origin: { kind: 'composer' } })).text).toBe('dkssud')
  expect((await run('on')).text).toContain('출동 대기')
  expect((await $.prompt.submit({ text: 'dkssud', wait: false, origin: { kind: 'composer' } })).text).toBe('안녕')
  expect((await run('dkssudgktpdy')).text).toContain('미리보기: 안녕하세요')
  expect(kept.get('enabled')).toBe(true)
})
