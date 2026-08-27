// User-facing voice. Presentation only: these strings never infer, invent
// evidence, or change what the Intelligence Engine already wrote.
// Never use an em dash, en dash, or hyphen in copy.

export function domainUnderstandingTitle(domainWord: string): string {
  return `What's taking shape in your ${domainWord.toLowerCase()}`;
}
