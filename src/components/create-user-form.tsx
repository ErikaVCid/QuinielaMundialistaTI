'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X, Loader2, Eye, EyeOff } from 'lucide-react'

export function CreateUserButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-all shadow-lg shadow-green-500/20"
      >
        <UserPlus className="w-4 h-4" />
        Crear usuario
      </button>
      {open && <CreateUserModal onClose={() => setOpen(false)} />}
    </>
  )
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showPw, setShowPw] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const form = e.currentTarget
    const data = {
      name:        (form.elements.namedItem('name')        as HTMLInputElement).value,
      displayName: (form.elements.namedItem('displayName') as HTMLInputElement).value,
      email:       (form.elements.namedItem('email')       as HTMLInputElement).value,
      password:    (form.elements.namedItem('password')    as HTMLInputElement).value,
      role:        (form.elements.namedItem('role')        as HTMLSelectElement).value,
    }
    startTransition(async () => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json() as { message: string }
      if (!res.ok) {
        setError(json.message)
      } else {
        router.refresh()
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#111118] border border-[#2e2e3e] rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Crear usuario</h2>
            <p className="text-gray-500 text-sm mt-0.5">Se creará automáticamente su perfil de quiniela</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { id: 'name',        label: 'Nombre completo',        placeholder: 'Juan Pérez',   type: 'text' },
            { id: 'displayName', label: 'Nombre en la quiniela',  placeholder: 'JuanMX',       type: 'text' },
            { id: 'email',       label: 'Correo electrónico',     placeholder: 'juan@mail.com',type: 'email' },
          ].map(({ id, label, placeholder, type }) => (
            <div key={id}>
              <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
              <input id={id} name={id} type={type} required placeholder={placeholder}
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm transition-all"
              />
            </div>
          ))}

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
            <div className="relative">
              <input id="password" name="password" type={showPw ? 'text' : 'password'} required
                placeholder="Mínimo 8 caracteres"
                className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white placeholder-gray-600 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm transition-all"
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">Rol</label>
            <div className="w-full px-3.5 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-gray-400 text-sm flex items-center gap-2">
              <span>Usuario (quiniela)</span>
              <span className="ml-auto text-xs text-gray-600">Solo el admin principal puede ser administrador</span>
            </div>
            <input type="hidden" name="role" value="USER" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[#2e2e3e] text-gray-400 hover:text-white hover:border-gray-500 text-sm font-medium transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Creando...</> : 'Crear usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
