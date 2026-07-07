import { describe, it, expect, vi } from 'vitest';
import { ApiExecutor } from '../api.js';
import { buildMockCtx, buildMockApiContext, buildMockResponse } from '../../test-helpers.js';
import type { ApiStep } from '../../types/index.js';

const executor = new ApiExecutor();

function makeStep(overrides: Partial<ApiStep['api']> = {}): ApiStep {
  return {
    api: {
      method: 'GET',
      url:    'https://api.test/users',
      ...overrides,
    },
  };
}

describe('ApiExecutor — HTTP dispatch', () => {
  it('calls apiContext.get for a GET step', async () => {
    const apiContext = buildMockApiContext();
    const ctx        = buildMockCtx({ apiContext });

    await executor.execute(makeStep({ method: 'GET' }), ctx);

    expect(apiContext.get).toHaveBeenCalledWith(
      'https://api.test/users',
      expect.objectContaining({}),
    );
  });

  it('calls apiContext.post with body for a POST step', async () => {
    const apiContext = buildMockApiContext();
    const ctx        = buildMockCtx({ apiContext });

    await executor.execute(
      makeStep({ method: 'POST', body: { name: 'Alice' } }),
      ctx,
    );

    expect(apiContext.post).toHaveBeenCalledWith(
      'https://api.test/users',
      expect.objectContaining({ data: { name: 'Alice' } }),
    );
  });

  it('passes custom headers to the request', async () => {
    const apiContext = buildMockApiContext();
    const ctx        = buildMockCtx({ apiContext });

    await executor.execute(
      makeStep({ headers: { Authorization: 'Bearer token' } }),
      ctx,
    );

    expect(apiContext.get).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: { Authorization: 'Bearer token' } }),
    );
  });
});

describe('ApiExecutor — status assertions', () => {
  it('passes when the response status matches assert.status', async () => {
    const response   = buildMockResponse(201);
    const apiContext = buildMockApiContext(response);
    const ctx        = buildMockCtx({ apiContext });

    await expect(
      executor.execute(makeStep({ method: 'POST', assert: { status: 201 } }), ctx),
    ).resolves.not.toThrow();
  });

  it('throws when the response status does not match assert.status', async () => {
    const response   = buildMockResponse(500);
    const apiContext = buildMockApiContext(response);
    const ctx        = buildMockCtx({ apiContext });

    await expect(
      executor.execute(makeStep({ assert: { status: 200 } }), ctx),
    ).rejects.toThrow('expected status 200, got 500');
  });
});

describe('ApiExecutor — jsonPath assertions', () => {
  it('passes equals assertion when extracted value matches', async () => {
    const response   = buildMockResponse(200, { id: 42 });
    const apiContext = buildMockApiContext(response);
    const ctx        = buildMockCtx({ apiContext });

    await expect(
      executor.execute(
        makeStep({ assert: { jsonPath: '$.id', equals: 42 } }),
        ctx,
      ),
    ).resolves.not.toThrow();
  });

  it('throws when equals assertion fails', async () => {
    const response   = buildMockResponse(200, { id: 99 });
    const apiContext = buildMockApiContext(response);
    const ctx        = buildMockCtx({ apiContext });

    await expect(
      executor.execute(
        makeStep({ assert: { jsonPath: '$.id', equals: 42 } }),
        ctx,
      ),
    ).rejects.toThrow('expected 42, got 99');
  });

  it('passes greaterThan assertion', async () => {
    const response   = buildMockResponse(200, { count: 10 });
    const apiContext = buildMockApiContext(response);
    const ctx        = buildMockCtx({ apiContext });

    await expect(
      executor.execute(
        makeStep({ assert: { jsonPath: '$.count', greaterThan: 5 } }),
        ctx,
      ),
    ).resolves.not.toThrow();
  });

  it('throws when greaterThan assertion fails', async () => {
    const response   = buildMockResponse(200, { count: 3 });
    const apiContext = buildMockApiContext(response);
    const ctx        = buildMockCtx({ apiContext });

    await expect(
      executor.execute(
        makeStep({ assert: { jsonPath: '$.count', greaterThan: 5 } }),
        ctx,
      ),
    ).rejects.toThrow('expected > 5');
  });

  it('passes lessThan assertion', async () => {
    const response   = buildMockResponse(200, { latency: 100 });
    const apiContext = buildMockApiContext(response);
    const ctx        = buildMockCtx({ apiContext });

    await expect(
      executor.execute(
        makeStep({ assert: { jsonPath: '$.latency', lessThan: 500 } }),
        ctx,
      ),
    ).resolves.not.toThrow();
  });

  it('throws when lessThan assertion fails', async () => {
    const response   = buildMockResponse(200, { latency: 1000 });
    const apiContext = buildMockApiContext(response);
    const ctx        = buildMockCtx({ apiContext });

    await expect(
      executor.execute(
        makeStep({ assert: { jsonPath: '$.latency', lessThan: 500 } }),
        ctx,
      ),
    ).rejects.toThrow('expected < 500');
  });
});

describe('ApiExecutor — save:', () => {
  it('extracts a jsonPath value and stores it in the returned context', async () => {
    const response   = buildMockResponse(200, { user: { id: 'u-123' } });
    const apiContext = buildMockApiContext(response);
    const ctx        = buildMockCtx({ apiContext });

    const result = await executor.execute(
      makeStep({ save: { userId: '$.user.id' } }),
      ctx,
    );

    expect(result.layers.stepOutputs['userId']).toBe('u-123');
  });

  it('saves nothing when the body cannot be parsed as JSON', async () => {
    const response = {
      status: vi.fn().mockReturnValue(200),
      json:   vi.fn().mockRejectedValue(new Error('not json')),
    };
    const apiContext = buildMockApiContext(response as any);
    const ctx        = buildMockCtx({ apiContext });

    const result = await executor.execute(
      makeStep({ save: { userId: '$.id' } }),
      ctx,
    );

    expect(result.layers.stepOutputs['userId']).toBeUndefined();
  });
});
