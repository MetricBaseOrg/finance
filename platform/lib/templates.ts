import { prisma } from '@/lib/prisma'
import { generateSlug } from '@/lib/utils'

/**
 * Template content schemas. Stored JSON-encoded in Template.content.
 * We capture label NAMES (not ids) so a template stays portable across
 * projects — labels are re-resolved or created at apply time.
 */

export interface TaskTemplateContent {
  title: string
  description?: string | null
  priority?: string
  labels?: string[]            // label names
  recurrence?: string | null
  subtasks?: Array<{ title: string; priority?: string }>
}

export interface ProjectTemplateContent {
  name: string
  description?: string | null
  color?: string
  labels?: string[]            // workspace/project label names to seed
  milestones?: Array<{ name: string; description?: string | null }>
  tasks?: Array<{
    title: string
    description?: string | null
    priority?: string
    labels?: string[]
    subtasks?: Array<{ title: string; priority?: string }>
  }>
}

export type TemplateKind = 'TASK' | 'PROJECT'
export function isTemplateKind(s: unknown): s is TemplateKind {
  return s === 'TASK' || s === 'PROJECT'
}

// ── Capture: build template content from existing entities ───────────────────

/** Serialize a task (+ its subtasks + labels) into TaskTemplateContent. */
export async function captureTaskTemplate(taskId: string): Promise<TaskTemplateContent | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      labels: { select: { name: true } },
      subTasks: { select: { title: true, priority: true }, orderBy: { order: 'asc' } },
    },
  })
  if (!task) return null
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    recurrence: task.recurrence,
    labels: task.labels.map(l => l.name),
    subtasks: task.subTasks.map(s => ({ title: s.title, priority: s.priority })),
  }
}

/** Serialize a project (+ parent tasks, their subtasks, milestones, labels). */
export async function captureProjectTemplate(projectId: string): Promise<ProjectTemplateContent | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      labels: { select: { name: true } },
      milestones: { select: { name: true, description: true }, orderBy: { dueDate: 'asc' } },
      tasks: {
        where: { parentId: null },
        orderBy: { order: 'asc' },
        include: {
          labels: { select: { name: true } },
          subTasks: { select: { title: true, priority: true }, orderBy: { order: 'asc' } },
        },
      },
    },
  })
  if (!project) return null
  return {
    name: project.name,
    description: project.description,
    color: project.color,
    labels: project.labels.map(l => l.name),
    milestones: project.milestones.map(m => ({ name: m.name, description: m.description })),
    tasks: project.tasks.map(t => ({
      title: t.title,
      description: t.description,
      priority: t.priority,
      labels: t.labels.map(l => l.name),
      subtasks: t.subTasks.map(s => ({ title: s.title, priority: s.priority })),
    })),
  }
}

// ── Apply: instantiate a template ────────────────────────────────────────────

/** Resolve label names to ids within a project, creating any that don't exist. */
async function ensureLabels(projectId: string, names: string[]): Promise<string[]> {
  if (names.length === 0) return []
  const existing = await prisma.label.findMany({
    where: { projectId, name: { in: names } },
    select: { id: true, name: true },
  })
  const byName = new Map(existing.map(l => [l.name, l.id]))
  const ids: string[] = []
  for (const name of names) {
    let id = byName.get(name)
    if (!id) {
      const created = await prisma.label.create({ data: { name, projectId } })
      id = created.id
      byName.set(name, id)
    }
    ids.push(id)
  }
  return ids
}

async function nextOrder(projectId: string): Promise<number> {
  const last = await prisma.task.findFirst({
    where: { projectId, status: 'TODO' },
    orderBy: { order: 'desc' },
    select: { order: true },
  })
  return (last?.order ?? 0) + 1000
}

/**
 * Apply a TASK template into a project: creates the parent task + subtasks.
 * Returns the created parent task (with the fields the client needs).
 */
export async function applyTaskTemplate(opts: {
  content: TaskTemplateContent
  projectId: string
  creatorId: string
}) {
  const { content, projectId, creatorId } = opts
  const labelIds = await ensureLabels(projectId, content.labels ?? [])
  const order = await nextOrder(projectId)

  const parent = await prisma.task.create({
    data: {
      title: content.title,
      description: content.description ?? undefined,
      status: 'TODO',
      priority: content.priority || 'MEDIUM',
      projectId,
      creatorId,
      order,
      ...(content.recurrence && { recurrence: content.recurrence }),
      ...(labelIds.length > 0 && { labels: { connect: labelIds.map(id => ({ id })) } }),
    },
    include: {
      assignee: { select: { id: true, name: true, email: true, image: true } },
      labels: true,
      _count: { select: { comments: true, subTasks: true } },
    },
  })

  // Subtasks
  let subOrder = 1000
  for (const sub of content.subtasks ?? []) {
    await prisma.task.create({
      data: {
        title: sub.title,
        status: 'TODO',
        priority: sub.priority || 'MEDIUM',
        projectId,
        creatorId,
        parentId: parent.id,
        order: subOrder,
      },
    })
    subOrder += 1000
  }

  return parent
}

/**
 * Apply a PROJECT template into a workspace: creates a new project with all
 * its tasks, subtasks, milestones, and labels. Returns the new project id.
 */
export async function applyProjectTemplate(opts: {
  content: ProjectTemplateContent
  organizationId: string
  creatorId: string
  nameOverride?: string
}) {
  const { content, organizationId, creatorId } = opts
  const name = (opts.nameOverride || content.name || 'Untitled Project').trim()

  const project = await prisma.project.create({
    data: {
      name,
      description: content.description ?? undefined,
      color: content.color || '#6366f1',
      organizationId,
    },
  })

  // Seed project-level labels
  await ensureLabels(project.id, content.labels ?? [])

  // Milestones
  for (const m of content.milestones ?? []) {
    await prisma.milestone.create({
      data: { name: m.name, description: m.description ?? undefined, projectId: project.id },
    })
  }

  // Tasks + subtasks
  let order = 1000
  for (const t of content.tasks ?? []) {
    const labelIds = await ensureLabels(project.id, t.labels ?? [])
    const parent = await prisma.task.create({
      data: {
        title: t.title,
        description: t.description ?? undefined,
        status: 'TODO',
        priority: t.priority || 'MEDIUM',
        projectId: project.id,
        creatorId,
        order,
        ...(labelIds.length > 0 && { labels: { connect: labelIds.map(id => ({ id })) } }),
      },
    })
    order += 1000

    let subOrder = 1000
    for (const sub of t.subtasks ?? []) {
      await prisma.task.create({
        data: {
          title: sub.title,
          status: 'TODO',
          priority: sub.priority || 'MEDIUM',
          projectId: project.id,
          creatorId,
          parentId: parent.id,
          order: subOrder,
        },
      })
      subOrder += 1000
    }
  }

  return project
}
