'use client'
import { useEffect } from 'react'

export default function GlobalError({
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
    <html lang="es">
      <body style={{ background: '#0a0a0f', margin: 0, fontFamily: 'sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚽</div>
            <h1 style={{ color: 'white', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Error crítico</h1>
            <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              La aplicación encontró un error grave.
            </p>
            <button
              onClick={reset}
              style={{ background: '#16a34a', color: 'white', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
            >
              Reintentar
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
