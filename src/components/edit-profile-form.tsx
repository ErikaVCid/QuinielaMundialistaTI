'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Loader2, Pencil } from 'lucide-react'

export function EditProfileForm({ currentDisplayName }: { participantId: string; currentDisplayName: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(currentDisplayName)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    if (!displayName.trim()) return
    startTransition(async () => {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      })
      if (res.ok) {
        setSaved(true)
        setEditing(false)
        router.refresh()
        setTimeout(() => setSaved(false), 3000)
      }
    })
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <div className="text-white font-medium">{currentDisplayName}</div>
          {saved && <div className="text-xs text-green-400 mt-0.5">✓ Guardado</div>}
        </div>
        <button onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-green-500/5">
          <Pencil className="w-3 h-3" /> Editar
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={displayName}
        onChange={e => setDisplayName(e.target.value)}
        maxLength={30}
        className="flex-1 px-3 py-2 rounded-lg bg-[#1a1a24] border border-green-500/30 text-white text-sm focus:outline-none focus:ring-1 focus:ring-green-500/30"
        autoFocus
      />
      <button onClick={handleSave} disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-medium transition-all disabled:opacity-50">
        {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
        Guardar
      </button>
      <button onClick={() => setEditing(false)} className="text-gray-500 hover:text-gray-300 text-xs px-2">Cancelar</button>
    </div>
  )
}
