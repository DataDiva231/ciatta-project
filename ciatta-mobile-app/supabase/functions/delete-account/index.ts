// Deletes the caller's own account and everything that belongs to it.
// Self-service only — the user id is never taken from the request, only
// ever derived from the caller's own verified session token, so there is
// no way for this endpoint to be used to delete anyone else's account.
//
// Every table in the schema references auth.users(id) on delete cascade
// (see the init migration), so deleting the auth.users row is sufficient
// — profiles, observations, evidence, understandings, understanding_history,
// relationships, discoveries, and curiosities all clean up automatically.
//
// service_role is used here, server-side only, exactly as everywhere else
// in this codebase — never sent to or stored in the client.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Resolve the caller's own identity from their token — this is the
    // only source of truth for which account gets deleted.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userData.user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ deleted: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
