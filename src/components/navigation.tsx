'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  Home, Calendar, Target, Trophy, Newspaper,
  LayoutGrid, BarChart2, User, Settings, LogOut, Menu, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { signOut } from 'next-auth/react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: Home },
  { href: '/partidos', label: 'Partidos', icon: Calendar },
  { href: '/grupos', label: 'Grupos', icon: LayoutGrid },
  { href: '/posiciones-grupo', label: 'Por Grupo', icon: BarChart2 },
  { href: '/pronosticos', label: 'Pronósticos', icon: Target },
  { href: '/posiciones', label: 'Posiciones', icon: Trophy },
  { href: '/noticias', label: 'Noticias', icon: Newspaper },
]

export function Navigation() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-6 border-b border-[#1e1e2e]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-xl font-bold">
            ⚽
          </div>
          <div>
            <div className="font-bold text-white text-sm leading-tight">Quiniela</div>
            <div className="text-xs text-green-400 font-semibold">MUNDIAL MÉXICO 2026</div>
          </div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive(href)
                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-[#1e1e2e] space-y-1">
        {session?.user?.role === 'ADMIN' && (
          <Link
            href="/admin"
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
              pathname.startsWith('/admin')
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            )}
          >
            <Settings className="w-4 h-4" />
            Admin
          </Link>
        )}
        <Link
          href="/perfil"
          onClick={() => setMobileOpen(false)}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
            pathname.startsWith('/perfil')
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          )}
        >
          <User className="w-4 h-4" />
          {session?.user?.name ?? 'Perfil'}
        </Link>
        {session && (
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#111118] border-b border-[#1e1e2e] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚽</span>
          <span className="font-bold text-sm text-white">Quiniela <span className="text-green-400">2026</span></span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="text-gray-400">
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={cn(
        'md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-[#111118] border-r border-[#1e1e2e] transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {navContent}
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#111118] border-r border-[#1e1e2e] flex-col z-30">
        {navContent}
      </aside>
    </>
  )
}
