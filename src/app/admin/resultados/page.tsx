'use client'
import { useState } from 'react'
import { Loader2, Save, RefreshCw } from 'lucide-react'

interface MatchData {
  id: string
  homeTeam: { name: string; flag: string | null; code: string }
  awayTeam: { name: string; flag: string | null; code: string }
  homeScore: number | null
  awayScore: number | null
  status: string
  kickoffAt: string
}

export default function ResultadosPage() {
  const [matches, setMatches] = useState<MatchData[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [message, setMessage] = useState('')

  async function loadMatches() {
    setLoading(true)
    const res = await fetch('/api/admin/matches')
    const data = await res.json()
    setMatches(data.matches ?? [])
    setLoading(false)
  }

  async function updateResult(matchId: string, homeScore: number, awayScore: number, status: string) {
    setSaving(matchId)
    const res = await fetch(`/api/admin/matches/${matchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ homeScore, awayScore, status }),
    })
    if (res.ok) {
      setMessage('Resultado actualizado y puntos calculados')
      await loadMatches()
    } else {
      setMessage('Error al actualizar')
    }
    setSaving(null)
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Cargar Resultados</h1>
          <p className="text-gray-400 text-sm">Actualiza marcadores y calcula puntos automáticamente</p>
        </div>
        <button onClick={loadMatches} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-all disabled:opacity-50">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Cargar partidos
        </button>
      </div>

      {message && (
        <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
          {message}
        </div>
      )}

      {matches.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-500">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>Haz clic en &quot;Cargar partidos&quot; para comenzar</p>
        </div>
      )}

      <div className="space-y-3">
        {matches.map((match) => (
          <MatchResultRow
            key={match.id}
            match={match}
            onSave={updateResult}
            isSaving={saving === match.id}
          />
        ))}
      </div>
    </div>
  )
}

function MatchResultRow({ match, onSave, isSaving }: {
  match: MatchData
  onSave: (id: string, home: number, away: number, status: string) => void
  isSaving: boolean
}) {
  const [homeScore, setHomeScore] = useState(match.homeScore ?? 0)
  const [awayScore, setAwayScore] = useState(match.awayScore ?? 0)
  const [status, setStatus] = useState(match.status)

  return (
    <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-lg">{match.homeTeam.flag}</span>
          <span className="text-sm font-medium text-white">{match.homeTeam.code}</span>
          <div className="flex items-center gap-1 mx-2">
            <input type="number" min={0} max={20} value={homeScore} onChange={e => setHomeScore(+e.target.value)}
              className="w-12 text-center bg-[#1a1a24] border border-[#2e2e3e] rounded-lg text-white py-1 text-sm font-bold" />
            <span className="text-gray-500">–</span>
            <input type="number" min={0} max={20} value={awayScore} onChange={e => setAwayScore(+e.target.value)}
              className="w-12 text-center bg-[#1a1a24] border border-[#2e2e3e] rounded-lg text-white py-1 text-sm font-bold" />
          </div>
          <span className="text-sm font-medium text-white">{match.awayTeam.code}</span>
          <span className="text-lg">{match.awayTeam.flag}</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="bg-[#1a1a24] border border-[#2e2e3e] rounded-lg text-white text-xs py-1.5 px-2">
            <option value="SCHEDULED">Programado</option>
            <option value="LIVE">En Vivo</option>
            <option value="FINISHED">Finalizado</option>
          </select>
          <button onClick={() => onSave(match.id, homeScore, awayScore, status)} disabled={isSaving}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-all disabled:opacity-50">
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
