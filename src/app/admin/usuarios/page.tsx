import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Shield, User, Lock } from 'lucide-react'
import { UserActions } from './user-actions'
import { CreateUserButton } from '@/components/create-user-form'

const PROTECTED_ADMIN = process.env.PROTECTED_ADMIN_EMAIL ?? ''

export default async function AdminUsuariosPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/')

  const users = await prisma.user.findMany({
    include: { participant: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-5xl">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Gestión de Usuarios</h1>
          <p className="text-gray-400 text-sm">{users.length} usuarios registrados</p>
        </div>
        <CreateUserButton />
      </div>

      {/* Protected admin notice */}
      <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-5 text-sm text-amber-400">
        <Lock className="w-4 h-4 flex-shrink-0" />
        <span>
          El administrador principal es <strong>{PROTECTED_ADMIN}</strong>.
          Su rol está bloqueado y no puede ser modificado.
        </span>
      </div>

      <div className="bg-[#111118] rounded-xl border border-[#1e1e2e] overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-[#1e1e2e]">
          <div className="col-span-3">Nombre</div>
          <div className="col-span-4">Email</div>
          <div className="col-span-2">Participante</div>
          <div className="col-span-1">Rol</div>
          <div className="col-span-1">Puntos</div>
          <div className="col-span-1 text-center">Acción</div>
        </div>
        {users.map((user) => {
          const isProtected = user.email === PROTECTED_ADMIN
          return (
            <div key={user.id}
              className={`grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-[#1e1e2e] last:border-0 transition-colors ${isProtected ? 'bg-amber-500/5' : 'hover:bg-white/[0.02]'}`}>
              {/* Name */}
              <div className="col-span-3 flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-[#2e2e3e] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                  {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
                </div>
                <span className="text-white truncate">{user.name ?? '—'}</span>
              </div>
              {/* Email */}
              <div className="col-span-4 text-gray-400 truncate flex items-center">{user.email}</div>
              {/* Display name */}
              <div className="col-span-2 text-gray-300 flex items-center">{user.participant?.displayName ?? '—'}</div>
              {/* Role */}
              <div className="col-span-1 flex items-center">
                {isProtected ? (
                  <span className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                    <Lock className="w-3 h-3" /> Admin
                  </span>
                ) : user.role === 'ADMIN' ? (
                  <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                    <Shield className="w-3 h-3" /> Admin
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-gray-500 text-xs">
                    <User className="w-3 h-3" /> User
                  </span>
                )}
              </div>
              {/* Points */}
              <div className="col-span-1 text-green-400 font-bold flex items-center">
                {user.participant?.totalPoints ?? 0}
              </div>
              {/* Action */}
              <div className="col-span-1 flex items-center justify-center">
                <UserActions
                  userId={user.id}
                  currentRole={user.role}
                  isProtectedAdmin={isProtected}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
