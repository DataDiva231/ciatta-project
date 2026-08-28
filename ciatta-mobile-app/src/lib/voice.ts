// User-facing voice. Presentation only: these strings never infer, invent
// evidence, or change what the Intelligence Engine already wrote.
// Never use an em dash, en dash, or hyphen in copy.

import type { Strength } from './types';
import { todayHeadline } from './intelligenceStatus';

export function domainUnderstandingTitle(domainWord: string, strength?: Strength): string {
  return todayHeadline(domainWord, strength ?? 'emerging');
}
