import { NextRequest } from 'next/server';
import { AuthHandler, AuthResult } from './types';

/**
 * User interface (customize as needed)
 */
export interface User {
  id: string;
  email: string;
  role: string;
  [key: string]: any;
}

/**
 * Bearer token authentication options
 */
export interface BearerAuthOptions {
  /** JWT verification function */
  verifyToken: (token: string) => Promise<any>;

  /** Whether to require authentication (default: true) */
  required?: boolean;

  /** Custom user transformation function */
  transformUser?: (payload: any) => User;
}

/**
 * Authenticates requests using Bearer token in Authorization header
 */
export const bearerAuth: AuthHandler<User> = async (
  request: NextRequest,
  options: BearerAuthOptions,
) => {
  const authHeader = request.headers.get('authorization');

  // If auth is not required and no token provided, return success with no user
  if (options.required === false && !authHeader) {
    return { success: true };
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Missing or invalid authorization header',
      status: 401,
    };
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify the JWT token using the provided function
    const payload = await options.verifyToken(token);

    // Transform the user if a transform function is provided
    const user = options.transformUser
      ? options.transformUser(payload)
      : (payload as User);

    return { success: true, user };
  } catch (error) {
    return {
      success: false,
      error: 'Invalid or expired token',
      status: 401,
    };
  }
};

/**
 * API key authentication options
 */
export interface ApiKeyAuthOptions {
  /** Valid API keys or validation function */
  keys: string[] | ((key: string) => Promise<boolean>);

  /** Header name for the API key (default: 'x-api-key') */
  headerName?: string;

  /** Custom user object to attach */
  user?: User;
}

/**
 * Authenticates requests using API key in headers
 */
export const apiKeyAuth: AuthHandler<User> = async (
  request: NextRequest,
  options: ApiKeyAuthOptions,
) => {
  const headerName = options.headerName || 'x-api-key';
  const apiKey = request.headers.get(headerName);

  if (!apiKey) {
    return {
      success: false,
      error: `Missing ${headerName} header`,
      status: 401,
    };
  }

  let isValid = false;

  if (typeof options.keys === 'function') {
    isValid = await options.keys(apiKey);
  } else {
    isValid = options.keys.includes(apiKey);
  }

  if (!isValid) {
    return {
      success: false,
      error: 'Invalid API key',
      status: 401,
    };
  }

  return {
    success: true,
    user: options.user || { id: 'api', role: 'api', email: 'api@example.com' },
  };
};

/**
 * Creates a custom authentication handler
 */
export function createAuthHandler<TUser = User, TOptions = any>(
  handler: (
    request: NextRequest,
    options: TOptions,
  ) => Promise<AuthResult<TUser>>,
): AuthHandler<TUser> {
  return handler;
}
