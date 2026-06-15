import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

// Edge-compatible middleware — uses authConfig without Prisma
export default NextAuth(authConfig).auth

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
