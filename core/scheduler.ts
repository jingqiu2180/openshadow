// @ts-nocheck
import cron, { ScheduledTask } from 'node-cron'
import { getCronJobs, updateCronJobLastRun } from './memory/store.js'

export type TaskHandler = () => Promise<void> | void

/**
 * Simple scheduler for cron jobs and heartbeat tasks.
 */
export class Scheduler {
  private tasks: Map<string, ScheduledTask> = new Map()
  private heartbeatInterval: NodeJS.Timeout | null = null

  /**
   * Start all cron jobs for an agent.
   */
  startCronJobs(agentId: string, handler: TaskHandler): void {
    const jobs = getCronJobs(agentId)

    for (const job of jobs) {
      if (!cron.validate(job.schedule)) {
        console.warn(`[scheduler] Invalid cron schedule: ${job.schedule}`)
        continue
      }

      const task = cron.schedule(job.schedule, async () => {
        console.log(`[scheduler] Running job ${job.id}`)
        try {
          await handler()
          updateCronJobLastRun(job.id)
        } catch (e: any) {
          console.error(`[scheduler] Job ${job.id} failed:`, e.message)
        }
      })

      this.tasks.set(job.id, task)
      console.log(`[scheduler] Started job ${job.id} (${job.schedule})`)
    }
  }

  /**
   * Start heartbeat - periodic health checks.
   * @param intervalMs - interval in milliseconds (default 5 min)
   * @param handler - task to run
   */
  startHeartbeat(intervalMs: number, handler: TaskHandler): void {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await handler()
      } catch (e: any) {
        console.error(`[heartbeat] Error:`, e.message)
      }
    }, intervalMs)

    console.log(`[heartbeat] Started (every ${intervalMs}ms)`)
  }

  /**
   * Stop all tasks.
   */
  stop(): void {
    for (const [id, task] of this.tasks) {
      task.stop()
      console.log(`[scheduler] Stopped job ${id}`)
    }
    this.tasks.clear()

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
      console.log('[heartbeat] Stopped')
    }
  }
}

/**
 * Create a default scheduler.
 */
export function createScheduler(): Scheduler {
  return new Scheduler()
}