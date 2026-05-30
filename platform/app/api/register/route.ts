import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/utils'

export async function POST(req: Request) {
  try {
    const { name, email, password, workspaceName } = await req.json()

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const hashed = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
      },
    })

    const wsName = workspaceName || `${name}'s Workspace`
    const workspace = await prisma.organization.create({
      data: {
        name: wsName,
        slug: generateSlug(wsName),
        members: {
          create: { userId: user.id, role: 'OWNER' },
        },
      },
    })

    return NextResponse.json({ user: { id: user.id, email: user.email }, workspace })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
