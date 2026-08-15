// Announces new discoveries via push.
//
// Ciatta's premise is that it notices something about your body and tells
// you. Until this existed, a discovery could only be found by someone who
// happened to open the app — the notification preference collected during
// onboarding was written to the profile and never read by anything.
//
// Runs after the Understanding Engine on the nightly schedule. Each
// discovery is announced exactly once: `notified_at` is stamped after a
// successful send, and only rows where it is null are ever considered.
//
// service_role is used here, server-side only, exactly as everywhere else
// in this codebase — never sent to or stored in the client.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

Deno.serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const explicitUserId = body?.user_id as string | undefined;

    let query = supabase
      .from('discoveries')
      .select('id, user_id, narrative, status')
      .is('notified_at', null)
      .eq('status', 'pending');
    if (explicitUserId) query = query.eq('user_id', explicitUserId);

    const { data: pending, error: pendingError } = await query;
    if (pendingError) throw pendingError;

    if (!pending || pending.length === 0) {
      return json({ announced: 0, reason: 'nothing-pending' });
    }

    // One notification per user per run, even if several discoveries landed
    // at once — a burst of pushes about your own body would feel alarming.
    const byUser = new Map<string, typeof pending>();
    for (const d of pending) {
      const list = byUser.get(d.user_id as string) ?? [];
      list.push(d);
      byUser.set(d.user_id as string, list);
    }

    const messages: { to: string; title: string; body: string; data: unknown; channelId: string }[] = [];
    const announcedIds: string[] = [];

    for (const [userId, discoveries] of byUser) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('notification_preference, preferred_name')
        .eq('id', userId)
        .maybeSingle();

      // Respect the preference that was already being collected.
      if (!profile || profile.notification_preference === 'none') continue;

      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', userId);
      if (!tokens || tokens.length === 0) continue;

      const first = discoveries[0];
      const more = discoveries.length - 1;
      const body =
        more > 0
          ? `${first.narrative} (and ${more} more)`
          : (first.narrative as string);

      for (const t of tokens) {
        messages.push({
          to: t.token as string,
          title: "I've noticed something",
          body,
          data: { discoveryId: first.id },
          channelId: 'discoveries',
        });
      }
      for (const d of discoveries) announcedIds.push(d.id as string);
    }

    if (messages.length === 0) {
      return json({ announced: 0, reason: 'no-eligible-recipients' });
    }

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    const result = await res.json();
    const tickets: ExpoTicket[] = result?.data ?? [];

    // Drop tokens Expo tells us are dead, so they don't accumulate forever.
    const dead: string[] = [];
    tickets.forEach((t, i) => {
      if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') {
        dead.push(messages[i].to);
      }
    });
    if (dead.length > 0) {
      await supabase.from('push_tokens').delete().in('token', dead);
    }

    const anyDelivered = tickets.some((t) => t.status === 'ok');
    if (anyDelivered && announcedIds.length > 0) {
      const { error: stampError } = await supabase
        .from('discoveries')
        .update({ notified_at: new Date().toISOString() })
        .in('id', announcedIds);
      if (stampError) throw stampError;
    }

    return json({
      announced: anyDelivered ? announcedIds.length : 0,
      messages: messages.length,
      deadTokensRemoved: dead.length,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
