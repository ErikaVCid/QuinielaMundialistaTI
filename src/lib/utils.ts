import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isAfter } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMatchDate(date: Date | string): string {
  return format(new Date(date), "d 'de' MMMM, yyyy", { locale: es })
}

export function formatMatchTime(date: Date | string): string {
  return format(new Date(date), 'HH:mm', { locale: es })
}

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: es })
}

export function isMatchLocked(kickoffAt: Date | string): boolean {
  return isAfter(new Date(), new Date(kickoffAt))
}

export function getPositionChange(current: number, prev: number | null): number {
  if (prev === null) return 0
  return prev - current
}

export function getPositionIcon(change: number): string {
  if (change > 0) return '↑'
  if (change < 0) return '↓'
  return '–'
}

export function phaseLabel(phase: string): string {
  const labels: Record<string, string> = {
    GROUP: 'Fase de Grupos',
    ROUND_OF_16: 'Octavos de Final',
    QUARTER_FINAL: 'Cuartos de Final',
    SEMI_FINAL: 'Semifinal',
    THIRD_PLACE: 'Tercer Lugar',
    FINAL: 'Final',
  }
  return labels[phase] ?? phase
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    SCHEDULED: 'Programado',
    LIVE: 'En Vivo',
    FINISHED: 'Finalizado',
    POSTPONED: 'Pospuesto',
  }
  return labels[status] ?? status
}
