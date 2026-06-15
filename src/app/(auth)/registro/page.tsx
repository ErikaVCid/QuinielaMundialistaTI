'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'

export default function RegistroPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const form = e.currentTarget
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value,
      email: (form.elements.namedItem('email') as HTMLInputElement).value,
      password: (form.elements.namedItem('password') as HTMLInputElement).value,
      displayName: (form.elements.namedItem('displayName') as HTMLInputElement).value,
    }

    startTransition(async () => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.message ?? 'Error al registrarse')
      } else {
        router.push('/login?registered=1')
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0a0f]">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-green-950/40 via-[#0a0a0f] to-[#0a0a0f]" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-green-500/20">
            ⚽
          </div>
          <h1 className="text-2xl font-bold text-white">Crear cuenta</h1>
          <p className="text-green-400 font-semibold text-sm tracking-wider uppercase">Mundial México 2026</p>
        </div>

        <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-1">Regístrate</h2>
          <p className="text-sm text-gray-500 mb-6">Únete a la quiniela del Mundial</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre completo</label>
              <input name="name" required placeholder="Juan Pérez"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Nombre en la quiniela</label>
              <input name="displayName" required placeholder="JuanMX"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Correo electrónico</label>
              <input name="email" type="email" required placeholder="tu@correo.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1.5">Contraseña</label>
              <input name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm" />
            </div>
            <button type="submit" disabled={isPending}
              className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="text-green-400 hover:text-green-300 font-medium">Inicia sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
