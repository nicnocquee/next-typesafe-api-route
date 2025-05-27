import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { createDocumentedApiHandler, defaultRegistry } from './api-handler';
import { NextRequest } from 'next/server';
import { ApiHandlerOptions } from './types';
import { bearerAuth } from './auth-handlers';

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

  it('handles authenticated endpoint with bearer token (valid token)', async () => {
    const bodySchema = z.object({ foo: z.string() });
    const responseSchema = z.object({ bar: z.number(), userId: z.string() });
    const handler = vi.fn().mockResolvedValue({ bar: 99, userId: 'user-123' });
    const verifyToken = vi.fn(async (token: string) => {
      if (token === 'valid-token')
        return { id: 'user-123', email: 'a@b.com', role: 'user' };
      throw new Error('Invalid token');
    });
    const options: ApiHandlerOptions<
      z.infer<typeof bodySchema>,
      undefined,
      undefined,
      undefined,
      { id: string; email: string; role: string },
      z.infer<typeof responseSchema>
    > = {
      bodySchema,
      responseSchema,
      handler,
      auth: {
        handler: bearerAuth,
        options: { verifyToken },
        scheme: 'bearerAuth',
      },
      openapi: {
        summary: 'Auth Test',
        includeInDocs: true,
      },
    };
    const apiHandler = createDocumentedApiHandler(
      'post',
      '/auth-test',
      options,
    );

    const reqWithAuth = createMockRequest('POST', { foo: 'bar' });
    reqWithAuth.headers.set('authorization', 'Bearer valid-token');
    const res = await apiHandler(reqWithAuth);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.bar).toBe(99);
    expect(json.userId).toBe('user-123');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        body: { foo: 'bar' },
        user: { id: 'user-123', email: 'a@b.com', role: 'user' },
      }),
    );
  });

  it('returns 401 and does not call handler when bearer token is missing', async () => {
    const bodySchema = z.object({ foo: z.string() });
    const responseSchema = z.object({ bar: z.number(), userId: z.string() });
    const handler = vi.fn().mockResolvedValue({ bar: 99, userId: 'user-123' });
    const verifyToken = vi.fn(async (token: string) => {
      if (token === 'valid-token')
        return { id: 'user-123', email: 'a@b.com', role: 'user' };
      throw new Error('Invalid token');
    });
    const options: ApiHandlerOptions<
      z.infer<typeof bodySchema>,
      undefined,
      undefined,
      undefined,
      { id: string; email: string; role: string },
      z.infer<typeof responseSchema>
    > = {
      bodySchema,
      responseSchema,
      handler,
      auth: {
        handler: bearerAuth,
        options: { verifyToken },
        scheme: 'bearerAuth',
      },
      openapi: {
        summary: 'Auth Test',
        includeInDocs: true,
      },
    };
    const apiHandler = createDocumentedApiHandler(
      'post',
      '/auth-test',
      options,
    );

    const reqNoAuth = createMockRequest('POST', { foo: 'bar' });
    const resNoAuth = await apiHandler(reqNoAuth);
    const jsonNoAuth = await resNoAuth.json();
    expect(resNoAuth.status).toBe(401);
    expect(jsonNoAuth.error).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 and does not call handler when bearer token is invalid', async () => {
    const bodySchema = z.object({ foo: z.string() });
    const responseSchema = z.object({ bar: z.number(), userId: z.string() });
    const handler = vi.fn().mockResolvedValue({ bar: 99, userId: 'user-123' });
    const verifyToken = vi.fn(async (token: string) => {
      if (token === 'valid-token')
        return { id: 'user-123', email: 'a@b.com', role: 'user' };
      throw new Error('Invalid token');
    });
    const options: ApiHandlerOptions<
      z.infer<typeof bodySchema>,
      undefined,
      undefined,
      undefined,
      { id: string; email: string; role: string },
      z.infer<typeof responseSchema>
    > = {
      bodySchema,
      responseSchema,
      handler,
      auth: {
        handler: bearerAuth,
        options: { verifyToken },
        scheme: 'bearerAuth',
      },
      openapi: {
        summary: 'Auth Test',
        includeInDocs: true,
      },
    };
    const apiHandler = createDocumentedApiHandler(
      'post',
      '/auth-test',
      options,
    );

    const reqInvalidAuth = createMockRequest('POST', { foo: 'bar' });
    reqInvalidAuth.headers.set('authorization', 'Bearer invalid-token');
    const resInvalid = await apiHandler(reqInvalidAuth);
    const jsonInvalid = await resInvalid.json();
    expect(resInvalid.status).toBe(401);
    expect(jsonInvalid.error).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('validates query and headers successfully', async () => {
    const querySchema = z.object({ q: z.string().min(2) });
    const headerSchema = z.object({
      'x-custom-header': z.string().regex(/^foo/),
    });
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const options: ApiHandlerOptions<
      undefined,
      z.infer<typeof querySchema>,
      undefined,
      z.infer<typeof headerSchema>,
      undefined,
      { ok: boolean }
    > = {
      querySchema,
      headerSchema,
      handler,
      openapi: { summary: 'Query/Header Success', includeInDocs: true },
    };
    const apiHandler = createDocumentedApiHandler(
      'get',
      '/query-header',
      options,
    );
    const req = createMockRequest('GET', undefined, { q: 'bar' });
    req.headers.set('x-custom-header', 'foo123');
    const res = await apiHandler(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        query: { q: 'bar' },
        headers: { 'x-custom-header': 'foo123' },
      }),
    );
  });

  it('returns 400 on invalid query or header', async () => {
    const querySchema = z.object({ q: z.string().min(2) });
    const headerSchema = z.object({
      'x-custom-header': z.string().regex(/^foo/),
    });
    const handler = vi.fn();
    const options: ApiHandlerOptions<
      undefined,
      z.infer<typeof querySchema>,
      undefined,
      z.infer<typeof headerSchema>,
      undefined,
      { ok: boolean }
    > = {
      querySchema,
      headerSchema,
      handler,
      openapi: { summary: 'Query/Header Fail', includeInDocs: true },
    };
    const apiHandler = createDocumentedApiHandler(
      'get',
      '/query-header',
      options,
    );
    // Invalid query (too short) and header (does not start with foo)
    const req = createMockRequest('GET', undefined, { q: 'a' });
    req.headers.set('x-custom-header', 'bar123');
    const res = await apiHandler(req);
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.errors).toBeDefined();
    expect(json.errors.query).toBeDefined();
    expect(json.errors.headers).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });
});
