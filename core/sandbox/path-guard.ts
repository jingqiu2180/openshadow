// @ts-nocheck
/**
 * path-guard.ts — 路径权限校验
 *
 * 定义四种访问级别：BLOCKED / READ_ONLY / READ_WRITE / FULL
 * 所有路径先经过 realpath 解析符号链接，再匹配区域。
 *
 * 常量从 policy.ts 导入（单一来源）。
 */

import fs from 'fs'
import path from 'path';
import {
  BLOCKED_FILES,
  BLOCKED_DIRS,
  READ_ONLY_AGENT_FILES,
  READ_ONLY_AGENT_DIRS,
  READ_ONLY_HOME_DIRS,
  READ_WRITE_AGENT_DIRS,
  READ_WRITE_AGENT_FILES,
  READ_WRITE_HOME_DIRS,
} from './policy';

export const AccessLevel = {
  BLOCKED: 'blocked',
  READ_ONLY: 'read_only',
  READ_WRITE: 'read_write',
  FULL: 'full',
};

/** 操作 → 所需最低级别 */
const OP_REQUIREMENTS: Record<string, Set<string>> = {
  read: new Set([AccessLevel.READ_ONLY, AccessLevel.READ_WRITE, AccessLevel.FULL]),
  write: new Set([AccessLevel.READ_WRITE, AccessLevel.FULL]),
  delete: new Set([AccessLevel.FULL]),
};

export class PathGuard {
  private _fullAccess: boolean = false;
  private hanakoHome!: string;
  private agentDir!: string;
  private workspaceRoots: string[] = [];
  private policyWritablePaths: string[] = [];
  private allowExternalReads: boolean = false;

  constructor(policy: Record<string, any>) {
    if (policy.mode === 'full-access') {
      this._fullAccess = true;
      return;
    }
    this._fullAccess = false;
    this.hanakoHome = this._resolveReal(policy.hanakoHome) || path.resolve(policy.hanakoHome);
    this.agentDir = this._resolveReal(policy.agentDir) || path.resolve(policy.agentDir);
    const roots = (Array.isArray(policy.workspaceRoots) && policy.workspaceRoots.length > 0)
      ? policy.workspaceRoots
      : [policy.workspace].filter(Boolean);
    this.workspaceRoots = roots.map((root: string) => this._resolveReal(root) || path.resolve(root));
    this.policyWritablePaths = (policy.writablePaths || [])
      .map((root: string) => this._resolveReal(root) || path.resolve(root));
    this.allowExternalReads = policy.allowExternalReads === true;
  }

  /**
   * 解析路径（跟踪符号链接）。
   * 文件不存在时递归往上找到最近的存在的祖先目录，
   * 对它做 realpath，然后把不存在的段拼回去。
   */
  private _resolveReal(p: string): string | null {
    const abs = path.resolve(p);
    try {
      return fs.realpathSync(abs);
    } catch (err: any) {
      if (err.code !== 'ENOENT') return null;

      const pending: string[] = [];
      let current = abs;
      while (true) {
        const parent = path.dirname(current);
        if (parent === current) return null; // 到根目录还找不到
        pending.push(path.basename(current));
        try {
          const realParent = fs.realpathSync(parent);
          pending.reverse();
          return path.join(realParent, ...pending);
        } catch (e: any) {
          if (e.code !== 'ENOENT') return null;
          current = parent;
        }
      }
    }
  }

  /** 判断 target 是否在 base 内部（含相等） */
  private _isInside(target: string, base: string): boolean {
    return target === base || target.startsWith(base + path.sep);
  }

  /**
   * 获取路径的访问级别
   * @param rawPath 绝对路径
   * @returns AccessLevel
   */
  getAccessLevel(rawPath: string): string {
    const resolved = this._resolveReal(rawPath);
    if (!resolved) return AccessLevel.BLOCKED;

    // 1. BLOCKED 文件（hanakoHome 根）
    for (const f of BLOCKED_FILES) {
      if (resolved === path.join(this.hanakoHome, f)) return AccessLevel.BLOCKED;
    }

    // 2. BLOCKED 目录
    for (const d of BLOCKED_DIRS) {
      if (this._isInside(resolved, path.join(this.hanakoHome, d))) {
        return AccessLevel.BLOCKED;
      }
    }

    // 3. READ_ONLY agent 文件
    for (const f of READ_ONLY_AGENT_FILES) {
      if (resolved === path.join(this.agentDir, f)) return AccessLevel.READ_ONLY;
    }

    // 4. READ_ONLY agent 目录
    for (const d of READ_ONLY_AGENT_DIRS) {
      if (this._isInside(resolved, path.join(this.agentDir, d))) {
        return AccessLevel.READ_ONLY;
      }
    }

    // 5. READ_ONLY 全局目录
    for (const d of READ_ONLY_HOME_DIRS) {
      if (this._isInside(resolved, path.join(this.hanakoHome, d))) {
        return AccessLevel.READ_ONLY;
      }
    }

    // 6. READ_WRITE agent 目录
    for (const d of READ_WRITE_AGENT_DIRS) {
      if (this._isInside(resolved, path.join(this.agentDir, d))) {
        return AccessLevel.READ_WRITE;
      }
    }

    // 6. READ_WRITE agent 文件
    for (const f of READ_WRITE_AGENT_FILES) {
      if (resolved === path.join(this.agentDir, f)) return AccessLevel.READ_WRITE;
    }

    // 7. READ_WRITE 全局目录
    for (const d of READ_WRITE_HOME_DIRS) {
      if (this._isInside(resolved, path.join(this.hanakoHome, d))) {
        return AccessLevel.READ_WRITE;
      }
    }

    // 8. hanakoHome 内未匹配 → 遵守 read-all 契约
    if (this._isInside(resolved, this.hanakoHome)) {
      return this.allowExternalReads ? AccessLevel.READ_ONLY : AccessLevel.BLOCKED;
    }

    // 9. workspace roots 内 → FULL
    for (const root of this.workspaceRoots) {
      if (this._isInside(resolved, root)) {
        return AccessLevel.FULL;
      }
    }

    // 10. 策略显式写根
    for (const root of this.policyWritablePaths) {
      if (this._isInside(resolved, root)) {
        return AccessLevel.READ_WRITE;
      }
    }

    // 11. 其他普通系统路径 → 只读
    if (this.allowExternalReads) return AccessLevel.READ_ONLY;
    return AccessLevel.BLOCKED;
  }

  /**
   * 检查操作是否被允许
   * @param absolutePath 绝对路径
   * @param operation "read" | "write" | "delete"
   * @returns {{ allowed: boolean, reason?: string }}
   */
  check(absolutePath: string, operation: string): { allowed: boolean; reason?: string } {
    if (this._fullAccess) return { allowed: true };
    const level = this.getAccessLevel(absolutePath);
    const allowed = OP_REQUIREMENTS[operation]?.has(level) ?? false;

    if (allowed) return { allowed: true };

    const resolved = this._resolveReal(absolutePath) || absolutePath;
    const opLabel = { read: 'read', write: 'write', delete: 'delete' }[operation] || operation;
    return {
      allowed: false,
      reason: `Sandbox denied: ${opLabel} on ${resolved} (level: ${level})`,
    };
  }
}
