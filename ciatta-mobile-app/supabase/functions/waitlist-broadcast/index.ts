// Sends one email to every active waitlist subscriber, via Resend.
//
// Guarded deliberately hard, because the anon key is embedded in the public
// landing page bundle and Supabase's gateway happily accepts it. Anyone who
// viewed source could otherwise mail your entire list.
//
// The guard is a dedicated BROADCAST_SECRET rather than a comparison against
// the service role key, because the two key formats do not line up: the
// gateway rejects the new sb_secret keys outright, while the legacy JWT does
// not match what Supabase injects as SUPABASE_SERVICE_ROLE_KEY. A secret we
// own on both sides is immune to that churn.
//
// Every send is written to waitlist_broadcasts first. A duplicate launch
// announcement to the whole list is not a mistake you can take back, so there
// has to be a record of what already went out.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const resendKey = Deno.env.get('RESEND_API_KEY');
const broadcastSecret = Deno.env.get('BROADCAST_SECRET');
// Must be an address on a domain verified in Resend. An unverified sender is
// the single most common reason launch email lands in spam.
const fromAddress = Deno.env.get('WAITLIST_FROM') ?? 'Ciatta <hello@ciatta.app>';

const RESEND_BATCH_URL = 'https://api.resend.com/emails/batch';
// Resend's batch endpoint caps at 100 messages per call.
const BATCH_SIZE = 100;

interface Subscriber {
  email: string;
  unsubscribe_token: string;
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Length-independent comparison so a caller cannot narrow the secret by
// timing repeated requests.
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    if (!broadcastSecret) {
      return json({ error: 'BROADCAST_SECRET is not set on this project.' }, 500);
    }
    const presented = req.headers.get('x-broadcast-secret') ?? '';
    if (!secretsMatch(presented, broadcastSecret)) {
      return json({ error: 'Not authorised.' }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
    const html = typeof body.html === 'string' ? body.html : '';
    const dryRun = body.dryRun === true;

    if (!subject || !html) {
      return json({ error: 'subject and html are both required.' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Only ever the people who have not opted out.
    const { data: subs, error } = await supabase
      .from('waitlist')
      .select('email, unsubscribe_token')
      .is('unsubscribed_at', null);
    if (error) throw error;

    const recipients = (subs ?? []) as Subscriber[];
    if (recipients.length === 0) return json({ sent: 0, reason: 'no-active-subscribers' });

    // Deliberately before the Resend check: a dry run sends nothing, so it has
    // to work before the sending account exists. Checking the key first would
    // make the safety rehearsal impossible until it was too late to rehearse.
    if (dryRun) {
      return json({ dryRun: true, wouldSend: recipients.length, subject, from: fromAddress });
    }

    if (!resendKey) {
      return json({ error: 'RESEND_API_KEY is not set on this project.' }, 500);
    }

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const slice = recipients.slice(i, i + BATCH_SIZE);

      const messages = slice.map((r) => {
        const url = `${supabaseUrl}/functions/v1/waitlist-unsubscribe?token=${r.unsubscribe_token}`;
        return {
          from: fromAddress,
          to: [r.email],
          subject,
          // The footer is appended here rather than left to the caller, so a
          // message can never go out without a way off the list.
          html: `${html}
<hr style="border:none;border-top:1px solid #D7DEE6;margin:32px 0 16px">
<p style="font-family:system-ui,sans-serif;font-size:12px;color:#646E79;line-height:1.6">
You are receiving this because you joined the Ciatta waitlist.
<a href="${url}" style="color:#8C3A44">Unsubscribe</a>.
</p>`,
          headers: {
            // RFC 8058: lets mail clients offer a one-tap unsubscribe that
            // never opens a browser, which measurably reduces spam reports.
            'List-Unsubscribe': `<${url}>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        };
      });

      const res = await fetch(RESEND_BATCH_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (res.ok) {
        sent += slice.length;
      } else {
        failed += slice.length;
        console.error('resend batch failed', res.status, await res.text());
      }
    }

    await supabase
      .from('waitlist_broadcasts')
      .insert({ subject, recipients: sent, failed });

    return json({ sent, failed, subject });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
