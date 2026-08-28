export type HealthKitSyncTelemetry = {
  healthKitQueryMs: number;
  samplesFetched: number;
  samplesDeleted: number;
  typesQueried: number;
  typesWithNewSamples: number;
  normalizationMs: number;
  databaseWriteMs: number;
  intelligenceProcessingMs: number;
  totalMs: number;
  incremental: boolean;
};

export function emptyHealthKitTelemetry(): HealthKitSyncTelemetry {
  return {
    healthKitQueryMs: 0,
    samplesFetched: 0,
    samplesDeleted: 0,
    typesQueried: 0,
    typesWithNewSamples: 0,
    normalizationMs: 0,
    databaseWriteMs: 0,
    intelligenceProcessingMs: 0,
    totalMs: 0,
    incremental: false,
  };
}

export function elapsedMs(startedAt: number): number {
  return Math.max(0, Date.now() - startedAt);
}

export function logHealthKitTelemetry(telemetry: HealthKitSyncTelemetry): void {
  console.log('[healthkit] telemetry', telemetry);
}
