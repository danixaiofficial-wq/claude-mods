import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AccountSnapshot, ClaudeAccount, GitIdentity } from '../types'
import {
  firstLine, formatClock, formatIdentity, parseClaudeAccount, truncate, warningsOf,
} from './accounts'

const PANE = 'account-hub'
const TITLE = '◉ Accounts'
const RUN_TIMEOUT_MS = 5000
// Card borders and padding take this many columns from the pane's width.
const CARD_CHROME = 4

const snapshot = atom({ plugin: 'account-hub', key: 'snapshot' } as const, null, {
  shape: 'snapshot-1',
})

/** Runs a command and answers its first line of output, or undefined. */
async function runLine($: EngineInterface, argv: string[], cwd?: string): Promise<string | undefined> {
  try {
    const run = await $.process.run(argv, { cwd, timeoutMs: RUN_TIMEOUT_MS })
    return run.exitCode === 0 ? firstLine(run.stdout) : undefined
  } catch {
    return undefined // the tool is missing or timed out: show it as not connected
  }
}

/** The engine's answer where it gives one, else the login record on disk. */
async function loadClaude($: EngineInterface): Promise<ClaudeAccount | null> {
  const identity = await $.session.identity()
  if (identity.email) return { email: identity.email, isVerified: identity.isVerified }
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR')) ?? (await $.env.get('HOME'))
  if (!dir) return null
  try {
    return parseClaudeAccount(await $.fs.read(`${dir}/.claude.json`))
  } catch {
    return null
  }
}

async function loadRepo($: EngineInterface): Promise<AccountSnapshot['repo']> {
  const cwd = await $.session.cwd()
  const root = await runLine($, ['git', 'rev-parse', '--show-toplevel'], cwd)
  if (!root) return null
  const [name, email] = await Promise.all([
    runLine($, ['git', 'config', '--local', 'user.name'], root),
    runLine($, ['git', 'config', '--local', 'user.email'], root),
  ])
  return { root, identity: { name, email } }
}

async function refresh($: EngineInterface): Promise<void> {
  try {
    const [claude, login, gitName, gitEmail, repo, now] = await Promise.all([
      loadClaude($),
      runLine($, ['gh', 'config', 'get', '-h', 'github.com', 'user']),
      runLine($, ['git', 'config', '--global', 'user.name']),
      runLine($, ['git', 'config', '--global', 'user.email']),
      loadRepo($),
      $.clock.now(),
    ])
    const gitGlobal: GitIdentity = { name: gitName, email: gitEmail }
    const next: AccountSnapshot = {
      claude, github: login ? { login } : null, gitGlobal, repo, checkedAt: now,
    }
    await update($, snapshot, () => next)
  } catch (err: unknown) {
    $.ui.log(`account-hub: could not check the accounts: ${String(err)}`, { to: 'debug' })
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'account-hub',
        description: '연결된 Claude, GitHub, git 계정을 카드로 보여 줍니다 (다시 실행하면 새로고침)',
      })
      void refresh($)
      void $.ui.open({ id: PANE, title: TITLE })
        .then(opened => {
          if (!opened.isPlaced) void $.ui.toast('◉ 연결된 계정은 /account-hub 로 볼 수 있어요')
        })
        .catch((err: unknown) => $.ui.log(`account-hub: could not open the pane: ${String(err)}`, { to: 'debug' }))
    } catch (err: unknown) {
      // Logged, not thrown: the rest of the chain still runs below.
      $.ui.log(`account-hub: /account-hub is unavailable: ${String(err)}`)
    }

    return next(e)
  })

  on('command.run', { command: 'account-hub' }, async $ => {
    await refresh($)
    await $.ui.open({ id: PANE, title: TITLE })

    return { text: '계정 정보를 새로 확인했습니다.' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const s: AccountSnapshot | null = await read($, snapshot)
    const columns = Math.max(24, e.props.bodyColumns ?? 40)
    const inner = columns - CARD_CHROME
    const fit = (value: string): string => truncate(value, inner)

    if (!s) {
      return (
        <Box flexDirection="column">
          <Text color="claude">(✻ᴗ✻)?</Text>
          <Text dimColor>계정을 확인하는 중이에요…</Text>
        </Box>
      )
    }

    const claude = s.claude
    const claudeMeta = [claude?.role, claude?.billing].filter(Boolean).join(' · ')

    return (
      <Box flexDirection="column" gap={0}>
        <Text>
          <Text bold>Connected accounts</Text>
          <Text dimColor>  checked {formatClock(s.checkedAt)}</Text>
        </Text>

        <Box flexDirection="column" borderStyle="round" borderColor="claude" paddingX={1}>
          <Text>
            <Text color="claude" bold>✻ Claude</Text>
            <Text color={claude ? 'success' : 'error'}>  {claude ? '● signed in' : '○ none'}</Text>
          </Text>
          {claude?.name && <Text bold>{fit(claude.name)}</Text>}
          {claude?.email && <Text>{fit(claude.email)}{claude.isVerified ? ' ✓' : ''}</Text>}
          {claude?.organization && <Text dimColor>{fit(claude.organization)}</Text>}
          {claudeMeta !== '' && <Text dimColor>{fit(claudeMeta)}</Text>}
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="suggestion" paddingX={1}>
          <Text>
            <Text color="suggestion" bold>◆ GitHub</Text>
            <Text color={s.github ? 'success' : 'error'}>  {s.github ? '● gh signed in' : '○ none'}</Text>
          </Text>
          {s.github
            ? (
              <Box flexDirection="column">
                <Text bold>@{fit(s.github.login)}</Text>
                <Text dimColor>{fit(`github.com/${s.github.login}`)}</Text>
              </Box>
            )
            : <Text dimColor>gh auth login 으로 연결하세요</Text>}
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="warning" paddingX={1}>
          <Text color="warning" bold>◇ git commit 작성자</Text>
          <Text>
            <Text dimColor>global  </Text>
            <Text>{fit(formatIdentity(s.gitGlobal))}</Text>
          </Text>
          {s.repo
            ? (
              <Text>
                <Text dimColor>repo    </Text>
                <Text>{fit(s.repo.identity.email ? formatIdentity(s.repo.identity) : '(global 따름)')}</Text>
              </Text>
            )
            : <Text dimColor>지금 폴더는 git repo가 아니에요</Text>}
          {s.repo && <Text dimColor>{fit(s.repo.root)}</Text>}
        </Box>

        {warningsOf(s).map(w => (
          <Text color={w.level === 'warn' ? 'warning' : undefined} dimColor={w.level === 'info'}>
            {w.level === 'warn' ? '⚠' : '·'} {fit(w.text)}
          </Text>
        ))}
      </Box>
    )
  })
}
