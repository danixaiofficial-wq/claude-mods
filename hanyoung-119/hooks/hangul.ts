// 두벌식: Korean typed with the keyboard left in English mode, turned back into Hangul.

/** The 두벌식 layout: one key, one jamo. Shift gives the five tense consonants and two vowels. */
const KEYS: Readonly<Record<string, string>> = {
  q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ',
  a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
  z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ',
  Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ',
}

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ',
  'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'] as const

const VOWEL_PAIRS: Readonly<Record<string, string>> = {
  'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ',
}
const FINAL_PAIRS: Readonly<Record<string, string>> = {
  'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ',
  'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ',
}

const isVowel = (j: string | undefined): j is string => j !== undefined && JUNG.includes(j)
const isConsonant = (j: string | undefined): j is string => j !== undefined && CHO.includes(j)
const canEnd = (j: string): boolean => (JONG as readonly string[]).includes(j)

const syllable = (cho: string, jung: string, jong: string): string =>
  String.fromCharCode(0xac00 + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + JONG.indexOf(jong as typeof JONG[number]))

export type Composed = { text: string; isComplete: boolean; syllables: number }

/** Jamo keys of one word, or null when a letter is not on the layout. */
export const toJamo = (letters: string): string[] | null => {
  const jamo = Array.from(letters, ch => KEYS[ch] ?? KEYS[ch.toLowerCase()])
  return jamo.every((j): j is string => j !== undefined) ? jamo : null
}

/**
 * Composes jamo into syllables the way a 두벌식 IME does: a consonant before
 * a vowel opens the next syllable, otherwise it closes the current one.
 * `isComplete` is false when any jamo was left standing alone.
 */
export const compose = (jamo: readonly string[]): Composed => {
  const out: string[] = []
  let isComplete = true
  let syllables = 0
  let i = 0
  while (i < jamo.length) {
    const cho = jamo[i]
    const first = jamo[i + 1]
    if (!isConsonant(cho) || !isVowel(first)) {
      out.push(cho ?? '')
      isComplete = false
      i += 1
      continue
    }
    i += 2
    const pairedVowel = VOWEL_PAIRS[first + (jamo[i] ?? '')]
    const jung = pairedVowel ?? first
    if (pairedVowel) i += 1
    let jong = ''
    const a = jamo[i]
    if (isConsonant(a) && canEnd(a) && !isVowel(jamo[i + 1])) {
      jong = a
      i += 1
      const pairedFinal = FINAL_PAIRS[jong + (jamo[i] ?? '')]
      if (pairedFinal && !isVowel(jamo[i + 1])) {
        jong = pairedFinal
        i += 1
      }
    }
    out.push(syllable(cho, jung, jong))
    syllables += 1
  }
  return { text: out.join(''), isComplete, syllables }
}

/**
 * English words that happen to compose into whole Hangul syllables. Without
 * this list `the` would become `솓` and `fix` would become `럍`.
 */
const ENGLISH = new Set([
  'the', 'fix', 'run', 'add', 'and', 'for', 'not', 'yes', 'git', 'npm', 'dev', 'log', 'set', 'get',
  'put', 'out', 'ok', 'hi', 'go', 'do', 'to', 'so', 'no', 'on', 'of', 'in', 'is', 'it', 'if', 'or',
  'as', 'at', 'by', 'up', 'me', 'my', 'we', 'he', 'be', 'an', 'us', 'pr', 'ci', 'ui', 'ux', 'db', 'id',
  'than', 'then', 'they', 'them', 'this', 'that', 'thus', 'test', 'text', 'help', 'here', 'have',
  'lint', 'link', 'list', 'live', 'life', 'line', 'like', 'just', 'json', 'html', 'yarn', 'pnpm',
  // Found by running ~400 common dev words through `rescue`: these still slipped through.
  'check', 'flash', 'clash', 'sorry', 'right', 'alright', 'show', 'flask', 'throw', 'span', 'form',
  'angry', 'charm', 'sharp',
])

const LETTERS = /^([a-zA-Z]+)([.,!?~…]*)$/
const HANGUL = /[가-힣]/
// Backtick code and URLs are never touched.
const PROTECTED = /(```[\s\S]*?```|`[^`\n]*`|\bhttps?:\/\/\S+)/

const MIN_MIXED_LETTERS = 4
const MIN_WHOLE_SHARE = 0.7
// Typed in English mode, Hangul vowels land on h j k l y u i o p b n m, so the
// English vowels a e i o u are rare; in English words they are not. Measured
// on a Korean sample and /usr/share/dict/words: at 0.3 a whole prompt keeps
// ~94% of Korean words and drops about half of the English ones that would
// otherwise compose; 0.34 per word next to Hangul keeps ~95%.
const MAX_VOWEL_SHARE_WHOLE = 0.3
const MAX_VOWEL_SHARE_WORD = 0.34

/** The share of a, e, i, o, u among the letters. */
export const englishVowelShare = (letters: string): number =>
  letters.length === 0 ? 0 : letters.replace(/[^aeiou]/gi, '').length / letters.length

type Word = { letters: string; tail: string; korean: string | null }

const readWord = (token: string): Word | null => {
  const m = LETTERS.exec(token)
  if (!m) return null
  const letters = m[1] ?? ''
  const tail = m[2] ?? ''
  const jamo = toJamo(letters)
  const composed = jamo ? compose(jamo) : null
  const isKorean = composed !== null && composed.isComplete && !ENGLISH.has(letters.toLowerCase())
  return { letters, tail, korean: isKorean ? composed.text : null }
}

export type Rescue = { text: string; changes: readonly { from: string; to: string }[] }

/**
 * Turns the words typed in English mode back into Hangul, or answers null
 * when the text does not look like it. A prompt with no Hangul at all is
 * rescued only when most of its letters convert cleanly and one word is
 * long enough to be sure; next to Hangul, only words of four letters or more.
 */
export const rescue = (text: string): Rescue | null => {
  if (text.trimStart().startsWith('/') || text.trimStart().startsWith('!')) return null
  const parts = text.split(PROTECTED)
  const plain = parts.filter((_, i) => i % 2 === 0).join(' ')
  const words = plain.split(/\s+/).map(readWord).filter((w): w is Word => w !== null)
  const hasHangul = HANGUL.test(plain)

  const minLetters = hasHangul ? MIN_MIXED_LETTERS : 2
  const shouldConvert = (w: Word): boolean =>
    w.korean !== null && w.letters.length >= minLetters
    && (!hasHangul || englishVowelShare(w.letters) <= MAX_VOWEL_SHARE_WORD)
  if (!hasHangul) {
    const total = words.reduce((n, w) => n + w.letters.length, 0)
    const picked = words.filter(shouldConvert)
    const converted = picked.reduce((n, w) => n + w.letters.length, 0)
    const hasLongWord = picked.some(w => w.letters.length >= MIN_MIXED_LETTERS)
    const vowelShare = englishVowelShare(picked.map(w => w.letters).join(''))
    if (total === 0 || converted / total < MIN_WHOLE_SHARE || !hasLongWord) return null
    if (vowelShare > MAX_VOWEL_SHARE_WHOLE) return null
  }

  const changes: { from: string; to: string }[] = []
  const fixPlain = (segment: string): string =>
    segment.split(/(\s+)/).map(token => {
      const w = readWord(token)
      if (!w || !shouldConvert(w) || w.korean === null) return token
      changes.push({ from: w.letters, to: w.korean })
      return w.korean + w.tail
    }).join('')
  const next = parts.map((part, i) => (i % 2 === 0 ? fixPlain(part) : part)).join('')
  return changes.length === 0 ? null : { text: next, changes }
}
