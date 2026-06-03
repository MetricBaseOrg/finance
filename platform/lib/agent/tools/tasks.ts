import { prisma } from '@/lib/prisma'
import { can } from '@/lib/permissions'
import { logActivity, notify } from '@/lib/activity'
import { isValidRecurrence } from '@/lib/recurrence'
import { updateTask, TaskUpdateError } from '@/lib/tasks/update'
import { createComment } from '@/lib/comments/create'
import { breakdownTask, summarizeComments } from '@/lib/ai'
import type { AgentTool, ToolContext } from '@/lib/agent/types'

/** Confirm a task belongs to the agent's organization (tenant isolation). */
async function taskInOrg(taskId: string, organizationId: string): Promise<boolean> {
  const t = await prisma.task.findUnique({
    where: { id: taskId },
    select: { project: { select: { organizationId: true } } },
  })
  return t?.project.organizationId === organizationId
}

const getTask: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'get_task',
    description: 'Fetch full detail for one task: status, priority, assignee, description, and its comment thread. Use this to understand a task before acting on it.',
    input_schema: {
      type: 'object',
      properties: { taskId: { type: 'string', description: 'The task id.' } },
      required: ['taskId'],
    },
  },
  async execute(ctx: ToolContext, input: { taskId: string }) {
    if (!(await taskInOrg(input.taskId, ctx.organizationId))) return { error: 'Task not found in this workspace.' }
    const t = await prisma.task.findUnique({
      where: { id: input.taskId },
      include: {
        assignee: { select: { name: true, email: true } },
        project: { select: { id: true, name: true } },
        comments: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
          take: 50,
        },
        subTasks: { select: { id: true, title: true, status: true } },
        blockedBy: { include: { blocker: { select: { id: true, title: true, status: true } } } },
        blocking:  { include: { blocked: { select: { id: true, title: true, status: true } } } },
      },
    })
    if (!t) return { error: 'Task not found.' }
    return {
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      startDate: t.startDate,
      dueDate: t.dueDate,
      project: t.project,
      assignee: t.assignee?.name ?? t.assignee?.email ?? null,
      subTasks: t.subTasks,
      blockedBy: t.blockedBy.map(d => ({ id: d.id, blocker: d.blocker })),
      blocking:  t.blocking.map(d => ({ id: d.id, blocked: d.blocked })),
      comments: t.comments.map(c => ({
        author: c.user.name ?? c.user.email,
        createdAt: c.createdAt.toISOString(),
        content: c.content,
      })),
    }
  },
}

const searchTasks: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'search_tasks',
    description: 'List tasks in the workspace, optionally filtered. Use for questions like "what is overdue" or "what is assigned to me".',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Substring to match in the title (optional).' },
        status: { type: 'string', description: 'Filter by status: TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED, BACKLOG.' },
        projectId: { type: 'string', description: 'Restrict to one project (optional).' },
        assignedToMe: { type: 'boolean', description: 'Only tasks assigned to me, the agent.' },
        overdue: { type: 'boolean', description: 'Only tasks with a dueDate before now and not DONE/CANCELLED.' },
        limit: { type: 'number', description: 'Max results (default 25, max 100).' },
      },
    },
  },
  async execute(ctx: ToolContext, input: {
    query?: string; status?: string; projectId?: string; assignedToMe?: boolean; overdue?: boolean; limit?: number
  }) {
    const where: Record<string, unknown> = { project: { organizationId: ctx.organizationId } }
    if (input.projectId) where.projectId = input.projectId
    if (input.query) where.title = { contains: input.query, mode: 'insensitive' }
    if (input.status) where.status = input.status
    if (input.assignedToMe) where.assigneeId = ctx.agentUserId
    if (input.overdue) {
      where.dueDate = { lt: new Date() }
      where.status = { notIn: ['DONE', 'CANCELLED'] }
    }
    const limit = Math.min(Math.max(input.limit ?? 25, 1), 100)
    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true, title: true, status: true, priority: true, dueDate: true,
        assignee: { select: { name: true, email: true } },
        project: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })
    return {
      count: tasks.length,
      tasks: tasks.map(t => ({
        id: t.id, title: t.title, status: t.status, priority: t.priority,
        dueDate: t.dueDate, project: t.project.name,
        assignee: t.assignee?.name ?? t.assignee?.email ?? null,
      })),
    }
  },
}

const listProjects: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'list_projects',
    description: 'List the projects in the workspace (id + name). Use to find a projectId before creating a task.',
    input_schema: { type: 'object', properties: {} },
  },
  async execute(ctx: ToolContext) {
    const projects = await prisma.project.findMany({
      where: { organizationId: ctx.organizationId },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    })
    return { projects }
  },
}

