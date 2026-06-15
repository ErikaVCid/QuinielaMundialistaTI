/**
 * Shared team logo component — shows HD badge (TheSportsDB crest) when available,
 * falls back to national flag (flagcdn.com URL or emoji).
 *
 * Usage:
 *   <TeamFlag team={match.homeTeam} size="sm" />
 *   <TeamFlag team={{ name: 'Mexico', flag: '🇲🇽', badge: 'https://...' }} size="md" />
 */

export type TeamLike = {
  name: string
  flag?: string | null
  badge?: string | null
}

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_IMG: Record<Size, string> = {
  xs: 'w-5 h-auto',
  sm: 'w-6 h-auto',
  md: 'w-8 h-auto',
  lg: 'w-14 h-auto',
  xl: 'w-20 h-auto',
}

const SIZE_EMOJI: Record<Size, string> = {
  xs: 'text-sm',
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-4xl',
  xl: 'text-5xl',
}

const SIZE_PLACEHOLDER: Record<Size, string> = {
  xs: 'w-5 h-3.5',
  sm: 'w-6 h-4',
  md: 'w-8 h-5',
  lg: 'w-14 h-10',
  xl: 'w-20 h-14',
}

export function TeamFlag({
  team,
  size = 'sm',
  className = '',
}: {
  team: TeamLike
  size?: Size
  className?: string
}) {
  // Prefer badge (HD crest), fall back to flag (national flag)
  const src = team.badge ?? team.flag

  if (!src) {
    return (
      <span
        className={`inline-block rounded bg-[#2e2e3e] flex-shrink-0 ${SIZE_PLACEHOLDER[size]} ${className}`}
      />
    )
  }

  if (src.startsWith('http')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={team.name}
        className={`${SIZE_IMG[size]} rounded-sm object-contain flex-shrink-0 inline-block ${className}`}
      />
    )
  }

  // Emoji flag
  return (
    <span className={`${SIZE_EMOJI[size]} leading-none flex-shrink-0 inline-block ${className}`}>
      {src}
    </span>
  )
}
