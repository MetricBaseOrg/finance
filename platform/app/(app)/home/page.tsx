import { getOrgContext } from '@/lib/org'
import { prisma } from '@/lib/prisma'
import { HomeView, type HomeData } from '@/app/home/HomeView'
import type { AppId, Tone } from '@/app/home/ui'

export const dynamic = 'force-dynamic'

const MODULE_APP: Record<string, AppId> = {
  finance: 'metricbase',
  projects: 'probase',
  field: 'fieldflow',
}
const APP_LABEL: Record<AppId, string> = {
  metricbase: 'Finance', probase: 'Projects', fieldflow: 'Field', ogtools: 'Tools',
}

function rel(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

function due(d: Date | null): { label: string; tone: Tone } {
  if (!d) return { label: 'No date', tone: 'neutral' }
  const days = Math.ceil((d.getTime() - Date.now()) / 86_400_000)
  if (days < 0) return { label: 'Overdue', tone: 'bad' }
  if (days === 0) return { label: 'Today', tone: 'warn' }
  if (days === 1) return { label: 'Tomorrow', tone: 'neutral' }
  return { label: `${days} days`, tone: 'neutral' }
}

export default async function HomePage() {
  const { user, activeOrg } = await getOrgContext()
  const orgId = activeOrg.id
  const since30 = new Date(Date.now() - 30 * 86_400_000)
  const since30Str = since30.toISOString().slice(0, 10)

  const [
    projects, projectsActive, finAccounts, txns30, baseCurrencyOrg,
    nodes, flows30, liftingsActive, assignedTasks, unreadNotifs, audit,
  ] = await Promise.all([
    prisma.project.count({ where: { organizationId: orgId } }),
    prisma.project.count({ where: { organizationId: orgId, status: 'ACTIVE' } }),
    prisma.finAccount.count({ where: { organizationId: orgId, archivedAt: null } }),
    prisma.transaction.count({ where: { organizationId: orgId, date: { gte: since30 } } }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { baseCurrency: true } }),
    prisma.node.count({ where: { organizationId: orgId, active: true } }),
    prisma.flow.count({ where: { organizationId: orgId, date: { gte: since30Str } } }),
    prisma.lifting.count({ where: { organizationId: orgId, status: 'active' } }),
    prisma.task.findMany({
      where: { assigneeId: user.id, project: { organizationId: orgId } },
      include: { project: { select: { id: true } } },
      orderBy: [{ dueDate: 'asc' }],
      take: 6,
    }),
    prisma.taskNotification.count({ where: { userId: user.id, read: false } }),
    prisma.auditLog.findMany({
      where: { organizationId: orgId },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 7,
    }),
  ])

  const baseCurrency = baseCurrencyOrg?.baseCurrency ?? 'IDR'
  const flat = (n: number) => [n * 0.9, n * 0.95, n * 0.92, n, n * 0.98, n * 1.02, n, n].map((x) => Math.max(0, x))

  const apps: HomeData['apps'] = [
    {
      id: 'probase', name: 'ProBase', sub: 'Projects', tagline: 'Plan, schedule & track project delivery', href: '/projects',
      status: projectsActive < projects ? 'warn' : 'ok', statusLabel: `${projects} project${projects === 1 ? '' : 's'}`,
      metrics: [['Active', String(projectsActive), 'ok'], ['Total', String(projects), 'neutral'], ['My tasks', String(assignedTasks.length), assignedTasks.length ? 'warn' : 'neutral']],
    },
    {
      id: 'metricbase', name: 'Finance', sub: 'Tracker', tagline: 'Multi-currency books, P&L & balance sheet', href: '/finance',
      status: 'ok', statusLabel: `${finAccounts} account${finAccounts === 1 ? '' : 's'}`,
      metrics: [['Accounts', String(finAccounts), 'neutral'], ['Txns 30d', String(txns30), 'neutral'], ['Base', baseCurrency, 'neutral']],
    },
    {
      id: 'fieldflow', name: 'FieldFlow', sub: 'Field ops', tagline: 'Crude production, lifting & dispatch', href: '/field',
      status: 'ok', statusLabel: `${nodes} node${nodes === 1 ? '' : 's'}`,
      metrics: [['Nodes', String(nodes), 'neutral'], ['Flows 30d', String(flows30), 'neutral'], ['Liftings', String(liftingsActive), 'neutral']],
    },
    {
      id: 'ogtools', name: 'OGtools', sub: 'Calculators', tagline: 'Oilfield unit & engineering calculators', href: '/tools',
      status: 'ok', statusLabel: '8 tools available',
      metrics: [['Tools', '8', 'neutral'], ['Offline', 'Yes', 'ok'], ['Presets', '—', 'neutral']],
    },
  ]

  const kpis: HomeData['kpis'] = [
    { app: 'probase', label: 'Projects on track', value: String(projectsActive), unit: `of ${projects}`, delta: projectsActive < projects ? `${projects - projectsActive} at risk` : 'all', tone: projectsActive < projects ? 'warn' : 'ok', spark: flat(projectsActive || 1) },
    { app: 'metricbase', label: 'Accounts', value: String(finAccounts), unit: 'total', delta: baseCurrency, tone: 'neutral', spark: flat(finAccounts || 1) },
    { app: 'fieldflow', label: 'Field nodes', value: String(nodes), unit: 'active', delta: 'live', tone: 'ok', spark: flat(nodes || 1) },
    { app: 'fieldflow', label: 'Flows', value: String(flows30), unit: '30d', delta: 'logged', tone: 'neutral', spark: flat(flows30 || 1) },
    { app: 'probase', label: 'My tasks', value: String(assignedTasks.length), unit: 'open', delta: assignedTasks.length ? 'assigned' : 'clear', tone: assignedTasks.length ? 'warn' : 'ok', spark: flat(assignedTasks.length || 1) },
    { app: 'metricbase', label: 'Transactions', value: String(txns30), unit: '30d', delta: 'recorded', tone: 'neutral', spark: flat(txns30 || 1) },
  ]

  const activity: HomeData['activity'] = audit.map((a) => {
    let summary = a.action
    try { summary = (JSON.parse(a.metadata ?? '{}') as { summary?: string }).summary || a.action } catch { /* keep */ }
    const app = MODULE_APP[a.module] ?? 'probase'
    return {
      app, who: a.actor?.name || a.actor?.email || 'System', action: '—', target: summary,
      time: rel(a.createdAt), tone: 'neutral' as Tone,
      href: app === 'metricbase' ? '/finance' : app === 'fieldflow' ? '/field' : '/projects',
    }
  })

  const tasks: HomeData['tasks'] = assignedTasks.map((t) => {
    const d = due(t.dueDate)
    return { app: 'probase' as AppId, title: t.title, due: d.label, tone: d.tone, href: `/projects/${t.projectId}` }
  })

  const pinned: HomeData['pinned'] = apps.map((a) => ({ app: a.id, label: `${APP_LABEL[a.id]} overview`, kind: a.sub, href: a.href }))

  const displayName = user.name || (user.email
    ? user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'there')

  const data: HomeData = {
    userName: displayName,
    orgName: activeOrg.name,
    apps, kpis, activity, tasks, pinned,
    attention: assignedTasks.length + unreadNotifs,
  }

  return <HomeView data={data} />
}
