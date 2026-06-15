import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="text-center">
        <div className="text-7xl mb-4">⚽</div>
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-gray-400 mb-6">Esta página no existe en el Mundial</p>
        <Link href="/" className="px-6 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-all">
          Volver al Dashboard
        </Link>
      </div>
    </div>
  )
}
