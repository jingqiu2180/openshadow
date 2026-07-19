/**
 * web-fetch.ts - web_fetch tool (minimal implementation)
 *
 * Allows agent to fetch URL content and extract text.
 */

export function createWebFetchTool() {
  return {
    name: 'web_fetch',
    description: 'Fetch the content of a URL and extract text.',
    parameters: {
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

        const text = await response.text();
        const truncated = text.length > 12000 ? text.slice(0, 12000) + '\n... (truncated)' : text;

        return {
          content: [{ type: 'text', text: truncated }],
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error fetching URL: ${error.message}` }],
          isError: true,
        };
      }
    },
  };
}
