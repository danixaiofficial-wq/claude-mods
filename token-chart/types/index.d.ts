export type StepUsage = {
  turnId: string
  index: number
  model: string
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export type ContextFill = { tokens?: number; window: number; percent?: number }

/** Counted over the whole session, past the rows kept. */
export type Totals = { requests: number; output: number }

declare module 'claude-code' {
  interface PluginState {
    'token-chart': {
      steps: Shaped<StepUsage[]>
      context: Shaped<ContextFill | null>
      totals: Shaped<Totals>
      cost: Shaped<number | null>
    }
  }
}
