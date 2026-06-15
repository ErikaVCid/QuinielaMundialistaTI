@AGENTS.md

# Quiniela Mundial 2026

Actúa como senior full-stack developer. Estoy construyendo una app de quiniela para el Mundial FIFA 2026 con predicciones IA.

## Proyecto

- **Ruta local:** `/Users/erikavalenzuela/mundial-quiniela`
- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 7 · PostgreSQL (Docker, puerto 5433)
- **Auth:** NextAuth v5 beta · JWT
- **Provider de datos:** API-Football v3 (`API_FOOTBALL_KEY` en `.env.local`)

## Reglas siempre activas

1. **Nunca hardcodear la API key** — leer siempre desde `process.env.API_FOOTBALL_KEY`
2. **Upsert en toda sincronización** — nunca insertar sin verificar existencia
3. **No gastar cuota innecesariamente** — 1 request por endpoint, cachear resultados
4. **Logs claros** en todos los scripts de sync
5. **Prisma 7 requiere adapter-pg** — siempre usar `new PrismaPg({ connectionString })` + `new PrismaClient({ adapter })`
6. **Puerto PostgreSQL: 5433** (no 5432 — ese está ocupado por PG local del sistema)
7. **TypeScript strict** — sin `any`, sin variables no usadas
8. **ESLint limpio** antes de cada commit

## Variables de entorno (.env.local)

```env
DATABASE_URL="postgresql://oip_user:oip_password@localhost:5433/mundial_quiniela"
NEXTAUTH_SECRET="mundial-quiniela-secret-2026-super-secure"
AUTH_SECRET="mundial-quiniela-secret-2026-super-secure"
NEXTAUTH_URL="http://localhost:3000"
FOOTBALL_API_PROVIDER="api-football"
API_FOOTBALL_KEY=""                    ← poner key real aquí
API_FOOTBALL_BASE_URL="https://v3.football.api-sports.io"
WORLDCUP26_TOKEN="..."                 ← backup provider
CRON_SECRET=""
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Comandos clave

```bash
npm run dev              # servidor local http://localhost:3000
npm run sync:af          # sincronizar partidos/equipos desde API-Football
npm run predictions:generate  # generar predicciones IA para todos los partidos
npm run db:push          # aplicar schema a BD
npm run seed             # datos de prueba
docker start oip_postgres  # levantar PostgreSQL
```

## Credenciales de prueba

- Admin: `admin@quiniela.com` / `Admin2026!`
- Usuario demo: `carlos@demo.com` / `Demo2026!`

## Arquitectura de providers

```
API_FOOTBALL_KEY set  →  ApiFootballProvider   (prioridad)
SPORTMONKS_API_KEY    →  SportmonksProvider
WORLDCUP26_TOKEN      →  WorldCup26Provider
ninguno               →  MockFootballProvider
```

## Modelos principales

- `Team` — equipos con código FIFA, logo, ranking
- `Match` — partidos con fase, estadio, marcador, ganador
- `AiPrediction` — predicciones IA (separadas de predicciones de usuarios)
- `Prediction` — pronósticos de usuarios de la quiniela
- `Participant` — jugadores de la quiniela con puntos
- `ScoringRule` — reglas de puntuación configurables

## Motor de predicción IA

Ver `src/lib/predictions.ts`. Usa ranking FIFA + ventaja local (MEX/USA/CAN) + diferencia de ranking para calcular probabilidades y marcador esperado. Modelo v1.

## Notas de API-Football v3

- Endpoint fixtures: `GET /fixtures?league=1&season=2026`
- Header auth: `x-apisports-key: TU_KEY`
- ExternalId en DB: prefijo `af-{fixtureId}`
- Free tier: 100 requests/día — el sync completo usa 1 request
- Liga 1 = FIFA World Cup
