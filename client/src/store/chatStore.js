/**
 * chatStore — short-lived voice conversation history.
 *
 * The voice assistant feeds this back to the backend as `osState.sessionHistory`
 * so the LLM has memory across utterances within a single session.
 *
 * We deliberately keep only the last few exchanges (default 6) to stay under
 * the LLM's max token budget without sending the whole transcript.
 */

import { create } from 'zustand'

const MAX = 12

const useChatStore = create((set, get) => ({
  /**
   * messages: [{ role: 'user' | 'assistant', content: string, ts: number }]
   */
  messages: [],

  push: (role, content) =>
    set((s) => ({
      messages: [...s.messages, { role, content, ts: Date.now() }].slice(-MAX)
    })),

  clear: () => set({ messages: [] }),

  /** Return the last N messages in {role, content} shape for backend. */
  recent: (n = 6) => get().messages.slice(-n).map((m) => ({
    role: m.role,
    content: m.content
  }))
}))

export default useChatStore
