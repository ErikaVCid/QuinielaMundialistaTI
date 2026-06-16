import type { NextAuthConfig } from 'next-auth'

// Edge-compatible auth config — NO Prisma, NO Node.js-only modules
// Used by middleware.ts which runs on Vercel Edge Runtime
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/registro')
      const isApiAuth = nextUrl.pathname.startsWith('/api/auth')
      const isApiRoute = nextUrl.pathname.startsWith('/api/')
      const isPublic = isAuthPage || isApiAuth || isApiRoute

      if (!isLoggedIn && !isPublic) {
        const loginUrl = new URL('/login', nextUrl.origin)
        loginUrl.searchParams.set('callbackUrl', nextUrl.pathname)
        return Response.redirect(loginUrl)
      }
      if (isLoggedIn && isAuthPage) {
        return Response.redirect(new URL('/', nextUrl.origin))
      }
      return true
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    },
  },
  providers: [],
}
