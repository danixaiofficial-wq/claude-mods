/** The Claude account: what the login record says, never its tokens. */
export type ClaudeAccount = {
  name?: string
  email?: string
  organization?: string
  role?: string
  billing?: string
  isVerified: boolean
}

export type GitIdentity = { name?: string; email?: string }

export type AccountSnapshot = {
  claude: ClaudeAccount | null
  github: { login: string } | null
  gitGlobal: GitIdentity
  /** The repository the session works in, when its folder is one. */
  repo: { root: string; identity: GitIdentity } | null
  checkedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'account-hub': { snapshot: Shaped<AccountSnapshot | null> }
  }
}
