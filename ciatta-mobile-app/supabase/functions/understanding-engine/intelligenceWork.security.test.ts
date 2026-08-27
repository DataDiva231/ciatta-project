import { assert, assertEquals } from 'jsr:@std/assert@1';

const MIGRATION = new URL(
  '../../migrations/20260831000000_continuous_intelligence.sql',
  import.meta.url
);

Deno.test('intelligence_work: RLS is on, clients have no policies, only service_role is granted', async () => {
  const sql = await Deno.readTextFile(MIGRATION);
  assert(sql.includes('alter table public.intelligence_work enable row level security'));
  assert(sql.includes('revoke all on public.intelligence_work from public, anon, authenticated'));
  assert(sql.includes('grant all on public.intelligence_work to service_role'));
  assertEquals(/create policy/i.test(sql), false);
});

Deno.test('intelligence_work: the queue is keyed per user so two accounts cannot share a row', async () => {
  const sql = await Deno.readTextFile(MIGRATION);
  assert(sql.includes('user_id uuid primary key references auth.users (id) on delete cascade'));
});

Deno.test('intelligence_work: enqueue is SECURITY DEFINER with a pinned search_path (trigger cannot be hijacked)', async () => {
  const sql = await Deno.readTextFile(MIGRATION);
  assert(sql.includes('security definer'));
  assert(sql.includes('set search_path = public'));
});
