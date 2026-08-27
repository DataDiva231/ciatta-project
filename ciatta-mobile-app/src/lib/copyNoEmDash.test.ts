// Permanent Ciatta copy rule: no em dash, en dash, or hyphen in user-facing copy.
//   deno test --allow-read --sloppy-imports src/lib/copyNoEmDash.test.ts
import { assert, assertEquals } from 'jsr:@std/assert@1';
import { COPY_DASH, displayCopy, displayCopyList, displayCopyMaybe } from './displayCopy.ts';

const COPY_FILES = [
  'src/lib/voice.ts',
  'src/lib/displayCopy.ts',
  'src/lib/tamponWear.ts',
  'src/components/TamponWearCard.tsx',
  'src/lib/priority.ts',
  'src/lib/careConnection.ts',
  'src/lib/mockData.ts',
  'src/lib/curiosity.ts',
  'src/lib/queries.ts',
  'src/lib/onboardingSetup.ts',
  'src/lib/calendarContext.ts',
  'src/screens/TodayScreen.tsx',
  'src/screens/CoreScreen.tsx',
  'src/screens/YouScreen.tsx',
  'src/screens/onboarding/OnboardingFlow.tsx',
  'src/screens/onboarding/OnboardingSetupSteps.tsx',
  'src/screens/onboarding/ConversationOnboarding.tsx',
  'src/overlays/UnderstandingSheet.tsx',
  'src/overlays/TodayInfoSheet.tsx',
  'src/overlays/HealthSyncSheet.tsx',
  'src/overlays/DataPrivacySheet.tsx',
  'src/overlays/ProviderSearchSheet.tsx',
  'src/overlays/DiscoveryFlow.tsx',
  'src/overlays/CuriosityOverlay.tsx',
  'src/overlays/ProfileEditSheet.tsx',
  'src/overlays/HealthNoteSheet.tsx',
  'src/overlays/DiscoveryDetailSheet.tsx',
  'src/components/SocialAuthButtons.tsx',
  'src/components/BottomNav.tsx',
  'src/components/CuriosityCard.tsx',
  'src/components/GlassChip.tsx',
  'App.tsx',
  'app.json',
  'supabase/functions/understanding-engine/careGuidance.ts',
  'supabase/functions/understanding-engine/contextualUnderstanding.ts',
  'supabase/functions/understanding-engine/crossDomainSynthesis.ts',
  'supabase/functions/understanding-engine/moodAnalysis.ts',
  'supabase/functions/understanding-engine/cycleAnalysis.ts',
  'supabase/functions/understanding-engine/energyRelationship.ts',
  'supabase/functions/understanding-engine/sleepAnalysis.ts',
  'supabase/functions/understanding-engine/stepsAnalysis.ts',
  'supabase/functions/understanding-engine/hrvAnalysis.ts',
  'supabase/functions/understanding-engine/dailyMetricRatingRelationship.ts',
  'supabase/functions/understanding-engine/index.ts',
  'supabase/functions/notify-discoveries/index.ts',
];

const IDENTIFIER = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ].*)?$/;
const URL_OR_PATH = /^(https?:\/\/|exp\+|\/|\.\/|\.\.\/)/;

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
}

function canStartSingleQuote(source: string, index: number): boolean {
  let j = index - 1;
  while (j >= 0 && /\s/.test(source[j])) j--;
  if (j < 0) return false;
  if ('=([{:;,!?~*&|+'.includes(source[j])) return true;
  const before = source.slice(Math.max(0, j - 6), j + 1);
  return /\b(return|throw|case|from|of|in|as)$/.test(before);
}

function extractCopyStrings(source: string): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "'" && !canStartSingleQuote(source, i)) {
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c;
      i++;
      let buf = '';
      while (i < source.length) {
        if (quote === '`' && source[i] === '$' && source[i + 1] === '{') {
          chunks.push(buf);
          buf = '';
          let depth = 1;
          i += 2;
          while (i < source.length && depth > 0) {
            if (source[i] === '{') depth++;
            else if (source[i] === '}') depth--;
            i++;
          }
          continue;
        }
        if (source[i] === '\\') {
          buf += source[i] + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (source[i] === quote) {
          i++;
          break;
        }
        buf += source[i++];
      }
      chunks.push(buf);
      continue;
    }
    i++;
  }
  return chunks;
}

function isInternalToken(str: string): boolean {
  const t = str.trim();
  if (!t) return true;
  if (t === '-' || t === '/-/g' || t === '/ /g') return true;
  if (IDENTIFIER.test(t)) return true;
  if (ISO_DATE.test(t)) return true;
  if (URL_OR_PATH.test(t)) return true;
  if (t.startsWith('android.permission.')) return true;
  if (!/\s/.test(t) && t.includes('-')) return true;
  return false;
}

Deno.test('displayCopy strips em dashes, en dashes, and hyphens', () => {
  assertEquals(
    displayCopy('Your sleep has been shorter — recovery is still in range.'),
    'Your sleep has been shorter. recovery is still in range.'
  );
  assertEquals(displayCopy('Cycle-related patterns'), 'Cycle related patterns');
  assertEquals(displayCopy('low-activity day'), 'low activity day');
  assertEquals(displayCopy('212-677-1000'), '212 677 1000');
  assertEquals(displayCopy('2026-08-01'), '2026 08 01');
  assertEquals(displayCopyMaybe(null), null);
  assertEquals(displayCopyList(['1-2 nights', 'check-ins']), ['1 2 nights', 'check ins']);
  assert(!COPY_DASH.test(displayCopy('A — B – C-D')));
});

Deno.test('user-facing copy files contain no em dash, en dash, or hyphen', () => {
  const hits: string[] = [];
  for (const rel of COPY_FILES) {
    const text = Deno.readTextFileSync(new URL(`../../${rel}`, import.meta.url));
    const scanned = withoutComments(text);
    for (const str of extractCopyStrings(scanned)) {
      if (isInternalToken(str)) continue;
      if (COPY_DASH.test(str)) hits.push(`${rel} ("${str.trim().slice(0, 80)}")`);
    }
    if (rel.endsWith('.tsx')) {
      for (const m of scanned.matchAll(/>([^<>{]+)</g)) {
        const textNode = m[1];
        if (COPY_DASH.test(textNode)) hits.push(`${rel} (JSX "${textNode.trim().slice(0, 80)}")`);
      }
    }
  }
  assert(hits.length === 0, `dash found in user-facing copy: ${hits.join('; ')}`);
});

Deno.test('read paths sanitize stored copy before it can render', () => {
  const queries = Deno.readTextFileSync(new URL('./queries.ts', import.meta.url));
  const curiosity = Deno.readTextFileSync(new URL('./curiosity.ts', import.meta.url));
  const visitPrep = Deno.readTextFileSync(new URL('./visitPrep.ts', import.meta.url));
  assert(queries.includes('displayCopy(row.narrative)'));
  assert(curiosity.includes('displayCopy(row.question)'));
  assert(visitPrep.includes('displayCopy(input.narrative)'));
});
