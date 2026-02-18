import { useState, useRef, useEffect } from 'react'
import { C1Component } from '@thesysai/genui-sdk'
import { DataCharts } from './DataCharts'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface AskResponse {
  success: boolean
  generated_sql?: string
  data?: Record<string, unknown>[]
  results?: Record<string, unknown>[]
  row_count?: number
  c1_response?: string
  error?: string
  detail?: string
}

type MessageRole = 'user' | 'assistant'

interface Message {
  id: string
  role: MessageRole
  content: string
  response?: AskResponse
}

function App() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  async function sendMessage() {
    const text = input.trim()
    if (!text) return

    setInput('')
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text }),
      })
      const data: AskResponse = await res.json()

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.success
          ? `Found ${data.row_count ?? (data.data ?? data.results ?? []).length} result(s).`
          : (data.error || 'Something went wrong'),
        response: data,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: err instanceof Error ? err.message : 'Request failed',
          response: { success: false, error: 'Request failed' },
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">
          Matrimonial NL2SQL
        </h1>
        <p className="text-sm text-slate-500">
          Ask in plain English — we generate SQL and show results.
        </p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-6">
          {messages.length === 0 && !loading && (
            <div className="rounded-2xl bg-slate-100/80 px-6 py-8 text-center text-slate-500">
              <p className="font-medium text-slate-600">No messages yet</p>
              <p className="mt-1 text-sm">
                Try: &quot;List doctors in Mumbai&quot; or &quot;How many male profiles?&quot;
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-800 shadow-md border border-slate-200'
                }`}
              >
                {msg.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                ) : (
                  <MessageContent msg={msg} />
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl bg-white px-4 py-3 shadow-md border border-slate-200">
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.3s]" />
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-bounce [animation-delay:-0.15s]" />
                  <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-bounce" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-slate-200 bg-white p-4">
        <div className="mx-auto max-w-3xl flex gap-3 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            placeholder="Ask a question…"
            rows={1}
            className="min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20"
            disabled={loading}
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageContent({ msg }: { msg: Message }) {
  const res = msg.response
  if (!res) return <p className="text-sm">{msg.content}</p>

  if (!res.success) {
    return (
      <div className="text-sm">
        <p className="text-red-600 font-medium">{res.error}</p>
        {res.detail && <p className="mt-1 text-slate-600">{res.detail}</p>}
      </div>
    )
  }

  const rows = res.data ?? res.results ?? []
  const columns =
    rows.length > 0
      ? Array.from(
          new Set(rows.flatMap((row) => Object.keys(row as Record<string, unknown>)))
        )
      : []

  return (
    <div className="space-y-4 text-left min-w-0">
      <p className="text-sm text-slate-600">{msg.content}</p>

      {res.c1_response && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden">
          <C1Component c1Response={res.c1_response} isStreaming={false} />
        </div>
      )}

      {res.generated_sql && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Generated SQL
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-200 font-mono whitespace-pre-wrap break-words">
            <code>{res.generated_sql}</code>
          </pre>
        </details>
      )}

      {rows.length > 0 && (
        <>
          <DataCharts rows={rows} columns={columns} />
          <div className="overflow-x-auto rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Results</span>
            <span className="text-xs text-slate-500">
              {res.row_count ?? rows.length} row{(res.row_count ?? rows.length) !== 1 ? 's' : ''}
            </span>
          </div>
          <table className="w-full min-w-[400px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                >
                  {columns.map((col) => (
                    <td key={col} className="px-3 py-2 text-slate-800">
                      {String((row as Record<string, unknown>)[col] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      {rows.length === 0 && res.success && (
        <p className="text-sm text-slate-500">No rows returned.</p>
      )}
    </div>
  )
}

export default App
