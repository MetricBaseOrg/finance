import { redirect } from 'next/navigation'

// The platform has no public root — send everyone to the app shell, which in
// turn bounces unauthenticated users to /auth/signin via middleware.
export default function Home() {
  redirect('/home')
}
