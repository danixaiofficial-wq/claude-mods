import { expect, test } from 'claude-code/testing'

import { formatIdentity, parseClaudeAccount, warningsOf } from '../hooks/accounts'

const PANE = {
  plugin: 'account-hub',
  component: 'Pane',
  requestId: 'account-hub',
  props: {
    title: '◉ Accounts',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const LOGIN_RECORD = JSON.stringify({
  oauthAccount: {
    emailAddress: 'kim@example.com',
    displayName: 'Kim',
    organizationName: "kim@example.com's Organization",
    organizationRole: 'admin',
    billingType: 'stripe_subscription',
    accessToken: 'must-never-be-kept',
  },
  projects: { '/x': {} },
})

test('the login record gives name, email, role and billing, never a token', () => {
  const account = parseClaudeAccount(LOGIN_RECORD)

  expect(account).toEqual({
    name: 'Kim', email: 'kim@example.com', organization: undefined,
    role: 'admin', billing: 'Pro/Max 구독', isVerified: false,
  })
  expect(JSON.stringify(account)).not.toContain('must-never-be-kept')
  expect(parseClaudeAccount('not json')).toBeNull()
  expect(parseClaudeAccount('{}')).toBeNull()
})

test('git identities and warnings read plainly', () => {
  expect(formatIdentity({ name: 'kim', email: 'k@x.io' })).toBe('kim <k@x.io>')
  expect(formatIdentity({})).toBe('설정 안 됨')

  const base = {
    claude: null, github: { login: 'kimdev' }, checkedAt: 0,
    gitGlobal: { name: 'kim', email: 'kim@company.example' }, repo: { root: '/r', identity: {} },
  }
  expect(warningsOf(base).map(w => w.text)).toEqual([
    'Claude 로그인 정보를 찾지 못했어요',
    '이 폴더의 commit은 전역 이메일로 남아요',
  ])
  const local = { ...base, repo: { root: '/r', identity: { email: '1+kimdev@users.noreply.github.com' } } }
  expect(warningsOf(local).map(w => w.text)).toEqual(['Claude 로그인 정보를 찾지 못했어요'])
})

test('/account-hub checks every account and draws a card for each', async ($, on) => {
  on('command.register', () => ({ value: { command: 'account-hub' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.identity', () => ({ value: { deny: 'not a managed mod' } }))
  on('session.cwd', () => ({ value: '/work/app' }))
  on('clock.now', () => ({ value: new Date(2026, 10, 5, 9, 7).getTime() }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/kim' : undefined }))
  on('fs.read', () => ({ value: LOGIN_RECORD }))
  on('process.run', (_, e) => {
    const line = e.argv.join(' ')
    const out = line.startsWith('gh ') ? 'kimdev'
      : line.endsWith('--show-toplevel') ? '/work/app'
        : line === 'git config --global user.name' ? 'kim'
          : line === 'git config --global user.email' ? 'kim@company.example'
            : ''
    return { value: { exitCode: out ? 0 : 1, stdout: `${out}\n`, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  await $.command.run({
    command: 'account-hub', args: '',
    origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 120 },
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /checked 09:07/ })).toBeTruthy()
  expect((await ui.find({ type: 'Text', text: /kim@example.com/ }))?.text).toBe('kim@example.com')
  expect(await ui.find({ type: 'Text', text: /@kimdev/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /global  kim <kim@company.example>/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /repo    \(global 따름\)/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /전역 이메일로 남아요/ })).toBeTruthy()
  await ui.unmount()
})
