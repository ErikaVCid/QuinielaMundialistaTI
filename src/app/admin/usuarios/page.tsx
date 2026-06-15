import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { Shield, User } from 'lucide-react'
import { UserActions } from './user-actions'

export default async function AdminUsuariosPage() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') redirect('/')

  const users = await prisma.user.findMany({
    include: { participant: true },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Gestión de Usuarios</h1>
        <p className="text-gray-400 text-sm">{users.length} usuarios registrados</p>
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
        {users.map((user) => (
          <div key={user.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-b border-[#1e1e2e] last:border-0 hover:bg-white/[0.02]">
            <div className="col-span-3 flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500/20 to-blue-500/20 border border-[#2e2e3e] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {(user.name ?? user.email ?? '?').charAt(0).toUpperCase()}
              </div>
              <span className="text-white truncate">{user.name ?? '—'}</span>
            </div>
            <div className="col-span-4 text-gray-400 truncate flex items-center">{user.email}</div>
            <div className="col-span-2 text-gray-300 flex items-center">{user.participant?.displayName ?? '—'}</div>
            <div className="col-span-1 flex items-center">
              {user.role === 'ADMIN' ? (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-medium"><Shield className="w-3 h-3" /> Admin</span>
              ) : (
                <span className="flex items-center gap-1 text-gray-500 text-xs"><User className="w-3 h-3" /> User</span>
              )}
            </div>
            <div className="col-span-1 text-green-400 font-bold flex items-center">{user.participant?.totalPoints ?? 0}</div>
            <div className="col-span-1 flex items-center justify-center">
              <UserActions userId={user.id} currentRole={user.role} currentUserEmail={session.user.email!} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
