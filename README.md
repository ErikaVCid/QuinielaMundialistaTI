# Quiniela Mundial México 2026

Aplicación de quiniela en tiempo real para el Mundial FIFA 2026. Los usuarios registran pronósticos antes del inicio de cada partido y acumulan puntos según la exactitud de sus predicciones.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 16 · App Router · TypeScript · Tailwind CSS 4 |
| Backend | Next.js API Routes (serverless) |
| Base de datos | PostgreSQL + Prisma 7 + `@prisma/adapter-pg` |
| Auth | NextAuth v5 beta · JWT |
| Datos deportivos | API-Football v3 · worldcup26.ir · TheSportsDB |

---

## Instalación local

### 1. Requisitos

- Node.js 20+
- Docker Desktop (para PostgreSQL local)

### 2. Clonar e instalar

```bash
git clone <repo-url>
cd mundial-quiniela
npm install
```

### 3. Variables de entorno

```bash
cp .env.example .env.local
# Edita .env.local con tus valores
```

Variables mínimas para desarrollo:

```env
DATABASE_URL="postgresql://oip_user:oip_password@localhost:5433/mundial_quiniela"
NEXTAUTH_SECRET="cualquier-string-largo"
AUTH_SECRET="igual-que-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PROTECTED_ADMIN_EMAIL="tu@email.com"
PREDICTION_PROVIDER="local-fifa-ranking"
```

### 4. Base de datos local

```bash
# PostgreSQL con Docker
docker run -d \
  --name mundial-postgres \
  -e POSTGRES_USER=oip_user \
  -e POSTGRES_PASSWORD=oip_password \
  -e POSTGRES_DB=mundial_quiniela \
  -p 5433:5432 \
  postgres:16

npm run db:push       # Aplicar schema
npm run seed          # Datos iniciales
npm run sync:wc26     # Partidos reales
npm run sync:tsdb     # Logos HD
npm run news:generate # Noticias
npm run predictions:generate  # Predicciones IA
npm run dev           # → http://localhost:3000
```

**Credenciales demo:** `carlos@demo.com` / `Demo2026!`

---

## Despliegue en Vercel

### Paso 1 — Base de datos en Neon (gratis)

1. Crear cuenta en [neon.tech](https://neon.tech)
2. Crear proyecto → copiar connection string
3. El formato debe incluir `?sslmode=require`

### Paso 2 — Variables en Vercel

En Vercel → Settings → Environment Variables:

| Variable | Valor |
|---|---|
| `DATABASE_URL` | Connection string Neon con `?sslmode=require` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_SECRET` | mismo que NEXTAUTH_SECRET |
| `NEXTAUTH_URL` | `https://tu-proyecto.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | `https://tu-proyecto.vercel.app` |
| `PROTECTED_ADMIN_EMAIL` | `e.valenzuela@lidcorp.mx` |
| `ADMIN_EMAIL` | `e.valenzuela@lidcorp.mx` |
| `PREDICTION_PROVIDER` | `local-fifa-ranking` |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `API_FOOTBALL_KEY` | tu key (opcional) |
| `WORLDCUP26_TOKEN` | token worldcup26.ir (opcional) |

### Paso 3 — Desplegar

```bash
npm i -g vercel
vercel --prod
```

### Paso 4 — Inicializar BD en producción

```bash
DATABASE_URL="tu-neon-url" npx prisma db push
DATABASE_URL="tu-neon-url" npm run seed
DATABASE_URL="tu-neon-url" npm run sync:wc26
DATABASE_URL="tu-neon-url" npm run sync:tsdb
DATABASE_URL="tu-neon-url" npm run news:generate
DATABASE_URL="tu-neon-url" npm run predictions:generate
```

---

## Comandos

```bash
npm run dev                    # Desarrollo
npm run build                  # Build producción
npm run db:push                # Aplicar schema
npm run seed                   # Datos iniciales
npm run sync:af                # Sync API-Football
npm run sync:wc26              # Sync worldcup26.ir
npm run sync:tsdb              # Sync logos TheSportsDB
npm run news:generate          # Generar noticias
npm run predictions:generate   # Predicciones IA
npm run cron:dev               # Cron local
```

---

## Errores comunes

| Error | Solución |
|---|---|
| `DATABASE_URL is not set` | Verificar `.env.local` |
| `PrismaClientInitializationError` | BD no corriendo o URL incorrecta |
| Build falla: `Cannot find module '@prisma/client'` | `package.json` debe tener `"postinstall": "prisma generate"` |
| `NEXTAUTH_URL` incorrecto | Debe apuntar al dominio de producción sin trailing slash |
| Cron no ejecuta | Plan Pro de Vercel para intervalos <1h |

---

## Licencia

Proyecto privado — Lidcorp MX © 2026
