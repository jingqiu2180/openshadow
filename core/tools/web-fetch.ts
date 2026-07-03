// @ts-nocheck
/**
 * web-fetch.ts - web_fetch 工具（最小化实现）
 *
 * 允许 agent 抓取指定 URL 的内容并提取文本。
 * 流程：fetch → HTML → 提取正文文本（去标签）→ 截断返回
 */

import { ToolRegistry } from '../tool-registry.js';

export function registerWebFetchTool(registry: ToolRegistry): void {
  registry.register({
    name: 'web_fetch',
    description: 'Fetch the content of a URL and extract text. Supports HTML pages, JSON APIs, and plain text.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to fetch',
        },
      },
      required: ['url'],
    },
    async execute(params: { url: string }) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(params.url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'OpenShadowBot/1.0',
          },
        });

        clearTimeout(timeout);

        if (!response.ok) {
          return {
            content: [{ type: 'text', text: `Failed to fetch: ${response.status} ${response.statusText}` }],
            isError: true,
          };
        }

        const contentType = response.headers.get('content-type') || '';
        let text: string;

        if (contentType.includes('application/json')) {
          const json = await response.json();
          text = JSON.stringify(json, null, 2);
        } else {
          text = await response.text();
          // Strip HTML tags for readability
          text = text.replace(/<script[^>]*>.*?<\/script>/gis, '');
          text = text.replace(/<style[^>]*>.*?<\/style>/gis, '');
          text = text.replace(/<[^>]+>/g, ' ');
          text = text.replace(/\s+/g, ' ').trim();
        }

        // Truncate to 12000 chars
        if (text.length > 12000) {
          text = text.slice(0, 12000) + '\n... (truncated)';
        }

        return {
          content: [{ type: 'text', text }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error fetching URL: ${error.message}` }],
          isError: true,
        };
      }
    },
  });
}