const updateTaskTool: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'update_task',
    description: 'Change a task: status, priority, assignee, title, description, start date, due date, or labels. Subject to the same rules a human of your role faces (e.g. blockers must be clear to mark DONE).',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        status: { type: 'string', description: 'TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED, BACKLOG.' },
        priority: { type: 'string', description: 'LOW, MEDIUM, HIGH, URGENT.' },
        assigneeId: { type: 'string', description: 'User id to assign to, or null to unassign.' },
        title: { type: 'string' },
        description: { type: 'string' },
        startDate: { type: 'string', description: 'ISO datetime string for when the task starts, or null to clear.' },
        dueDate: { type: 'string', description: 'ISO datetime string for the deadline, or null to clear.' },
      },
      required: ['taskId'],
    },
  },
  async execute(ctx: ToolContext, input: Record<string, unknown> & { taskId: string }) {
    if (!can(ctx.agentRole, 'task.update')) return { error: 'Your role does not permit updating tasks.' }
    if (!(await taskInOrg(input.taskId, ctx.organizationId))) return { error: 'Task not found in this workspace.' }
    const { taskId, ...data } = input
    try {
      const { task } = await updateTask({ taskId, actorUserId: ctx.agentUserId, role: ctx.agentRole, isAgent: true, data })
      return { ok: true, task: { id: task.id, title: task.title, status: task.status, priority: task.priority } }
    } catch (err) {
      if (err instanceof TaskUpdateError) return { error: err.code, message: err.message, ...(err.payload ?? {}) }
      throw err
    }
  },
}

const createTask: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'create_task',
    description: 'Create a new task (optionally a subtask of another). Call list_projects first if you do not know the projectId.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', description: 'LOW, MEDIUM, HIGH, URGENT (default MEDIUM).' },
        assigneeId: { type: 'string', description: 'User id to assign to (optional).' },
        startDate: { type: 'string', description: 'ISO datetime string for when the task starts (optional).' },
        dueDate: { type: 'string', description: 'ISO datetime string for the deadline (optional).' },
        parentId: { type: 'string', description: 'Parent task id to create this as a subtask (optional).' },
      },
      required: ['projectId', 'title'],
    },
  },
  async execute(ctx: ToolContext, input: {
    projectId: string; title: string; description?: string; priority?: string;
    assigneeId?: string; startDate?: string; dueDate?: string; parentId?: string
  }) {
    if (!can(ctx.agentRole, 'task.create')) return { error: 'Your role does not permit creating tasks.' }
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { organizationId: true },
    })
    if (project?.organizationId !== ctx.organizationId) return { error: 'Project not found in this workspace.' }

    // Subtasks inherit the parent's assignee when none is given.
    let effectiveAssigneeId: string | null = input.assigneeId ?? null
    if (input.parentId && !effectiveAssigneeId) {
      const parent = await prisma.task.findFirst({
        where: { id: input.parentId, projectId: input.projectId },
        select: { assigneeId: true },
      })
      if (parent?.assigneeId) effectiveAssigneeId = parent.assigneeId
    }

    const lastTask = await prisma.task.findFirst({
      where: { projectId: input.projectId, status: 'TODO' },
      orderBy: { order: 'desc' },
      select: { order: true },
    })
    const task = await prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: 'TODO',
        priority: input.priority || 'MEDIUM',
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        projectId: input.projectId,
        creatorId: ctx.agentUserId,
        assigneeId: effectiveAssigneeId,
        parentId: input.parentId,
        order: (lastTask?.order ?? 0) + 1000,
      },
      select: { id: true, title: true },
    })
    await logActivity({ taskId: task.id, userId: ctx.agentUserId, kind: 'task.created' })
    if (input.parentId) {
      await logActivity({
        taskId: input.parentId,
        userId: ctx.agentUserId,
        kind: 'subtask.added',
        metadata: { subtaskId: task.id, title: task.title },
      })
    }
    if (input.assigneeId && input.assigneeId !== ctx.agentUserId) {
      await notify({
        userIds: [input.assigneeId],
        kind: 'task.assigned',
        actorId: ctx.agentUserId,
        taskId: task.id,
        metadata: { title: task.title },
      })
    }
    return { ok: true, taskId: task.id }
  },
}

const postComment: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'post_comment',
    description: 'Post a comment on a task. Use this to reply, report what you did, ask a question, or @mention a teammate (e.g. "@arief"). This is how you communicate on a task.',
    input_schema: {
      type: 'object',
      properties: {
        taskId: { type: 'string' },
        content: { type: 'string', description: 'Markdown comment body.' },
      },
      required: ['taskId', 'content'],
    },
  },
  async execute(ctx: ToolContext, input: { taskId: string; content: string }) {
    if (!can(ctx.agentRole, 'comment.create')) return { error: 'Your role does not permit commenting.' }
    if (!(await taskInOrg(input.taskId, ctx.organizationId))) return { error: 'Task not found in this workspace.' }
    const comment = await createComment({ taskId: input.taskId, actorUserId: ctx.agentUserId, content: input.content })
    return { ok: true, commentId: comment.id }
  },
}

const breakDownTaskTool: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'break_down_task',
    description: 'Get suggested subtask titles for a task description. Returns suggestions only — use create_task to actually create them.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
      },
      required: ['title'],
    },
  },
  async execute(ctx: ToolContext, input: { title: string; description?: string }) {
    const { subtasks } = await breakdownTask({ title: input.title, description: input.description, organizationId: ctx.organizationId })
    return { subtasks }
  },
}

