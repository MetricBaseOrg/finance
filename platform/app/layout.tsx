import type { Metadata } from 'next'
import { Manrope, JetBrains_Mono } from 'next/font/google'
import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider } from '@/components/providers/theme-provider'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-manrope',
  display: 'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'MetricBase Apps',
  description: 'Projects, finance, and field operations — one platform.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <div className="grid-bg" />
          <SessionProvider>{children}</SessionProvider>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--mid)',
                color: 'var(--light)',
                border: '1px solid var(--border)',
                borderRadius: '0',
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
