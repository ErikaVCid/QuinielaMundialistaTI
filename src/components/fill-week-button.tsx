'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, Loader2 } from 'lucide-react'

export function FillWeekButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState('')

  async function handleClick() {
    setMsg('')
    startTransition(async () => {
      const res = await fetch('/api/predictions/week', { method: 'POST' })
      const data = await res.json() as { created: number; message: string }
      setMsg(data.message)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleClick}
        disabled={isPending}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-all disabled:opacity-50 shadow-lg shadow-green-500/20"
      >
        {isPending
          ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</>
          : <><Sparkles className="w-4 h-4" />Rellenar semana con IA</>
        }
      </button>
      {msg && <span className="text-xs text-green-400">{msg}</span>}
    </div>
  )
}
