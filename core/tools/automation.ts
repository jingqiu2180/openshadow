// @ts-nocheck
import { createToolSpec } from '../tool-registry'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

interface Automation {
  id: string
  name: string
  description: string
  schedule: string
  task: string
  enabled: boolean
  createdAt: string
}

const AUTOMATIONS_FILE = join(process.cwd(), 'data', 'automations.json')

function loadAutomations(): Automation[] {
  try {
    if (!existsSync(AUTOMATIONS_FILE)) return []
    return JSON.parse(readFileSync(AUTOMATIONS_FILE, 'utf8'))
  } catch {
    return []
  }
}

function saveAutomations(list: Automation[]): void {
  writeFileSync(AUTOMATIONS_FILE, JSON.stringify(list, null, 2), 'utf8')
}

function nextId(list: Automation[]): string {
  const maxId = list.reduce((max, a) => {
    const num = parseInt(a.id.replace('auto-', ''), 10)
    return isNaN(num) ? max : Math.max(max, num)
  }, 0)
  return `auto-${maxId + 1}`
}

export function registerAutomationTool(registry: any): void {
  registry.register('automation', createToolSpec('automation', {
    description: 'Manage scheduled automations. Create, list, enable, disable, or delete automations that run periodically.',
    params: {
      action: {
        type: 'string',
        enum: ['list', 'create', 'delete', 'enable', 'disable', 'run'],
        description: 'Action: list all, create new, delete, enable, disable, or manually run an automation',
      },
      name: { type: 'string', description: 'Automation name (for create)', optional: true },
      description: { type: 'string', description: 'What the automation does (for create)', optional: true },
      schedule: {
        type: 'string',
        description: 'Schedule: "every_Nm" (minutes), "daily_HH:MM", "once_YYYY-MM-DDTHH:MM" (for create)',
        optional: true,
      },
      task: { type: 'string', description: 'Task description for the agent to execute (for create)', optional: true },
      id: { type: 'string', description: 'Automation ID (for delete/enable/disable/run)', optional: true },
    },
  }), async (args: {
    action: string
    name?: string
    description?: string
    schedule?: string
    task?: string
    id?: string
  }) => {
    const list = loadAutomations()

    switch (args.action) {
      case 'list': {
        if (list.length === 0) {
          return { content: [{ type: 'text', text: 'No automations configured.' }] }
        }
        const lines = list.map(a =>
          `${a.id} [${a.enabled ? 'ON' : 'OFF'}] ${a.name} — ${a.schedule}\n    ${a.description}`
        )
        return { content: [{ type: 'text', text: lines.join('\n') }] }
      }

      case 'create': {
        if (!args.name || !args.task) {
          return { content: [{ type: 'text', text: 'name and task are required for create.' }] }
        }
        const newAuto: Automation = {
          id: nextId(list),
          name: args.name,
          description: args.description || args.task,
          schedule: args.schedule || 'manual',
          task: args.task,
          enabled: true,
          createdAt: new Date().toISOString(),
        }
        list.push(newAuto)
        saveAutomations(list)
        return {
          content: [{ type: 'text', text: `Created automation ${newAuto.id}: ${newAuto.name}\nSchedule: ${newAuto.schedule}\nTask: ${newAuto.task}` }],
          details: { automation: newAuto },
        }
      }

      case 'delete': {
        if (!args.id) return { content: [{ type: 'text', text: 'id is required for delete.' }] }
        const delIdx = list.findIndex(a => a.id === args.id)
        if (delIdx === -1) return { content: [{ type: 'text', text: `Automation not found: ${args.id}` }] }
        const deleted = list.splice(delIdx, 1)[0]
        saveAutomations(list)
        return { content: [{ type: 'text', text: `Deleted automation: ${deleted.name}` }] }
      }

      case 'enable':
      case 'disable': {
        if (!args.id) return { content: [{ type: 'text', text: 'id is required.' }] }
        const auto = list.find(a => a.id === args.id)
        if (!auto) return { content: [{ type: 'text', text: `Automation not found: ${args.id}` }] }
        auto.enabled = args.action === 'enable'
        saveAutomations(list)
        return { content: [{ type: 'text', text: `Automation ${auto.id} is now ${auto.enabled ? 'enabled' : 'disabled'}.` }] }
      }

      case 'run': {
        if (!args.id) return { content: [{ type: 'text', text: 'id is required for run.' }] }
        const runAuto = list.find(a => a.id === args.id)
        if (!runAuto) return { content: [{ type: 'text', text: `Automation not found: ${args.id}` }] }
        return {
          content: [{ type: 'text', text: `Running automation ${runAuto.id}: ${runAuto.name}\nTask: ${runAuto.task}\n\n(Note: automation execution is queued. Results will appear in a follow-up message.)` }],
          details: { runRequested: runAuto.id, task: runAuto.task },
        }
      }

      default:
        return { content: [{ type: 'text', text: `Unknown action: ${args.action}` }] }
    }
  })
}
