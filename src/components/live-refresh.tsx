'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Goal {
  matchId: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
}

interface GoalToast {
  id: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
}

export function LiveRefresh() {
  const router = useRouter()
  const [toasts, setToasts] = useState<GoalToast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    const es = new EventSource('/api/sse/scores')

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as {
          type: string
          goals?: Goal[]
          timestamp?: string
        }

        if (data.type === 'goal' && data.goals?.length) {
          // Refresh all server components instantly
          router.refresh()

          // Show goal notification for each goal
          data.goals.forEach(goal => {
            const toastId = `${goal.matchId}-${goal.homeScore}-${goal.awayScore}`
            setToasts(prev => {
              if (prev.some(t => t.id === toastId)) return prev
              return [...prev, { id: toastId, ...goal }]
            })
            setTimeout(() => removeToast(toastId), 6000)
          })
        }
      } catch { /* ignore parse errors */ }
    }

    es.onerror = () => {
      // SSE error — reconnects automatically
    }

    return () => es.close()
  }, [router, removeToast])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className="flex items-center gap-3 bg-[#111118] border border-green-500/40 rounded-2xl px-4 py-3 shadow-2xl shadow-green-500/10 animate-in slide-in-from-bottom-4 duration-300"
        >
          <span className="text-2xl">⚽</span>
          <div>
            <p className="text-green-400 font-bold text-sm">¡Gol!</p>
            <p className="text-white text-xs font-semibold">
              {toast.homeTeam} <span className="text-green-400 font-black">{toast.homeScore}–{toast.awayScore}</span> {toast.awayTeam}
            </p>
          </div>
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse ml-1" />
        </div>
      ))}
    </div>
  )
}
