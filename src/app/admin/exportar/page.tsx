'use client'
import { useState } from 'react'
import { FileSpreadsheet, Download, Loader2, Users, Trophy, Target } from 'lucide-react'

export default function ExportarPage() {
  const [loading, setLoading] = useState<string | null>(null)

  async function download(type: string, filename: string) {
    setLoading(type)
    try {
      const res = await fetch(`/api/admin/export?type=${type}`)
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error al descargar')
    } finally {
      setLoading(null)
    }
  }

  const exports = [
    { id: 'ranking', icon: Trophy, label: 'Tabla de Posiciones', desc: 'Ranking completo con puntos, exactos y resultados', file: 'ranking-mundial-2026.xlsx', color: 'text-amber-400' },
    { id: 'predictions', icon: Target, label: 'Todos los Pronósticos', desc: 'Pronósticos de todos los participantes por partido', file: 'pronosticos-mundial-2026.xlsx', color: 'text-green-400' },
    { id: 'users', icon: Users, label: 'Participantes', desc: 'Lista de participantes con estadísticas completas', file: 'participantes-mundial-2026.xlsx', color: 'text-blue-400' },
  ]

  return (
    <div className="pt-16 md:pt-0 p-4 md:p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-1">Exportar a Excel</h1>
        <p className="text-gray-400 text-sm">Descarga los datos de la quiniela en formato Excel</p>
      </div>

      <div className="space-y-4">
        {exports.map(({ id, icon: Icon, label, desc, file, color }) => (
          <div key={id} className="bg-[#111118] rounded-xl border border-[#1e1e2e] p-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#1a1a24] border border-[#2e2e3e] flex items-center justify-center flex-shrink-0">
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <div className="text-white font-medium">{label}</div>
                <div className="text-gray-400 text-sm mt-0.5">{desc}</div>
              </div>
            </div>
            <button
              onClick={() => download(id, file)}
              disabled={loading === id}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-all disabled:opacity-50 flex-shrink-0"
            >
              {loading === id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Descargar
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-gray-400">
        <FileSpreadsheet className="w-4 h-4 text-blue-400 inline mr-2" />
        Los archivos se generan en tiempo real con los datos actualizados de la base de datos.
      </div>
    </div>
  )
}
