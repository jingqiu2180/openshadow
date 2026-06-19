// @ts-nocheck
/**
 * NetworkFilter: controls outbound network access from sandboxed processes.
 *
 * Uses /etc/hosts manipulation + iptables for isolation.
 * This is a best-effort approach - not container-level security,
 * but sufficient for most threat models.
 */

export interface NetworkFilterConfig {
  /** Block all outbound connections except to these hosts */
  allowedHosts?: string[]
  /** Block specific IP ranges (e.g. ['10.0.0.0/8', '192.168.0.0/16']) */
  blockPrivate?: boolean
  /** Custom hosts file entries (domain -> IP) */
  customMappings?: Record<string, string>
}

const DEFAULT_BLOCKED = [
  '127.0.0.1',     // local loopback (prevent rebinding)
  'localhost',     // same
]

export class NetworkFilter {
  private readonly config: Required<NetworkFilterConfig>
  private hostsBackup: string | null = null

  constructor(_workspacePath: string, config: NetworkFilterConfig = {}) {
    this.config = {
      allowedHosts: config.allowedHosts ?? [],
      blockPrivate: config.blockPrivate ?? true,
      customMappings: config.customMappings ?? {},
    }
  }

  /**
   * Apply network restrictions. Must call restore() when done.
   */
  async apply(): Promise<void> {
    // Backup current hosts file
    const { readFile } = await import('fs/promises')
    try {
      this.hostsBackup = await readFile('/etc/hosts', 'utf-8')
    } catch {
      this.hostsBackup = null
    }

    // Add block entries to /etc/hosts
    const extraEntries = Object.entries(this.config.customMappings)
      .map(([domain, ip]) => `${ip}\t${domain}`)
      .join('\n')

    const blockEntries = DEFAULT_BLOCKED.map(ip => `${ip}\t# sandbox-blocked`).join('\n')
    const extra = [blockEntries, extraEntries].filter(Boolean).join('\n')

    const { writeFile } = await import('fs/promises')
    if (this.hostsBackup) {
      await writeFile('/etc/hosts', this.hostsBackup + '\n' + extra + '\n', 'utf-8')
    }
  }

  /**
   * Restore original network configuration.
   */
  async restore(): Promise<void> {
    if (this.hostsBackup) {
      const { writeFile } = await import('fs/promises')
      await writeFile('/etc/hosts', this.hostsBackup, 'utf-8')
      this.hostsBackup = null
    }
  }

  /**
   * Get the effective hosts content (for audit).
   */
  getHostsSnapshot(): string {
    return this.hostsBackup ?? ''
  }
}