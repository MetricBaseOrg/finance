import NextAuth from 'next-auth'
import { authConfig } from '@/auth.config'

// Next.js 16 renamed the `middleware` convention to `proxy`. The Auth.js
// `auth` handler doubles as the proxy function (runs the edge-safe
// `authorized` callback from auth.config.ts on every matched request).
const { auth } = NextAuth(authConfig)

export default auth

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
