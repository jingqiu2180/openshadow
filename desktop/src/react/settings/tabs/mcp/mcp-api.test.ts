/**
 * @vitest-environment jsdom
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const openshadowFetchMock = vi.fn();

vi.mock('../../api', () => ({
  openshadowFetch: (...args: unknown[]) => openshadowFetchMock(...args),
}));

import { addMcpConnector, removeMcpConnector, setMcpEnabled, updateMcpConnector } from './mcp-api';

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

function mockMcpResponses(...responses: Response[]) {
  const queue = [...responses];
  openshadowFetchMock.mockImplementation(() => Promise.resolve(queue.shift() ?? jsonResponse({ ok: true })));
}

afterEach(() => {
  openshadowFetchMock.mockReset();
});

describe('mcp-api mutations', () => {
  it('throws when the global enabled endpoint returns a JSON error', async () => {
    mockMcpResponses(jsonResponse({ error: 'save failed' }));

    await expect(setMcpEnabled(true)).rejects.toThrow('save failed');
  });

  it('uses the plugin settings namespace for the global enabled endpoint', async () => {
    mockMcpResponses(jsonResponse({ enabled: true, connectors: [], agentConfig: { connectors: {} } }));

    await setMcpEnabled(true);

    expect(openshadowFetchMock).toHaveBeenCalledWith(
      '/api/plugins/mcp/settings/enabled',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('throws when the global enabled endpoint does not return an MCP state', async () => {
    mockMcpResponses(jsonResponse({ ok: true }));

    await expect(setMcpEnabled(true)).rejects.toThrow('invalid state');
  });

  it('checks JSON errors for connector mutations too', async () => {
    openshadowFetchMock
      .mockResolvedValueOnce(jsonResponse({ error: 'add failed' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'remove failed' }));

    await expect(addMcpConnector({
      name: 'GitHub',
      transport: 'remote',
      url: 'https://mcp.example.com/mcp',
      authType: 'none',
    })).rejects.toThrow('add failed');
    await expect(removeMcpConnector('github')).rejects.toThrow('remove failed');
  });

  it('updates connectors through the plugin connector namespace', async () => {
    mockMcpResponses(jsonResponse({ connector: { id: 'local' }, state: {} }));

    await updateMcpConnector('local', {
      name: 'Local',
      transport: 'stdio',
      command: 'npx',
      env: { API_KEY: '********' },
      autoStart: true,
    });

    expect(openshadowFetchMock).toHaveBeenCalledWith(
      '/api/plugins/mcp/connectors/local',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          name: 'Local',
          transport: 'stdio',
          command: 'npx',
          env: { API_KEY: '********' },
          autoStart: true,
        }),
      }),
    );
  });
});
