// @ts-nocheck
/**
 * experience-tool.ts — recall_experience / record_experience 工具
 * 移植自 openhanako/lib/tools/experience.ts
 * 经验库采用渐进式披露
 */
import type { ToolRegistry } from '../tool-registry'
import { createToolSpec } from '../tool-registry'
import { t } from '../i18n'
import {
  recordEntry,
  findExperienceDocument,
} from '../experience-store'

function isExperienceEnabled(isEnabled?: () => boolean): boolean {
  if (typeof isEnabled !== 'function') return false
  try {
    return isEnabled() === true
  } catch {
    return false
  }
}

function pausedResult() {
  return {
    content: [{ type: 'text', text: t('error.expPaused') }],
    details: { paused: true },
  }
}

function readFile(filePath: string): string {
  try {
    const fs = require('fs')
    return fs.readFileSync(filePath, 'utf-8')
  } catch {
    return ''
  }
}

export function registerExperienceTool(registry: ToolRegistry): void {
  const experienceDir = require('path').join(process.cwd(), 'data', 'experience')
  const indexPath = require('path').join(process.cwd(), 'data', 'experience.md')

  // ─── recall_experience ───
  registry.register(
    'recall_experience',
    createToolSpec('recall_experience', {
      description:
        'Browse the experience library. Without parameters, returns an overview of all categories. With a category name, returns specific experiences in that category. When the user asks you to do a concrete task (write code, research, create documents, analyze problems, etc.), check this tool first for relevant experience before starting. Not needed for casual chat, Q&A, or everyday conversation.',
      params: {
        category: { type: 'string', description: 'Category name. Omit to get an overview of all categories' },
      },
    }),
    async (args: any) => {
      if (!isExperienceEnabled()) return pausedResult()

      const category = args.category?.trim()

      if (!category) {
        // 返回索引
        const index = readFile(indexPath)
        if (!index.trim()) {
          return {
            content: [{ type: 'text', text: t('error.expEmpty') }],
            details: {},
          }
        }
        return {
          content: [{ type: 'text', text: index }],
          details: {},
        }
      }

      // 返回具体分类
      let doc = null
      try {
        doc = findExperienceDocument(experienceDir, category)
      } catch {}
      if (!doc || !doc.body.trim()) {
        return {
          content: [{ type: 'text', text: t('error.expCategoryNotFound', { category }) }],
          details: {},
        }
      }
      return {
        content: [{ type: 'text', text: `# ${doc.title}\n\n${doc.body}` }],
        details: { category: doc.title },
      }
    }
  )

  // ─── record_experience ───
  registry.register(
    'record_experience',
    createToolSpec('record_experience', {
      description:
        'Record a lesson learned to the experience library. Use when: the user points out a mistake and explains the correct approach, the user shows frustration or repeatedly emphasizes something, you discover an effective method after trying multiple approaches, the user explicitly says "from now on do/don\'t do this", or you hit a pitfall during patrol or autonomous work. Each entry should be concise and direct, one sentence.',
      params: {
        category: { type: 'string', description: 'Category for the experience, a 2-4 word phrase, e.g. "tool usage", "search tips", "response style"' },
        content: { type: 'string', description: 'The specific experience content, concise and direct, one sentence' },
      },
    }),
    async (args: any) => {
      if (!isExperienceEnabled()) return pausedResult()

      const category = args.category?.replace(/^#+\s*/, '').trim()
      const content = args.content?.trim()

      if (!category || !content) {
        return {
          content: [{ type: 'text', text: t('error.expEmptyInput') }],
          details: {},
        }
      }

      let result: { added: boolean; reason?: string }
      try {
        result = recordEntry(experienceDir, indexPath, category, content)
      } catch (err: any) {
        if (err.message === 'invalid experience category') {
          return {
            content: [{ type: 'text', text: err.message }],
            details: {},
          }
        }
        throw err
      }

      if (!result.added) {
        return {
          content: [{ type: 'text', text: t('error.expDuplicate') }],
          details: {},
        }
      }

      return {
        content: [{ type: 'text', text: t('error.expRecorded', { category, content }) }],
        details: { category, content },
      }
    }
  )
}
