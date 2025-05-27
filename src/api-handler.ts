import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { ApiHandlerOptions, HttpMethod, OpenApiMetadata } from './types';

// Create a global registry for OpenAPI schemas
export const defaultRegistry = new OpenAPIRegistry();

/**
 * Creates a type-safe API route handler
 */
export function createApiHandler<
  TBody = undefined,
  TQuery = undefined,
  TPathParams = undefined,
  THeaders = undefined,
  TUser = any,
  TOutput = any,
>(
  options: ApiHandlerOptions<
    TBody,
    TQuery,
    TPathParams,
    THeaders,
    TUser,
    TOutput
  >,
) {
  return async function apiHandler(request: NextRequest, context?: any) {
    try {
      // Initialize result containers
      let body: TBody | undefined = undefined;
      let query: TQuery | undefined = undefined;
      let pathParams: TPathParams | undefined = undefined;
      let headers: THeaders | undefined = undefined;
      let user: TUser | undefined = undefined;
      const errors: Record<string, any> = {};

      // Handle authentication if provided
      if (options.auth) {
        const authResult = await options.auth.handler(
          request,
          options.auth.options,
        );

        if (!authResult.success) {
          return NextResponse.json(
            { error: authResult.error || 'Unauthorized' },
            { status: authResult.status || 401 },
          );
        }

        user = authResult.user;
      }

      // Parse and validate body if schema provided
      if (options.bodySchema) {
        try {
          const rawBody = ['GET', 'HEAD'].includes(request.method)
            ? {}
            : await request.json();
          const result = options.bodySchema.safeParse(rawBody);

          if (result.success) {
            body = result.data;
          } else {
            errors.body = result.error.format();
          }
        } catch (error) {
          errors.body = 'Invalid JSON in request body';
        }
      }

      // Parse and validate form data if schema provided
      if (options.formDataSchema) {
        try {
          const formData = await request.formData();
          const formDataObj: Record<string, any> = {};

          formData.forEach((value, key) => {
            formDataObj[key] = value;
          });

          const result = options.formDataSchema.safeParse(formDataObj);

          if (result.success) {
            body = result.data as any;
          } else {
            errors.formData = result.error.format();
          }
        } catch (error) {
          errors.formData = 'Invalid form data';
        }
      }

      // Parse and validate query parameters if schema provided
      if (options.querySchema) {
        const queryParams: Record<string, string> = {};
        request.nextUrl.searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });

        const result = options.querySchema.safeParse(queryParams);

        if (result.success) {
          query = result.data;
        } else {
          errors.query = result.error.format();
        }
      }

      // Parse and validate path parameters if schema provided
      if (options.pathParamsSchema && context?.params) {
        const result = options.pathParamsSchema.safeParse(context.params);

        if (result.success) {
          pathParams = result.data;
        } else {
          errors.pathParams = result.error.format();
        }
      }

      // Parse and validate headers if schema provided
      if (options.headerSchema) {
        const headerObj: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headerObj[key] = value;
        });

        const result = options.headerSchema.safeParse(headerObj);

        if (result.success) {
          headers = result.data;
        } else {
          errors.headers = result.error.format();
        }
      }

      // If there are any validation errors, return them
      if (Object.keys(errors).length > 0) {
        return NextResponse.json({ errors }, { status: 400 });
      }

      // Call the handler with validated data
      const output = await options.handler({
        body,
        query,
        pathParams,
        headers,
        user,
        request,
      });

      return NextResponse.json(output);
    } catch (error) {
      console.error('API handler error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 },
      );
    }
  };
}

/**
 * Creates a type-safe API route handler with explicit OpenAPI documentation
 */
export function createDocumentedApiHandler<
  TBody = undefined,
  TQuery = undefined,
  TPathParams = undefined,
  THeaders = undefined,
  TUser = any,
  TOutput = any,
>(
  method: HttpMethod,
  path: string,
  options: ApiHandlerOptions<
    TBody,
    TQuery,
    TPathParams,
    THeaders,
    TUser,
    TOutput
  >,
  registry: OpenAPIRegistry = defaultRegistry, // Add registry parameter with default
) {
  // Register this endpoint in the OpenAPI registry
  if (options.openapi && options.openapi.includeInDocs !== false) {
    registerOpenApiRoute({
      method,
      path,
      bodySchema: options.bodySchema,
      querySchema: options.querySchema,
      pathParamsSchema: options.pathParamsSchema,
      headerSchema: options.headerSchema,
      formDataSchema: options.formDataSchema,
      responseSchema: options.responseSchema,
      auth: options.auth,
      metadata: options.openapi,
      registry, // Pass the registry to the registration function
    });
  }

  // Return the actual handler function
  return createApiHandler(options);
}

/**
 * Registers a route in the OpenAPI registry
 */
function registerOpenApiRoute({
  method,
  path,
  bodySchema,
  querySchema,
  pathParamsSchema,
  headerSchema,
  formDataSchema,
  responseSchema,
  auth,
  metadata,
  registry = defaultRegistry, // Add registry parameter with default
}: {
  method: HttpMethod;
  path: string;
  bodySchema?: z.ZodType<any>;
  querySchema?: z.ZodType<any>;
  pathParamsSchema?: z.ZodType<any>;
  headerSchema?: z.ZodType<any>;
  formDataSchema?: z.ZodType<any>;
  responseSchema?: z.ZodType<any>;
  auth?: any;
  metadata: OpenApiMetadata;
  registry?: OpenAPIRegistry;
}) {
  // Convert path params from Next.js format to OpenAPI format if not already done
  // e.g., /users/[id] -> /users/{id}
  const openApiPath = path.includes('{')
    ? path
    : path.replace(/\[([^\]]+)\]/g, '{$1}');

  // Register the operation
  registry.registerPath({
    method: method.toLowerCase() as Lowercase<HttpMethod>,
    path: openApiPath,
    summary: metadata.summary,
    description: metadata.description,
    tags: metadata.tags,
    operationId: metadata.operationId,
    request: {
      body: bodySchema
        ? {
            content: {
              'application/json': {
                schema: bodySchema,
              },
            },
          }
        : formDataSchema
          ? {
              content: {
                'multipart/form-data': {
                  schema: formDataSchema,
                },
              },
            }
          : metadata.requestBody,
      query:
        querySchema &&
        (querySchema instanceof z.ZodObject ||
          querySchema instanceof z.ZodEffects)
          ? querySchema
          : undefined,
      headers:
        headerSchema &&
        (headerSchema instanceof z.ZodObject ||
          headerSchema instanceof z.ZodEffects)
          ? headerSchema
          : undefined,
      params:
        pathParamsSchema &&
        (pathParamsSchema instanceof z.ZodObject ||
          pathParamsSchema instanceof z.ZodEffects)
          ? pathParamsSchema
          : undefined,
    },
    responses: {
      ...(responseSchema
        ? {
            '200': {
              description: 'Successful response',
              content: {
                'application/json': {
                  schema: responseSchema,
                },
              },
            },
          }
        : {}),
      '400': {
        description: 'Bad request',
        content: {
          'application/json': {
            schema: z.object({
              errors: z.record(z.any()),
            }),
          },
        },
      },
      '401': {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
      },
      '500': {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: z.object({
              error: z.string(),
            }),
          },
        },
      },
      ...metadata.responses,
    },
    security: auth ? [{ [auth.scheme || 'bearerAuth']: [] }] : undefined,
  });
}
