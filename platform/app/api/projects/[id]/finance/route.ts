import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getRole } from '@/lib/permissions'
import { projectFinance } from '@/lib/finance/project'

export const dynamic = 'force-dynamic'

/** GET /api/projects/[id]/finance — budget/income/expense/net for a project. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      organizationId: true,
      budget: true,
      workspace: { select: { slug: true, baseCurrency: true } },
    },
  })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const role = await getRole(session.user.id, project.organizationId)
  if (!role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const f = await projectFinance(project.organizationId, id)
  const budget = project.budget != null ? Number(project.budget) : null
  return NextResponse.json({
    ...f,
    budget,
    remaining: budget != null ? budget - f.expense : null,
    base: project.workspace.baseCurrency,
    slug: project.workspace.slug,
  })
}
