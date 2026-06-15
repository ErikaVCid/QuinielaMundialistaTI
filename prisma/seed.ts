import { PrismaClient, Phase } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

dotenv.config()

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

const GROUPS = [
  { name: 'Grupo A', label: 'A' },
  { name: 'Grupo B', label: 'B' },
  { name: 'Grupo C', label: 'C' },
  { name: 'Grupo D', label: 'D' },
  { name: 'Grupo E', label: 'E' },
  { name: 'Grupo F', label: 'F' },
  { name: 'Grupo G', label: 'G' },
  { name: 'Grupo H', label: 'H' },
  { name: 'Grupo I', label: 'I' },
  { name: 'Grupo J', label: 'J' },
  { name: 'Grupo K', label: 'K' },
  { name: 'Grupo L', label: 'L' },
]

const TEAMS = [
  // Group A
  { name: 'México', code: 'MEX', flag: '🇲🇽', group: 'A', fifaRanking: 14 },
  { name: 'Uruguay', code: 'URU', flag: '🇺🇾', group: 'A', fifaRanking: 12 },
  { name: 'Kenia', code: 'KEN', flag: '🇰🇪', group: 'A', fifaRanking: 95 },
  { name: 'Tahití', code: 'TAH', flag: '🇵🇫', group: 'A', fifaRanking: 162 },
  // Group B
  { name: 'Argentina', code: 'ARG', flag: '🇦🇷', group: 'B', fifaRanking: 1 },
  { name: 'Chile', code: 'CHI', flag: '🇨🇱', group: 'B', fifaRanking: 29 },
  { name: 'Perú', code: 'PER', flag: '🇵🇪', group: 'B', fifaRanking: 42 },
  { name: 'Nueva Zelanda', code: 'NZL', flag: '🇳🇿', group: 'B', fifaRanking: 93 },
  // Group C
  { name: 'Estados Unidos', code: 'USA', flag: '🇺🇸', group: 'C', fifaRanking: 13 },
  { name: 'Panamá', code: 'PAN', flag: '🇵🇦', group: 'C', fifaRanking: 43 },
  { name: 'Bolivia', code: 'BOL', flag: '🇧🇴', group: 'C', fifaRanking: 86 },
  { name: 'Bielorrusia', code: 'BLR', flag: '🇧🇾', group: 'C', fifaRanking: 95 },
  // Group D
  { name: 'Brasil', code: 'BRA', flag: '🇧🇷', group: 'D', fifaRanking: 5 },
  { name: 'Paraguay', code: 'PAR', flag: '🇵🇾', group: 'D', fifaRanking: 60 },
  { name: 'Congo', code: 'COD', flag: '🇨🇩', group: 'D', fifaRanking: 58 },
  { name: 'Sudán del Sur', code: 'SSD', flag: '🇸🇸', group: 'D', fifaRanking: 170 },
  // Group E
  { name: 'Francia', code: 'FRA', flag: '🇫🇷', group: 'E', fifaRanking: 2 },
  { name: 'Serbia', code: 'SRB', flag: '🇷🇸', group: 'E', fifaRanking: 25 },
  { name: 'Camerún', code: 'CMR', flag: '🇨🇲', group: 'E', fifaRanking: 33 },
  { name: 'Indonesia', code: 'IDN', flag: '🇮🇩', group: 'E', fifaRanking: 133 },
  // Group F
  { name: 'Alemania', code: 'GER', flag: '🇩🇪', group: 'F', fifaRanking: 4 },
  { name: 'Croacia', code: 'CRO', flag: '🇭🇷', group: 'F', fifaRanking: 9 },
  { name: 'Escocia', code: 'SCO', flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', group: 'F', fifaRanking: 35 },
  { name: 'Sudáfrica', code: 'RSA', flag: '🇿🇦', group: 'F', fifaRanking: 57 },
  // Group G
  { name: 'España', code: 'ESP', flag: '🇪🇸', group: 'G', fifaRanking: 8 },
  { name: 'Grecia', code: 'GRE', flag: '🇬🇷', group: 'G', fifaRanking: 45 },
  { name: 'Brasil2', code: 'B2X', flag: '🇧🇷', group: 'G', fifaRanking: 75 },
  { name: 'Bielorrusia2', code: 'BL2', flag: '🇧🇾', group: 'G', fifaRanking: 102 },
  // Group H
  { name: 'Portugal', code: 'POR', flag: '🇵🇹', group: 'H', fifaRanking: 6 },
  { name: 'Rumanía', code: 'ROU', flag: '🇷🇴', group: 'H', fifaRanking: 46 },
  { name: 'Angola', code: 'ANG', flag: '🇦🇴', group: 'H', fifaRanking: 54 },
  { name: 'Uzbekistán', code: 'UZB', flag: '🇺🇿', group: 'H', fifaRanking: 77 },
  // Group I
  { name: 'Inglaterra', code: 'ENG', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', group: 'I', fifaRanking: 5 },
  { name: 'Bélgica', code: 'BEL', flag: '🇧🇪', group: 'I', fifaRanking: 3 },
  { name: 'Venezuela', code: 'VEN', flag: '🇻🇪', group: 'I', fifaRanking: 66 },
  { name: 'Gambia', code: 'GAM', flag: '🇬🇲', group: 'I', fifaRanking: 87 },
  // Group J
  { name: 'Países Bajos', code: 'NED', flag: '🇳🇱', group: 'J', fifaRanking: 7 },
  { name: 'Colombia', code: 'COL', flag: '🇨🇴', group: 'J', fifaRanking: 17 },
  { name: 'Senegal', code: 'SEN', flag: '🇸🇳', group: 'J', fifaRanking: 20 },
  { name: 'Azerbaiyán', code: 'AZE', flag: '🇦🇿', group: 'J', fifaRanking: 119 },
  // Group K
  { name: 'Italia', code: 'ITA', flag: '🇮🇹', group: 'K', fifaRanking: 9 },
  { name: 'Ecuador', code: 'ECU', flag: '🇪🇨', group: 'K', fifaRanking: 38 },
  { name: 'Nigeria', code: 'NGA', flag: '🇳🇬', group: 'K', fifaRanking: 31 },
  { name: 'Trinidad y Tobago', code: 'TRI', flag: '🇹🇹', group: 'K', fifaRanking: 88 },
  // Group L
  { name: 'Canadá', code: 'CAN', flag: '🇨🇦', group: 'L', fifaRanking: 45 },
  { name: 'Marruecos', code: 'MAR', flag: '🇲🇦', group: 'L', fifaRanking: 14 },
  { name: 'Japón', code: 'JPN', flag: '🇯🇵', group: 'L', fifaRanking: 22 },
  { name: 'Australia', code: 'AUS', flag: '🇦🇺', group: 'L', fifaRanking: 23 },
]

// Matches from June 15 — simplified subset for MVP (first matchday of each group + key matches)
const MATCHES = [
  // June 15
  { home: 'MEX', away: 'KEN', date: '2026-06-15T20:00:00Z', stadium: 'Estadio Azteca', city: 'Ciudad de México', group: 'A', matchday: 1 },
  { home: 'URU', away: 'TAH', date: '2026-06-15T23:00:00Z', stadium: 'Estadio Universitario', city: 'Monterrey', group: 'A', matchday: 1 },
  // June 16
  { home: 'ARG', away: 'CHI', date: '2026-06-16T00:00:00Z', stadium: 'MetLife Stadium', city: 'Nueva York', group: 'B', matchday: 1 },
  { home: 'USA', away: 'PAN', date: '2026-06-16T17:00:00Z', stadium: 'SoFi Stadium', city: 'Los Ángeles', group: 'C', matchday: 1 },
  { home: 'BRA', away: 'PAR', date: '2026-06-16T20:00:00Z', stadium: 'AT&T Stadium', city: 'Dallas', group: 'D', matchday: 1 },
  // June 17
  { home: 'FRA', away: 'CMR', date: '2026-06-17T00:00:00Z', stadium: "Levi's Stadium", city: 'San Francisco', group: 'E', matchday: 1 },
  { home: 'GER', away: 'SCO', date: '2026-06-17T17:00:00Z', stadium: 'Estadio BBVA', city: 'Monterrey', group: 'F', matchday: 1 },
  { home: 'ESP', away: 'GRE', date: '2026-06-17T20:00:00Z', stadium: 'Hard Rock Stadium', city: 'Miami', group: 'G', matchday: 1 },
  // June 18
  { home: 'POR', away: 'ROU', date: '2026-06-18T00:00:00Z', stadium: 'Estadio Akron', city: 'Guadalajara', group: 'H', matchday: 1 },
  { home: 'ENG', away: 'VEN', date: '2026-06-18T17:00:00Z', stadium: 'Lincoln Financial Field', city: 'Filadelfia', group: 'I', matchday: 1 },
  { home: 'NED', away: 'COL', date: '2026-06-18T20:00:00Z', stadium: 'Mercedes-Benz Stadium', city: 'Atlanta', group: 'J', matchday: 1 },
  // June 19
  { home: 'ITA', away: 'NGA', date: '2026-06-19T00:00:00Z', stadium: 'Gillette Stadium', city: 'Boston', group: 'K', matchday: 1 },
  { home: 'CAN', away: 'AUS', date: '2026-06-19T17:00:00Z', stadium: 'BC Place', city: 'Vancouver', group: 'L', matchday: 1 },
  { home: 'MAR', away: 'JPN', date: '2026-06-19T20:00:00Z', stadium: 'BC Place', city: 'Vancouver', group: 'L', matchday: 1 },
  // June 20
  { home: 'PER', away: 'NZL', date: '2026-06-20T17:00:00Z', stadium: 'Lumen Field', city: 'Seattle', group: 'B', matchday: 1 },
  { home: 'BOL', away: 'BLR', date: '2026-06-20T20:00:00Z', stadium: 'Arrowhead Stadium', city: 'Kansas City', group: 'C', matchday: 1 },
  { home: 'COD', away: 'SSD', date: '2026-06-20T23:00:00Z', stadium: 'NRG Stadium', city: 'Houston', group: 'D', matchday: 1 },
  // June 21
  { home: 'SRB', away: 'IDN', date: '2026-06-21T00:00:00Z', stadium: 'Rose Bowl', city: 'Los Ángeles', group: 'E', matchday: 1 },
  { home: 'CRO', away: 'RSA', date: '2026-06-21T17:00:00Z', stadium: 'Estadio Azteca', city: 'Ciudad de México', group: 'F', matchday: 1 },
  { home: 'BEL', away: 'GAM', date: '2026-06-21T20:00:00Z', stadium: 'Camping World Stadium', city: 'Orlando', group: 'I', matchday: 1 },
  { home: 'SEN', away: 'AZE', date: '2026-06-21T23:00:00Z', stadium: 'Allegiant Stadium', city: 'Las Vegas', group: 'J', matchday: 1 },
  // June 22
  { home: 'ECU', away: 'TRI', date: '2026-06-22T17:00:00Z', stadium: 'Estadio Universitario', city: 'Monterrey', group: 'K', matchday: 1 },
  { home: 'ANG', away: 'UZB', date: '2026-06-22T20:00:00Z', stadium: 'Estadio BBVA', city: 'Monterrey', group: 'H', matchday: 1 },
  // Matchday 2 - some matches
  { home: 'MEX', away: 'URU', date: '2026-06-22T23:00:00Z', stadium: 'Estadio Akron', city: 'Guadalajara', group: 'A', matchday: 2 },
  { home: 'KEN', away: 'TAH', date: '2026-06-23T00:00:00Z', stadium: 'Estadio Azteca', city: 'Ciudad de México', group: 'A', matchday: 2 },
  { home: 'ARG', away: 'PER', date: '2026-06-23T17:00:00Z', stadium: 'MetLife Stadium', city: 'Nueva York', group: 'B', matchday: 2 },
  { home: 'USA', away: 'BOL', date: '2026-06-23T20:00:00Z', stadium: 'AT&T Stadium', city: 'Dallas', group: 'C', matchday: 2 },
  { home: 'BRA', away: 'COD', date: '2026-06-23T23:00:00Z', stadium: 'Hard Rock Stadium', city: 'Miami', group: 'D', matchday: 2 },
  // Matchday 3 (decisive)
  { home: 'MEX', away: 'TAH', date: '2026-06-27T00:00:00Z', stadium: 'Estadio Azteca', city: 'Ciudad de México', group: 'A', matchday: 3 },
  { home: 'URU', away: 'KEN', date: '2026-06-27T00:00:00Z', stadium: 'Estadio BBVA', city: 'Monterrey', group: 'A', matchday: 3 },
]

async function main() {
  console.log('Seeding database...')

  // Create scoring rule
  await prisma.scoringRule.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      name: 'Reglas Estándar Mundial 2026',
      exactScore: 5,
      correctResult: 3,
      goalDiff: 1,
      noMatch: 0,
      bonusMultiplier: 1.0,
      applyFromPhase: 'GROUP',
      isActive: true,
    },
  })

  // Create admin user
  const adminPassword = await bcrypt.hash('Admin2026!', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@quiniela.com' },
    update: {},
    create: {
      email: 'admin@quiniela.com',
      name: 'Administrador',
      password: adminPassword,
      role: 'ADMIN',
    },
  })

  await prisma.participant.upsert({
    where: { userId: admin.id },
    update: {},
    create: {
      userId: admin.id,
      displayName: 'Admin',
    },
  })

  // Create demo users
  const demoUsers = [
    { email: 'carlos@demo.com', name: 'Carlos Mendoza', display: 'CarlosMX' },
    { email: 'sofia@demo.com', name: 'Sofía García', display: 'SofiaG' },
    { email: 'miguel@demo.com', name: 'Miguel Torres', display: 'MiguelT' },
    { email: 'ana@demo.com', name: 'Ana Rodríguez', display: 'AnaR' },
  ]

  const demoPassword = await bcrypt.hash('Demo2026!', 12)
  for (const u of demoUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, name: u.name, password: demoPassword, role: 'USER' },
    })
    await prisma.participant.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, displayName: u.display },
    })
  }

  // Create groups
  const groupMap: Record<string, string> = {}
  for (const g of GROUPS) {
    const group = await prisma.tournamentGroup.upsert({
      where: { id: `group-${g.label}` },
      update: {},
      create: { id: `group-${g.label}`, name: g.name, label: g.label },
    })
    groupMap[g.label] = group.id
  }

  // Create teams
  const teamMap: Record<string, string> = {}
  for (const t of TEAMS) {
    const team = await prisma.team.upsert({
      where: { code: t.code },
      update: {},
      create: {
        name: t.name,
        code: t.code,
        flag: t.flag,
        fifaRanking: t.fifaRanking,
        groupId: groupMap[t.group],
      },
    })
    teamMap[t.code] = team.id
  }

  // Create matches
  for (const m of MATCHES) {
    const externalId = `wc26-${m.home}-${m.away}-md${m.matchday}`
    await prisma.match.upsert({
      where: { externalId },
      update: {},
      create: {
        externalId,
        homeTeamId: teamMap[m.home],
        awayTeamId: teamMap[m.away],
        kickoffAt: new Date(m.date),
        stadium: m.stadium,
        city: m.city,
        phase: 'GROUP' as Phase,
        groupId: groupMap[m.group],
        status: 'SCHEDULED',
        matchday: m.matchday,
      },
    })
  }

  console.log('Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
