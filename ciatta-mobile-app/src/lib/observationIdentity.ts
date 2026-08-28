export type ObservationIdentityInput = {
  source: string;
  type: string;
  recordedAt: string;
  sourceSampleId?: string | null;
};

export function observationIdentity(input: ObservationIdentityInput): {
  source: string;
  sourceSampleId: string;
} {
  const native = input.sourceSampleId?.trim();
  return {
    source: input.source,
    sourceSampleId: native && native.length > 0
      ? native
      : `legacy:${input.type}:${input.recordedAt}`,
  };
}

export function isMissingSourceSampleIdColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42703' || error.code === 'PGRST204') return true;
  return /source_sample_id/i.test(error.message ?? '');
}

export function isMissingOnConflictConstraint(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P10') return true;
  return /no unique or exclusion constraint matching the ON CONFLICT/i.test(error.message ?? '');
}
