'use client'
import { useTransition } from 'react'
import { Shield, ShieldOff, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  currentRole: string
  currentUserEmail: string
}

export function UserActions({ userId, currentRole }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  async function toggleRole() {
    startTransition(async () => {
      await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: currentRole === 'ADMIN' ? 'USER' : 'ADMIN' }),
      })
      router.refresh()
    })
  }

  return (
    <button
      onClick={toggleRole}
      disabled={isPending}
      title={currentRole === 'ADMIN' ? 'Quitar admin' : 'Hacer admin'}
      className="p-1.5 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50 text-gray-400 hover:text-amber-400"
    >
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
        currentRole === 'ADMIN' ? <ShieldOff className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
    </button>
  )
}
