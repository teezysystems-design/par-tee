import type { Context, MiddlewareHandler, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

export interface AuthUser {
  supabaseUserId: string;
  email: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

export const authMiddleware: MiddlewareHandler = createMiddleware(
  async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);

    // TODO: Validate JWT with Supabase once env is configured
    // For now, decode and trust (replace with real Supabase JWT verification)
    try {
      const [, payloadB64] = token.split('.');
      if (!payloadB64) throw new Error('Invalid token format');
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf8')) as {
        sub?: string;
        email?: string;
      };
      if (!payload.sub || !payload.email) {
        throw new Error('Missing sub or email in token');
      }
      c.set('user', { supabaseUserId: payload.sub, email: payload.email });
    } catch {
      throw new HTTPException(401, { message: 'Invalid token' });
    }

    await next();
  }
);
