'use client'
import { useTransition } from 'react'
import { Lock, ShieldOff, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Props {
  userId: string
  currentRole: string
  isProtectedAdmin: boolean  // true if this user is the protected admin
}

export function UserActions({ userId, currentRole, isProtectedAdmin }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Protected admin: show lock icon, no action
  if (isProtectedAdmin) {
    return (
      <span title="Administrador principal — no se puede modificar"
        className="p-1.5 rounded-lg text-amber-500/60 cursor-default flex items-center justify-center">
        <Lock className="w-3.5 h-3.5" />
      </span>
    )
  }

  // Regular users: only allow demoting admins, never promoting to ADMIN
  if (currentRole !== 'ADMIN') {
    return null  // can't promote regular users to ADMIN
  }

  async function demote() {
    startTransition(async () => {
      await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'USER' }),
      })
      router.refresh()
    })
  }

  return (
    <button onClick={demote} disabled={isPending}
      title="Quitar rol admin"
      className="p-1.5 rounded-lg hover:bg-white/10 transition-all disabled:opacity-50 text-gray-400 hover:text-red-400">
      {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
    </button>
  )
}
