import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../hooks/use-openshadow-fetch', () => ({
  openshadowFetch: vi.fn(),
  openshadowUrl: (p: string) => p,
}));

vi.mock('../../stores', () => ({
  useStore: {
    getState: () => ({}),
    setState: vi.fn(),
  },
}));

import { openshadowFetch } from '../../hooks/use-openshadow-fetch';

const openshadowFetchMock = openshadowFetch as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  openshadowFetchMock.mockReset();
});

describe('archived-session actions', () => {
  it('listArchivedSessions returns the body array', async () => {
    openshadowFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ path: '/x/a.jsonl', title: 'Hi' }],
    });
    const { listArchivedSessions } = await import('../../stores/session-actions');
    const list = await listArchivedSessions();
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Hi');
    expect(openshadowFetchMock).toHaveBeenCalledWith('/api/sessions/archived');
  });

  it('listArchivedSessions returns [] when fetch not ok', async () => {
    openshadowFetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'x' }) });
    const { listArchivedSessions } = await import('../../stores/session-actions');
    expect(await listArchivedSessions()).toEqual([]);
  });

  it("restoreSession returns 'ok' on 200", async () => {
    openshadowFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    const { restoreSession } = await import('../../stores/session-actions');
    expect(await restoreSession('/x/a.jsonl')).toBe('ok');
  });

  it("restoreSession returns 'conflict' on 409", async () => {
    openshadowFetchMock.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'conflict' }),
    });
    const { restoreSession } = await import('../../stores/session-actions');
    expect(await restoreSession('/x/a.jsonl')).toBe('conflict');
  });

  it("restoreSession returns 'error' on 500", async () => {
    openshadowFetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });
    const { restoreSession } = await import('../../stores/session-actions');
    expect(await restoreSession('/x/a.jsonl')).toBe('error');
  });

  it('deleteArchivedSession posts path and returns true on ok', async () => {
    openshadowFetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    const { deleteArchivedSession } = await import('../../stores/session-actions');
    const r = await deleteArchivedSession('/x/a.jsonl');
    expect(r).toBe(true);
    expect(openshadowFetchMock).toHaveBeenCalledWith(
      '/api/sessions/archived/delete',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('deleteArchivedSession returns false when not ok', async () => {
    openshadowFetchMock.mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ error: 'x' }) });
    const { deleteArchivedSession } = await import('../../stores/session-actions');
    expect(await deleteArchivedSession('/x/a.jsonl')).toBe(false);
  });

  it('cleanupArchivedSessions posts maxAgeDays and parses deleted', async () => {
    openshadowFetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, deleted: 5 }),
    });
    const { cleanupArchivedSessions } = await import('../../stores/session-actions');
    const r = await cleanupArchivedSessions(30);
    expect(r.deleted).toBe(5);
    expect(openshadowFetchMock).toHaveBeenCalledWith(
      '/api/sessions/cleanup',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
