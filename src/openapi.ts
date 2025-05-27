import {
  OpenApiGeneratorV3,
  OpenAPIRegistry,
} from '@asteasolutions/zod-to-openapi';

/**
 * OpenAPI document configuration
 */
export interface OpenApiConfig {
  /** API title */
  title: string;

  /** API version */
  version: string;

  /** API description */
  description?: string;

  /** API servers */
  servers?: Array<{
    url: string;
    description?: string;
  }>;

  /** Security schemes */
  securitySchemes?: Record<string, any>;
}

/**
 * Default OpenAPI configuration
 */
const defaultConfig: OpenApiConfig = {
  title: 'API Documentation',
  version: '1.0.0',
  description: 'API documentation generated with next-typesafe-api',
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],
  securitySchemes: {
    bearerAuth: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    apiKeyAuth: {
      type: 'apiKey',
      in: 'header',
      name: 'x-api-key',
    },
  },
};

/**
 * Generates the OpenAPI specification
 */
export function generateOpenApiDocument(
  config?: Partial<OpenApiConfig>,
  registry?: OpenAPIRegistry,
) {
  const mergedConfig = { ...defaultConfig, ...config };
  const generator = new OpenApiGeneratorV3(registry?.definitions ?? []);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: mergedConfig.title,
      version: mergedConfig.version,
      description: mergedConfig.description,
    },
    servers: mergedConfig.servers,
  });
}

/**
 * Creates an OpenAPI documentation route handler for Next.js
 */
export function createOpenApiRoute(
  config?: Partial<OpenApiConfig>,
  registry?: OpenAPIRegistry,
) {
  return function openApiHandler() {
    const openApiDoc = generateOpenApiDocument(config, registry);
    return Response.json(openApiDoc);
  };
}