const summarizeThread: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'summarize_thread',
    description: 'Summarize a task\'s comment thread into TL;DR, open questions, and decisions.',
    input_schema: {
      type: 'object',
      properties: { taskId: { type: 'string' } },
      required: ['taskId'],
    },
  },
  async execute(ctx: ToolContext, input: { taskId: string }) {
    if (!(await taskInOrg(input.taskId, ctx.organizationId))) return { error: 'Task not found in this workspace.' }
    const task = await prisma.task.findUnique({
      where: { id: input.taskId },
      select: {
        title: true,
        comments: {
          include: { user: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
          take: 200,
        },
      },
    })
    if (!task) return { error: 'Task not found.' }
    if (task.comments.length < 2) return { tldr: [], openQuestions: [], decisions: [], note: 'Not enough comments to summarize.' }
    return summarizeComments({
      taskTitle: task.title,
      comments: task.comments.map(c => ({
        author: c.user.name ?? c.user.email ?? 'Unknown',
        createdAt: c.createdAt.toISOString(),
        content: c.content,
      })),
      organizationId: ctx.organizationId,
    })
  },
}

const addDependency: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'add_dependency',
    description: 'Mark that one task must finish before another can start. blockerTaskId is the prerequisite; blockedTaskId is the task that depends on it. Works for both tasks and subtasks.',
    input_schema: {
      type: 'object',
      properties: {
        blockerTaskId: { type: 'string', description: 'The task that must finish first (the blocker).' },
        blockedTaskId: { type: 'string', description: 'The task that is waiting on the blocker.' },
      },
      required: ['blockerTaskId', 'blockedTaskId'],
    },
  },
  async execute(ctx: ToolContext, input: { blockerTaskId: string; blockedTaskId: string }) {
    if (!can(ctx.agentRole, 'dependency.manage')) return { error: 'Your role does not permit managing dependencies.' }
    if (input.blockerTaskId === input.blockedTaskId) return { error: 'A task cannot depend on itself.' }
    if (!(await taskInOrg(input.blockerTaskId, ctx.organizationId))) return { error: 'Blocker task not found in this workspace.' }
    if (!(await taskInOrg(input.blockedTaskId, ctx.organizationId))) return { error: 'Blocked task not found in this workspace.' }

    // Reject direct cycle: does blocked already block the blocker?
    const cycle = await prisma.taskDependency.findFirst({
      where: { blockerId: input.blockedTaskId, blockedId: input.blockerTaskId },
      select: { id: true },
    })
    if (cycle) return { error: 'That would create a cycle — the blocked task already blocks the blocker.' }

    try {
      const dep = await prisma.taskDependency.create({
        data: { blockerId: input.blockerTaskId, blockedId: input.blockedTaskId },
        include: {
          blocker: { select: { id: true, title: true } },
          blocked: { select: { id: true, title: true } },
        },
      })
      void logActivity({ taskId: input.blockedTaskId, userId: ctx.agentUserId, kind: 'comment.added',
        metadata: { preview: `now blocked by "${dep.blocker.title}"`, depId: dep.id } as never })
      void logActivity({ taskId: input.blockerTaskId, userId: ctx.agentUserId, kind: 'comment.added',
        metadata: { preview: `now blocks "${dep.blocked.title}"`, depId: dep.id } as never })
      return { ok: true, depId: dep.id, blocker: dep.blocker.title, blocked: dep.blocked.title }
    } catch (err) {
      if ((err as { code?: string })?.code === 'P2002') return { error: 'Dependency already exists.' }
      throw err
    }
  },
}

const removeDependency: AgentTool = {
  scope: 'tasks',
  definition: {
    name: 'remove_dependency',
    description: 'Remove a dependency between two tasks. Use the blockerTaskId and blockedTaskId (the same pair you used to create it), or the depId returned by get_task.',
    input_schema: {
      type: 'object',
      properties: {
        blockerTaskId: { type: 'string', description: 'The blocker task id.' },
        blockedTaskId: { type: 'string', description: 'The blocked task id.' },
      },
      required: ['blockerTaskId', 'blockedTaskId'],
    },
  },
  async execute(ctx: ToolContext, input: { blockerTaskId: string; blockedTaskId: string }) {
    if (!can(ctx.agentRole, 'dependency.manage')) return { error: 'Your role does not permit managing dependencies.' }
    if (!(await taskInOrg(input.blockerTaskId, ctx.organizationId))) return { error: 'Blocker task not found in this workspace.' }

    const dep = await prisma.taskDependency.findFirst({
      where: { blockerId: input.blockerTaskId, blockedId: input.blockedTaskId },
      select: { id: true },
    })
    if (!dep) return { error: 'Dependency not found.' }

    await prisma.taskDependency.delete({ where: { id: dep.id } })
    return { ok: true }
  },
}

export const taskTools: AgentTool[] = [
  getTask, searchTasks, listProjects, updateTaskTool, createTask, postComment,
  breakDownTaskTool, summarizeThread, addDependency, removeDependency,
]
