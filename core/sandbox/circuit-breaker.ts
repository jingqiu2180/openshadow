/**
 * CircuitBreaker: halts execution after repeated failures.
 *
 * States:
 *   CLOSED  -> normal operation, counts failures
 *   OPEN    -> blocked, trips after threshold failures in window
 *   HALF    -> grace period, allows one test request
 */

export type CircuitState = 'closed' | 'open' | 'half'

export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number
  /** Time window in ms for counting failures */
  windowMs: number
  /** How long circuit stays open before half-open (ms) */
  resetTimeoutMs: number
  /** Success count needed to close from half-open */
  successThreshold: number
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  windowMs: 60_000,      // 1 minute
  resetTimeoutMs: 30_000, // 30 seconds
  successThreshold: 2,
}

export class CircuitBreaker {
  private readonly config: Required<CircuitBreakerConfig>
  private failures: number[] = []
  private state: CircuitState = 'closed'
  private halfOpenSuccesses = 0
  private openedAt: number | null = null

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<CircuitBreakerConfig>
  }

  /**
   * Check if execution is currently allowed.
   */
  canExecute(): boolean {
    if (this.state === 'closed') return true

    if (this.state === 'open') {
      const elapsed = Date.now() - (this.openedAt ?? 0)
      if (elapsed >= this.config.resetTimeoutMs) {
        this.state = 'half'
        this.halfOpenSuccesses = 0
        return true // one test request allowed
      }
      return false
    }

    if (this.state === 'half') {
      return this.halfOpenSuccesses < this.config.successThreshold
    }

    return false
  }

  /**
   * Record a successful execution.
   */
  recordSuccess(): void {
    if (this.state === 'half') {
      this.halfOpenSuccesses++
      if (this.halfOpenSuccesses >= this.config.successThreshold) {
        this.state = 'closed'
        this.failures = []
      }
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failures = []
    }
  }

  /**
   * Record a failed execution.
   */
  recordFailure(): void {
    const now = Date.now()

    if (this.state === 'half') {
      // Any failure in half-open state trips immediately
      this.trip(now)
      return
    }

    // Prune old failures outside the window
    const windowStart = now - this.config.windowMs
    this.failures = this.failures.filter(t => t > windowStart)
    this.failures.push(now)

    if (this.failures.length >= this.config.failureThreshold) {
      this.trip(now)
    }
  }

  private trip(now: number): void {
    this.state = 'open'
    this.openedAt = now
    this.failures = []
  }

  /**
   * Manually reset the circuit breaker.
   */
  reset(): void {
    this.state = 'closed'
    this.failures = []
    this.halfOpenSuccesses = 0
    this.openedAt = null
  }

  getState(): CircuitState {
    return this.state
  }

  getFailureCount(): number {
    return this.failures.length
  }
}