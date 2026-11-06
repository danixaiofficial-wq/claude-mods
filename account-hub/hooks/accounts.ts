// Pure helpers of account-hub: reading the login record, labels, warnings.
import type { AccountSnapshot, ClaudeAccount, GitIdentity } from '../types'

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined

/** One trimmed line of a command's output, or undefined when it printed none. */
export const firstLine = (out: string | undefined): string | undefined =>
  text(out?.split('\n')[0])

const BILLING_LABELS: Record<string, string> = {
  stripe_subscription: 'Pro/Max 구독',
  apple_subscription: 'App Store 구독',
  google_play_subscription: 'Google Play 구독',
}

/**
 * Picks the account out of `.claude.json`'s text: name, email, organization,
 * role and billing, nothing else (never a token). Null when unreadable.
 */
export const parseClaudeAccount = (raw: string): ClaudeAccount | null => {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  const oauth = isRecord(data) ? data.oauthAccount : undefined
  if (!isRecord(oauth)) return null
  const email = text(oauth.emailAddress)
  const name = text(oauth.displayName)
  if (!email && !name) return null
  const billing = text(oauth.billingType)
  const organization = text(oauth.organizationName)
  return {
    name,
    email,
    // A personal org is named after the email: not worth a line of its own.
    organization: organization && !organization.startsWith(email ?? '\0') ? organization : undefined,
    role: text(oauth.organizationRole),
    billing: billing ? BILLING_LABELS[billing] ?? billing : undefined,
    isVerified: false,
  }
}

export const formatIdentity = (id: GitIdentity): string => {
  if (id.name && id.email) return `${id.name} <${id.email}>`
  return id.name ?? (id.email ? `<${id.email}>` : '설정 안 됨')
}

const isNoreplyFor = (email: string, login: string): boolean =>
  email.toLowerCase().endsWith(`${login.toLowerCase()}@users.noreply.github.com`)

export type Warning = { level: 'warn' | 'info'; text: string }

/** What is worth a second look in how the accounts line up. */
export const warningsOf = (s: AccountSnapshot): Warning[] => {
  const warnings: Warning[] = []
  if (!s.claude) warnings.push({ level: 'warn', text: 'Claude 로그인 정보를 찾지 못했어요' })
  if (!s.github) warnings.push({ level: 'info', text: 'gh CLI에 GitHub 로그인이 없어요 (gh auth login)' })
  if (!s.gitGlobal.email) warnings.push({ level: 'warn', text: 'git 전역 user.email이 비어 있어요' })
  const effective = s.repo?.identity.email ?? s.gitGlobal.email
  const login = s.github?.login
  if (effective && login && !isNoreplyFor(effective, login) && !s.repo?.identity.email) {
    warnings.push({ level: 'info', text: '이 폴더의 commit은 전역 이메일로 남아요' })
  }
  return warnings
}

export const formatClock = (ms: number): string => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const truncate = (value: string, width: number): string => {
  if (width <= 0) return ''
  const chars = Array.from(value)
  return chars.length <= width ? value : `${chars.slice(0, width - 1).join('')}…`
}
