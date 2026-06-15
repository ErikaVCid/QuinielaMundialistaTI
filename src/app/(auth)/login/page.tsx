'use client'
import { useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    startTransition(async () => {
      const res = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      if (res?.error) {
        setError('Correo o contraseña incorrectos')
      } else {
        router.push('/')
        router.refresh()
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0a0f]">
      {/* Background gradient */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-green-950/40 via-[#0a0a0f] to-[#0a0a0f]" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-green-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-green-500/5 rounded-full blur-2xl" />
      </div>

      <div className="relative w-full max-w-sm mx-4">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg shadow-green-500/20">
            ⚽
          </div>
          <h1 className="text-2xl font-bold text-white">Quiniela</h1>
          <p className="text-green-400 font-semibold text-sm tracking-wider uppercase">Mundial México 2026</p>
        </div>

        {/* Card */}
        <div className="bg-[#111118] rounded-2xl border border-[#1e1e2e] p-8 shadow-2xl">
          <h2 className="text-lg font-semibold text-white mb-1">Iniciar sesión</h2>
          <p className="text-sm text-gray-500 mb-6">Ingresa a tu cuenta para hacer tus pronósticos</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                placeholder="tu@correo.com"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm transition-all"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg bg-[#1a1a24] border border-[#2e2e3e] text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50 focus:ring-1 focus:ring-green-500/30 text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="w-full py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>

          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#2e2e3e]" />
            <span className="text-xs text-gray-600">o</span>
            <div className="h-px flex-1 bg-[#2e2e3e]" />
          </div>

          <Link
            href="/registro"
            className="mt-4 flex w-full items-center justify-center py-2.5 rounded-lg border border-[#2e2e3e] hover:border-green-500/40 text-gray-300 hover:text-white text-sm font-semibold transition-all hover:bg-green-500/5"
          >
            Crear cuenta nueva
          </Link>
        </div>

        {/* Demo credentials hint */}
        <div className="mt-4 p-3 rounded-lg bg-white/[0.03] border border-white/5 text-xs text-gray-500 text-center">
          Demo: <span className="text-gray-400">carlos@demo.com</span> / <span className="text-gray-400">Demo2026!</span>
        </div>
      </div>
    </div>
  )
}
