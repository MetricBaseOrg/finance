// Finance module compatibility shim: ported finance code imports auth helpers
// from here. The platform's single Auth.js instance lives in /auth.ts.
export { auth, signIn, signOut, handlers } from '@/auth'
