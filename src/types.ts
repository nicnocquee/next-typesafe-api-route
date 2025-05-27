import { NextRequest } from 'next/server';
import { z } from 'zod';

/**
 * Authentication result
 */
export interface AuthResult<TUser = any> {
  /** Whether authentication was successful */
  success: boolean;

  /** The authenticated user (if successful) */
  user?: TUser;

  /** Error message (if unsuccessful) */
  error?: string;

  /** HTTP status code to return on auth failure */
  status?: number;
}

/**
 * Authentication handler function type
 */
export type AuthHandler<TUser = any> = (
  request: NextRequest,
  options?: any,
) => Promise<AuthResult<TUser>>;

/**
 * OpenAPI metadata for an endpoint
 */
export interface OpenApiMetadata {
  /** Operation summary */
  summary: string;

  /** Detailed operation description */
  description?: string;

  /** Operation tags for grouping */
  tags?: string[];

  /** Operation ID (unique identifier) */
  operationId?: string;

  /** Whether to include this endpoint in the OpenAPI docs */
  includeInDocs?: boolean;

  /** Custom request body for special cases like file uploads */
  requestBody?: any;

  /** Custom responses beyond the standard ones */
  responses?: Record<
    string,
    {
      description: string;
      content?: Record<string, { schema: z.ZodType<any> }>;
    }
  >;
}

/**
 * HTTP methods supported by the API handler
 */
export type HttpMethod =
  | 'get'
  | 'post'
  | 'put'
  | 'delete'
  | 'patch'
  | 'options'
  | 'head';

/**
 * Configuration for the API handler
 */
export interface ApiHandlerOptions<
  TBody,
  TQuery,
  TPathParams,
  THeaders,
  TUser,
  TOutput,
> {
  /** Schema for validating request body (optional) */
  bodySchema?: z.ZodType<TBody>;

  /** Schema for validating query parameters (optional) */
  querySchema?: z.ZodType<TQuery>;

  /** Schema for validating path parameters (optional) */
  pathParamsSchema?: z.ZodType<TPathParams>;

  /** Schema for validating headers (optional) */
  headerSchema?: z.ZodType<THeaders>;

  /** Schema for validating form data (optional) */
  formDataSchema?: z.ZodType<any>;

  /** Authentication handler (optional) */
  auth?: {
    /** Authentication handler function */
    handler: AuthHandler<TUser>;

    /** Options to pass to the auth handler */
    options?: any;

    /** Authentication scheme name for OpenAPI */
    scheme?: string;
  };

  /** Response schema for OpenAPI documentation */
  responseSchema?: z.ZodType<TOutput>;

  /** OpenAPI metadata */
  openapi?: OpenApiMetadata;

  /** Handler function that processes the validated inputs */
  handler: (params: {
    body: TBody | undefined;
    query: TQuery | undefined;
    pathParams: TPathParams | undefined;
    headers: THeaders | undefined;
    user: TUser | undefined;
    request: NextRequest;
  }) => Promise<TOutput>;
}
