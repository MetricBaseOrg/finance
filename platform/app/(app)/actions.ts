'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth, signOut } from '@/auth'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'
import { ACTIVE_ORG_COOKIE } from '@/lib/org'

export async function setActiveOrg(orgId: string) {
  const cookieStore = await cookies()
  cookieStore.set(ACTIVE_ORG_COOKIE, orgId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
}

export async function signOutAction() {
  await signOut({ redirectTo: '/auth/signin' })
}

export async function createOrg(formData: FormData) {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const name = String(formData.get('name') ?? '').trim()
  const baseCurrency = String(formData.get('baseCurrency') ?? 'IDR')
  if (!name) return

  // Ensure a unique slug.
  const base = slugify(name) || 'org'
  let slug = base
  for (let i = 1; await prisma.organization.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      baseCurrency: baseCurrency === 'USD' ? 'USD' : 'IDR',
      members: {
        create: { userId: session.user.id, role: 'OWNER' },
      },
    },
  })

  await setActiveOrg(org.id)
  redirect('/home')
}
