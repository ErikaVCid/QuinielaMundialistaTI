import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Navigation } from '@/components/navigation'
import { LiveRefresh } from '@/components/live-refresh'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: 'Quiniela Mundial México 2026',
  description: 'La quiniela oficial del Mundial FIFA México 2026',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} font-sans bg-[#0a0a0f] text-gray-100 min-h-screen`}>
        <Providers>
          <div className="flex min-h-screen">
            <Navigation />
            <main className="flex-1 md:ml-64 min-h-screen">
              {children}
            </main>
          </div>
          <LiveRefresh />
        </Providers>
      </body>
    </html>
  )
}
