# next-typesafe-api-route

A type-safe API handler library for [Next.js Route Handlers (App Router)](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) with automatic [OpenAPI](https://www.openapis.org) documentation generation.

## Features

- 🔒 **Type-safe API handlers** for Next.js App Router
- 📝 **Automatic OpenAPI documentation** generation
- 🔍 **Request validation** using [Zod](https://zod.dev) schemas
- 🔐 **Modular authentication** with built-in handlers
- 🧩 **Comprehensive parameter validation** (body, query, path, headers)
- 📊 **Swagger UI integration** for interactive API documentation

## Installation

```bash
npm install next-typesafe-api-route zod @asteasolutions/zod-to-openapi swagger-ui-react
```

## Quick Start

### 1. Create a Type-Safe API Handler

```typescript
// app/api/products/route.ts
import { z } from 'zod';
import { createDocumentedApiHandler } from 'next-typesafe-api-route';

// Define request schema
const ProductCreateSchema = z.object({
  name: z.string().min(1).max(100).describe('Product name'),
  price: z.number().positive().describe('Product price in cents'),
  description: z.string().optional().describe('Product description'),
});

// Define response schema
const ProductResponseSchema = z.object({
  id: z.string().uuid().describe('Unique product ID'),
  name: z.string().describe('Product name'),
  price: z.number().describe('Product price in cents'),
  description: z.string().optional().describe('Product description'),
  createdAt: z.string().describe('Creation timestamp'),
});

// Create the POST handler with documentation
export const POST = createDocumentedApiHandler('post', '/api/products', {
  bodySchema: ProductCreateSchema,
  responseSchema: ProductResponseSchema,
  openapi: {
    summary: 'Create a new product',
    description: 'Creates a new product in the catalog',
    tags: ['Products'],
    operationId: 'createProduct',
  },
  handler: async ({ body }) => {
    // Create the product
    const product = {
      id: crypto.randomUUID(),
      name: body!.name,
      price: body!.price,
      description: body?.description,
      createdAt: new Date().toISOString(),
    };

    return product;
  },
});
```

### 2. Create a Swagger UI Page

```tsx
// app/api/docs/page.tsx
'use client';

import { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function ApiDocsPage() {
  const [spec, setSpec] = useState(null);

  useEffect(() => {
    fetch('/api/docs/openapi')
      .then((response) => response.json())
      .then((data) => setSpec(data))
      .catch((error) => console.error('Error loading OpenAPI spec:', error));
  }, []);

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">API Documentation</h1>
      {spec ? <SwaggerUI spec={spec} /> : <p>Loading API documentation...</p>}
    </div>
  );
}
```

### 3. OpenAPI Documentation Generation

In Next.js development mode, route handlers aren't imported until they're accessed, which means your API endpoints won't be registered in the OpenAPI registry until they're called at least once. To solve this issue, `next-typesafe-api-route` provides a CLI tool to generate a registry file that imports all your API routes:

```bash
npx generate-api-registry
```

This will scan your `app` directory for route files and generate a registry file at `lib/api-registry.ts` that imports all your routes.

#### Options

- `-d, --dir <directory>`: Root directory to scan for route files (default: `./app`)
- `-o, --output <file>`: Output file path (default: `./lib/api-registry.ts`)
- `-v, --verbose`: Enable verbose logging

#### Example Usage

```bash
# Generate with default options
npx generate-api-registry

# Specify custom directory and output file
npx generate-api-registry --dir ./src/app --output ./src/lib/api-registry.ts

# Enable verbose logging
npx generate-api-registry --verbose
```

### Integration with Next.js

Add the following to your `package.json`:

```json
{
  "scripts": {
    "dev": "generate-api-registry && next dev",
    "build": "generate-api-registry && next build"
  }
}
```

Then use the generated registry in your OpenAPI route:

```typescript
// app/api/docs/openapi/route.ts
import { generateOpenApiDocument } from 'next-typesafe-api-route';
import { getSharedRegistry, importApiRoutes } from '@/lib/api-registry';

export async function GET() {
  // Get the registry
  await importApiRoutes();
  const registry = getSharedRegistry();

  // Generate the OpenAPI document
  const openApiDoc = generateOpenApiDocument(
    {
      title: 'My API',
      version: '1.0.0',
      description: 'API documentation for my Next.js application',
    },
    registry,
  );

  return Response.json(openApiDoc);
}
```

## API Reference

### `createApiHandler`

Creates a type-safe API route handler without OpenAPI documentation.

```typescript
function createApiHandler<TBody, TQuery, TPathParams, THeaders, TUser, TOutput>(
  options: ApiHandlerOptions<
    TBody,
    TQuery,
    TPathParams,
    THeaders,
    TUser,
    TOutput
  >,
): (request: NextRequest, context?: any) => Promise<NextResponse>;
```

### `createDocumentedApiHandler`

Creates a type-safe API route handler with OpenAPI documentation.

```typescript
function createDocumentedApiHandler<
  TBody,
  TQuery,
  TPathParams,
  THeaders,
  TUser,
  TOutput,
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
): (request: NextRequest, context?: any) => Promise<NextResponse>;
```

### `ApiHandlerOptions`

Configuration options for the API handler.

```typescript
interface ApiHandlerOptions<
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
```

### `OpenApiMetadata`

Metadata for OpenAPI documentation.

```typescript
interface OpenApiMetadata {
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
```

### Authentication Handlers

#### `bearerAuth`

Authenticates requests using Bearer token in Authorization header.

```typescript
const bearerAuth: AuthHandler<User>;
```

Usage:

```typescript
import { bearerAuth } from 'next-typesafe-api-route';
import { jwtVerify } from 'jose';

// JWT verification function
const verifyToken = async (token: string) => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const { payload } = await jwtVerify(token, secret);
  return payload;
};

export const GET = createDocumentedApiHandler('get', '/api/users/me', {
  auth: {
    handler: bearerAuth,
    options: {
      verifyToken,
    },
    scheme: 'bearerAuth',
  },
  // ...
});
```

#### `apiKeyAuth`

Authenticates requests using API key in headers.

```typescript
const apiKeyAuth: AuthHandler<User>;
```

Usage:

```typescript
import { apiKeyAuth } from 'next-typesafe-api-route';

export const POST = createDocumentedApiHandler(
  'post',
  '/api/webhooks/payment',
  {
    auth: {
      handler: apiKeyAuth,
      options: {
        headerName: 'x-payment-signature',
        keys: [process.env.PAYMENT_WEBHOOK_SECRET!],
      },
      scheme: 'apiKeyAuth',
    },
    // ...
  },
);
```

#### `createAuthHandler`

Creates a custom authentication handler.

```typescript
function createAuthHandler<TUser, TOptions>(
  handler: (
    request: NextRequest,
    options: TOptions,
  ) => Promise<AuthResult<TUser>>,
): AuthHandler<TUser>;
```

Usage:

```typescript
import { createAuthHandler } from 'next-typesafe-api-route';

// Custom auth handler for admin-only endpoints
const adminAuth = createAuthHandler(async (request) => {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Missing or invalid authorization header',
      status: 401,
    };
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the token (simplified example)
    const user = { id: '123', email: 'admin@example.com', role: 'admin' };

    // Check if user is an admin
    if (user.role !== 'admin') {
      return {
        success: false,
        error: 'Insufficient permissions',
        status: 403,
      };
    }

    return { success: true, user };
  } catch (error) {
    return {
      success: false,
      error: 'Invalid or expired token',
      status: 401,
    };
  }
});
```

### OpenAPI Generation

#### `createOpenApiRoute`

Creates an OpenAPI documentation route handler for Next.js.

```typescript
function createOpenApiRoute(config?: Partial<OpenApiConfig>): () => Response;
```

#### `generateOpenApiDocument`

Generates the OpenAPI specification.

```typescript
function generateOpenApiDocument(config?: Partial<OpenApiConfig>): any;
```

## Examples

### GET Request with Query Parameters

```typescript
// app/api/users/route.ts
import { z } from 'zod';
import { createDocumentedApiHandler } from 'next-typesafe-api-route';

const UserQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform(Number).optional().default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
  sortBy: z
    .enum(['name', 'email', 'createdAt'])
    .optional()
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).optional().default('desc'),
  search: z.string().optional(),
});

const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.string(),
});

export const GET = createDocumentedApiHandler('get', '/api/users', {
  querySchema: UserQuerySchema,
  responseSchema: z.object({
    users: z.array(UserResponseSchema),
    pagination: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      totalPages: z.number(),
    }),
  }),
  openapi: {
    summary: 'List users',
    description: 'Get a paginated list of users',
    tags: ['Users'],
    operationId: 'listUsers',
  },
  handler: async ({ query }) => {
    // In a real app, you would fetch users from a database
    // based on the query parameters
    const { page, limit, sortBy, order, search } = query!;

    // Mock data
    const users = Array.from({ length: 3 }, (_, i) => ({
      id: crypto.randomUUID(),
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      createdAt: new Date().toISOString(),
    }));

    return {
      users,
      pagination: {
        total: 100,
        page,
        limit,
        totalPages: Math.ceil(100 / limit),
      },
    };
  },
});
```

### Path Parameters

```typescript
// app/api/users/[id]/route.ts
import { z } from 'zod';
import { createDocumentedApiHandler } from 'next-typesafe-api-route';

export const GET = createDocumentedApiHandler('get', '/api/users/{id}', {
  pathParamsSchema: z.object({
    id: z.string().uuid().describe('User ID'),
  }),
  responseSchema: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    createdAt: z.string(),
  }),
  openapi: {
    summary: 'Get user by ID',
    description: 'Retrieves a specific user by their ID',
    tags: ['Users'],
    operationId: 'getUser',
  },
  handler: async ({ pathParams }) => {
    // In a real app, you would fetch the user from a database
    return {
      id: pathParams!.id,
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date().toISOString(),
    };
  },
});
```

### File Upload

```typescript
// app/api/uploads/route.ts
import { z } from 'zod';
import { createDocumentedApiHandler } from 'next-typesafe-api-route';

export const POST = createDocumentedApiHandler('post', '/api/uploads', {
  formDataSchema: z.object({
    description: z.string().optional().describe('File description'),
  }),
  responseSchema: z.object({
    fileId: z.string().describe('Uploaded file ID'),
    url: z.string().describe('URL to access the file'),
    filename: z.string().describe('Original filename'),
    size: z.number().describe('File size in bytes'),
  }),
  openapi: {
    summary: 'Upload a file',
    description: 'Uploads a file to the server',
    tags: ['Files'],
    operationId: 'uploadFile',
    requestBody: {
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              file: {
                type: 'string',
                format: 'binary',
                description: 'File to upload',
              },
              description: {
                type: 'string',
                description: 'File description',
              },
            },
            required: ['file'],
          },
        },
      },
    },
  },
  handler: async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const description = formData.get('description') as string | null;

    // Process file upload
    return {
      fileId: crypto.randomUUID(),
      url: `https://example.com/files/${crypto.randomUUID()}`,
      filename: file.name,
      size: file.size,
    };
  },
});
```

### Optional Authentication

```typescript
// app/api/products/[id]/route.ts
import { z } from 'zod';
import {
  createDocumentedApiHandler,
  bearerAuth,
} from 'next-typesafe-api-route';
import { jwtVerify } from 'jose';

