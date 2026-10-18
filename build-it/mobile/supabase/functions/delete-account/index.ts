// Supabase Edge Function: lets a signed-in person delete their own account (App Store rule).
// Deploy: supabase functions deploy delete-account
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createDeleteHandler } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const BUCKET = 'photos';

Deno.serve(
  createDeleteHandler({
    async userIdFromToken(token) {
      const { data, error } = await admin.auth.getUser(token);
      return error ? null : (data.user?.id ?? null);
    },
    async deleteUserFiles(userId) {
      // Photos sit directly in <user id>/. List and remove them a page at a time.
      for (;;) {
        const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: 1000 });
        if (error) throw error;
        if (!data.length) return;
        const { error: removeError } = await admin.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
        if (removeError) throw removeError;
      }
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw error;
    },
    log: console.error,
  }),
);
