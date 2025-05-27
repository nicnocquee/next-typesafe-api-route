import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createDocumentedApiHandler, defaultRegistry } from './api-handler';
import { NextRequest } from 'next/server';
import { ApiHandlerOptions } from './types';

// Helper to create a mock NextRequest
const createMockRequest = (
  method: string,
  body?: object,
  query: Record<string, string> = {},
) => {
  const url = new URL('http://localhost/api');
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return {
    method,
    json: async () => body ?? {},
    formData: async () => new Map(),
    headers: new Map(),
    nextUrl: url,
  } as unknown as NextRequest;
};

describe('createDocumentedApiHandler', () => {
  beforeEach(() => {
    // Remove all route definitions before each test
    // (OpenAPIRegistry does not provide a clear method, so we filter in assertions)
  });

  it('registers OpenAPI route when openapi.includeInDocs is true', async () => {
    const bodySchema = z.object({ foo: z.string() });
    const responseSchema = z.object({ bar: z.number() });
    const handler = vi.fn().mockResolvedValue({ bar: 42 });
    const options: ApiHandlerOptions<
      z.infer<typeof bodySchema>,
      undefined,
      undefined,
      undefined,
      undefined,
      z.infer<typeof responseSchema>
    > = {
      bodySchema,
      responseSchema,
      handler,
      openapi: {
        summary: 'Test',
        description: 'desc',
        tags: ['test'],
        operationId: 'testOp',
        includeInDocs: true,
      },
    };
    const apiHandler = createDocumentedApiHandler('post', '/test', options);
    // Simulate a request
    const req = createMockRequest('POST', { foo: 'bar' });
    await apiHandler(req);
    expect(handler).toHaveBeenCalled();
    // Check OpenAPI registration
    const registered = defaultRegistry.definitions.find(
      (def) => def.type === 'route' && def.route.path === '/test',
    );
    expect(registered).toBeDefined();
    expect(
      registered && registered.type === 'route' && registered.route.summary,
    ).toBe('Test');
  });

  it('does not register OpenAPI route when openapi.includeInDocs is false', async () => {
    const handler = vi.fn().mockResolvedValue({});
    const options: ApiHandlerOptions<
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    > = {
      handler,
      openapi: {
        summary: 'Hidden',
        includeInDocs: false,
      },
    };
    createDocumentedApiHandler('get', '/hidden', options);
    const registered = defaultRegistry.definitions.find(
      (def) => def.type === 'route' && def.route.path === '/hidden',
    );
    expect(registered).toBeUndefined();
  });

  it('validates body and returns 400 on error', async () => {
    const bodySchema = z.object({ foo: z.string() });
    const handler = vi.fn();
    const options: ApiHandlerOptions<
      z.infer<typeof bodySchema>,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    > = {
      bodySchema,
      handler,
      openapi: { summary: 'Test', includeInDocs: true },
    };
    const apiHandler = createDocumentedApiHandler('post', '/test', options);
    const req = createMockRequest('POST', { foo: 123 }); // invalid type
    const res = await apiHandler(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.errors).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls handler with validated data', async () => {
    const bodySchema = z.object({ foo: z.string() });
    const handler = vi.fn().mockResolvedValue({ bar: 1 });
    const options: ApiHandlerOptions<
      z.infer<typeof bodySchema>,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined
    > = {
      bodySchema,
      handler,
      openapi: { summary: 'Test', includeInDocs: true },
    };
    const apiHandler = createDocumentedApiHandler('post', '/test', options);
    const req = createMockRequest('POST', { foo: 'bar' });
    const res = await apiHandler(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.bar).toBe(1);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ body: { foo: 'bar' } }),
    );
  });
});