// JWT verification function
const verifyToken = async (token: string) => {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
  const { payload } = await jwtVerify(token, secret);
  return payload;
};

export const GET = createDocumentedApiHandler('get', '/api/products/{id}', {
  pathParamsSchema: z.object({
    id: z.string().uuid().describe('Product ID'),
  }),
  auth: {
    handler: bearerAuth,
    options: {
      verifyToken,
      required: false, // Authentication is optional
    },
    scheme: 'bearerAuth',
  },
  responseSchema: z.object({
    id: z.string().uuid(),
    name: z.string(),
    price: z.number(),
    description: z.string().optional(),
    inventory: z.number().optional(),
  }),
  openapi: {
    summary: 'Get product by ID',
    description: 'Retrieves a specific product by its ID',
    tags: ['Products'],
    operationId: 'getProduct',
  },
  handler: async ({ pathParams, user }) => {
    // Fetch the product
    const product = {
      id: pathParams!.id,
      name: 'Sample Product',
      price: 2999,
      description: 'A great product',
      // Private field only visible to authenticated users
      inventory: user ? 150 : undefined,
    };

    return product;
  },
});
```

## Version Compatibility

This package requires:

- `@asteasolutions/zod-to-openapi` version 7.3.0 or higher
- `zod` version 3.0.0 or higher
- `next` version 13.0.0 or higher

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
