// One-click unsubscribe for waitlist emails.
//
// Must be callable with no credentials — it is a link in an email, opened by
// someone who by definition does not have an account. That is why config.toml
// sets verify_jwt = false for this function. The token in the URL is the only
// authorisation, which is why it is a per-row uuid and not the email address:
// addresses leak through referrer headers, proxy logs and forwarded links.
//
// Responds to POST as well as GET so it satisfies RFC 8058 one-click, which
// mail clients use to unsubscribe without ever opening a browser.
import { createClient } from 'npm:@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

function page(title: string, body: string, status = 200) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#F6F8FA;color:#1B2127;font-family:system-ui,-apple-system,sans-serif;padding:24px}
  .card{background:#fff;border:1px solid #D7DEE6;border-radius:22px;padding:40px;
        max-width:420px;box-shadow:0 8px 40px rgba(27,33,39,.06);text-align:center}
  h1{font-family:Georgia,serif;font-weight:400;font-size:26px;margin:0 0 12px}
  p{margin:0;color:#55606B;line-height:1.7;font-size:15px}
</style></head><body><div class="card"><h1>${title}</h1><p>${body}</p></div></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

Deno.serve(async (req) => {
  try {
    const token = new URL(req.url).searchParams.get('token');
    if (!token) return page('Link incomplete', 'This unsubscribe link is missing its token.', 400);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await supabase
      .from('waitlist')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
      .is('unsubscribed_at', null)
      .select('email');

    if (error) throw error;

    // No row updated means either an unknown token or one already used. Both
    // get the same answer: never reveal whether a token is real.
    if (!data || data.length === 0) {
      return page("You're unsubscribed", "You won't receive any more email from Ciatta.");
    }
    return page("You're unsubscribed", "You won't receive any more email from Ciatta. Sorry to see you go.");
  } catch {
    return page('Something went wrong', 'Try the link again in a moment.', 500);
  }
});
