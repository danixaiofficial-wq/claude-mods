export type AgentState = 'running' | 'completed' | 'failed' | 'killed'

export type AgentRecord = {
  id: string
  type: string
  description: string
  model?: string
  parentId?: string
  status: AgentState
  startedAt: number
  durationMs?: number
  toolCalls: number
  lastTool?: string
  contextTokens: number
  outputTokens: number
}

declare module 'claude-code' {
  interface PluginState {
    'agent-lounge': { agents: Shaped<AgentRecord[]> }
  }
}
