// The one place user-facing copy is stripped of dashes.
// Apply this to every string that can appear on screen, in a visit brief,
// or in a notification. Internal IDs, ISO timestamps, and CSS keys stay untouched.

const EM_OR_EN = /\s*[—–−]\s*/g;
const HYPHEN = /[-‐‑‒]/g;

export function displayCopy(value: string): string {
  return value
    .replace(EM_OR_EN, '. ')
    .replace(HYPHEN, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ \./g, '.')
    .trim();
}

export function displayCopyMaybe(value: string | null | undefined): string | null {
  if (value == null) return null;
  return displayCopy(value);
}

export function displayCopyList(values: string[] | null | undefined): string[] {
  return (values ?? []).map(displayCopy);
}

export const COPY_DASH = /[—–−‐‑‒-]/;
