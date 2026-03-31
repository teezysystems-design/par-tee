import type { Context, MiddlewareHandler, Next } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { createClient } from '@supabase/supabase-js';

export interface AuthUser {
  supabaseUserId: string;
  email: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseServiceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const authMiddleware: MiddlewareHandler = createMiddleware(
  async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new HTTPException(401, { message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);

    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user) {
        throw new HTTPException(401, { message: 'Invalid or expired token' });
      }
      const { id, email } = data.user;
      if (!email) {
        throw new HTTPException(401, { message: 'Token missing email claim' });
      }
      c.set('user', { supabaseUserId: id, email });
    } catch (err) {
      if (err instanceof HTTPException) throw err;
      throw new HTTPException(401, { message: 'Invalid token' });
    }

    await next();
  }
);
