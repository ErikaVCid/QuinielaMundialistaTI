'use client'
import { useState, useTransition } from 'react'
import { Check, Loader2, Pencil, X } from 'lucide-react'

interface Props {
  matchId: string
  participantId: string
  existingHome?: number
  existingAway?: number
}

export function InlinePrediction({ matchId, participantId, existingHome, existingAway }: Props) {
  const hasPrediction = existingHome !== undefined && existingAway !== undefined
  const [editing, setEditing] = useState(!hasPrediction)
  const [home, setHome] = useState(existingHome ?? 1)
  const [away, setAway] = useState(existingAway ?? 1)
  const [saved, setSaved] = useState(hasPrediction)
  const [isPending, startTransition] = useTransition()

  function clamp(v: number) { return Math.max(0, Math.min(20, v)) }

  function save() {
    startTransition(async () => {
      const res = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, participantId, homeScore: home, awayScore: away }),
      })
      if (res.ok) {
        setSaved(true)
        setEditing(false)
      }
    })
  }

  // Saved and not editing → show score with edit button
  if (saved && !editing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white tabular-nums font-mono bg-green-500/15 border border-green-500/25 px-2.5 py-0.5 rounded-lg">
          {home}–{away}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-green-400 transition-all"
          title="Editar pronóstico"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    )
  }

  // Editing mode → +/- inputs
  return (
    <div className="flex items-center gap-1.5" onClick={e => e.preventDefault()}>
      {/* Home score */}
      <div className="flex items-center gap-0.5">
        <button onClick={() => setHome(clamp(home - 1))}
          className="w-5 h-5 rounded bg-[#2a2a3e] hover:bg-[#3a3a4e] text-white text-xs flex items-center justify-center transition-all font-bold">
          –
        </button>
        <span className="w-5 text-center text-sm font-bold text-white tabular-nums">{home}</span>
        <button onClick={() => setHome(clamp(home + 1))}
          className="w-5 h-5 rounded bg-[#2a2a3e] hover:bg-[#3a3a4e] text-white text-xs flex items-center justify-center transition-all font-bold">
          +
        </button>
      </div>

      <span className="text-gray-600 text-xs font-bold">–</span>

      {/* Away score */}
      <div className="flex items-center gap-0.5">
        <button onClick={() => setAway(clamp(away - 1))}
          className="w-5 h-5 rounded bg-[#2a2a3e] hover:bg-[#3a3a4e] text-white text-xs flex items-center justify-center transition-all font-bold">
          –
        </button>
        <span className="w-5 text-center text-sm font-bold text-white tabular-nums">{away}</span>
        <button onClick={() => setAway(clamp(away + 1))}
          className="w-5 h-5 rounded bg-[#2a2a3e] hover:bg-[#3a3a4e] text-white text-xs flex items-center justify-center transition-all font-bold">
          +
        </button>
      </div>

      {/* Save */}
      <button onClick={save} disabled={isPending}
        className="w-6 h-6 rounded-lg bg-green-600 hover:bg-green-500 text-white flex items-center justify-center transition-all disabled:opacity-50 ml-1">
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
      </button>

      {/* Cancel (only if had previous prediction) */}
      {hasPrediction && (
        <button onClick={() => { setHome(existingHome!); setAway(existingAway!); setEditing(false) }}
          className="w-6 h-6 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 flex items-center justify-center transition-all">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
