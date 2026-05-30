import type { NextAuthConfig } from 'next-auth'

// Edge-safe config (no Prisma, no Node-only deps) — imported by middleware.
// Provider list with DB access lives in auth.ts.
export const authConfig: NextAuthConfig = {
  // Trust the incoming request host so sign-in works on localhost AND the LAN
  // IP (e.g. http://192.168.1.3:3000) without a hardcoded AUTH_URL. Auth.js v5
  // otherwise rejects requests from a host it can't verify (UntrustedHost).
  trustHost: true,
  pages: { signIn: '/auth/signin', verifyRequest: '/auth/verify' },
  session: { strategy: 'jwt' },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const { pathname } = nextUrl

      // Public endpoints: the Auth.js API, the bot service API, account
      // registration, invite acceptance, health check, and cron (own secrets).
      if (pathname.startsWith('/api/auth')) return true
      if (pathname.startsWith('/api/bot')) return true
      if (pathname.startsWith('/api/register')) return true
      if (pathname.startsWith('/api/health')) return true
      if (pathname.startsWith('/api/cron')) return true
      if (pathname.startsWith('/invite')) return true
      if (pathname.startsWith('/auth')) {
        return isLoggedIn ? Response.redirect(new URL('/home', nextUrl)) : true
      }
      return isLoggedIn
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string
      return session
    },
  },
}
