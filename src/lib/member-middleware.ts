import { createMiddleware } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

// Admission is authentication-only; ordinary app functions also require membership.
export const requireMember = createMiddleware({ type: 'function' })
  .middleware([requireSupabaseAuth])
  .server(async ({ context, next }) => {
    const { data, error } = await context.supabase.rpc('is_active_member');
    if (error || !data) throw new Error('Access requires an invitation.');
    return next();
  });