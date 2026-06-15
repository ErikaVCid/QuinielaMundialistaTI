'use client'
import { useEffect, useState } from 'react'

interface LiveMatch {
  id: string
  homeScore: number | null
  awayScore: number | null
  status: string
  homeTeam: { name: string; flag: string | null; code: string }
  awayTeam: { name: string; flag: string | null; code: string }
}

export function LiveScores() {
  const [liveMatches, setLiveMatches] = useState<LiveMatch[]>([])
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const es = new EventSource('/api/sse/scores')

    es.onopen = () => setConnected(true)

    es.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.type === 'init' || data.type === 'scores') {
        setLiveMatches(data.matches ?? [])
      }
    }

    es.onerror = () => {
      setConnected(false)
      es.close()
    }

    return () => es.close()
  }, [])

  if (liveMatches.length === 0) return null

  return (
    <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-red-500 rounded-full live-pulse" />
        <span className="text-sm font-semibold text-white">Partidos en Vivo</span>
        <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full border border-red-500/20">LIVE</span>
        {connected && <span className="ml-auto text-xs text-green-500">● conectado</span>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {liveMatches.map((m) => (
          <div key={m.id} className="flex items-center justify-between bg-black/20 rounded-lg px-4 py-2">
            <span className="text-sm text-white">{m.homeTeam.flag} {m.homeTeam.code}</span>
            <span className="text-xl font-bold text-white tabular-nums px-3">
              {m.homeScore ?? 0} – {m.awayScore ?? 0}
            </span>
            <span className="text-sm text-white">{m.awayTeam.code} {m.awayTeam.flag}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
