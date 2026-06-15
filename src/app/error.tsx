'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f] p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-white mb-2">Algo salió mal</h1>
        <p className="text-gray-400 text-sm mb-6">
          Ocurrió un error inesperado. Por favor intenta de nuevo.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-all text-sm"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-[#2e2e3e] text-gray-400 hover:text-white font-medium transition-all text-sm"
          >
            Volver al inicio
          </Link>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="text-xs text-gray-600 cursor-pointer">Error técnico</summary>
            <pre className="mt-2 text-xs text-red-400 bg-[#111118] p-3 rounded-lg overflow-auto">
              {error.message}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
