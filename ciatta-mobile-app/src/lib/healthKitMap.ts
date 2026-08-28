export type HealthKitWindow = 'recent' | 'cycle';

export type QuantitySpec = {
  identifier: string;
  type: string;
  unit: string;
  valueKey: string;
  window: HealthKitWindow;
};

export type CategorySpec = {
  identifier: string;
  type: string;
  window: HealthKitWindow;
  mapValue: (value: number) => Record<string, unknown>;
};

export const QUANTITY_SPECS: readonly QuantitySpec[] = [
  { identifier: 'HKQuantityTypeIdentifierStepCount', type: 'steps', unit: 'count', valueKey: 'count', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierHeartRate', type: 'heart_rate', unit: 'count/min', valueKey: 'bpm', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierRestingHeartRate', type: 'resting_heart_rate', unit: 'count/min', valueKey: 'bpm', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', type: 'hrv', unit: 'ms', valueKey: 'ms', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierWalkingHeartRateAverage', type: 'walking_heart_rate_average', unit: 'count/min', valueKey: 'bpm', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierHeartRateRecoveryOneMinute', type: 'heart_rate_recovery', unit: 'count/min', valueKey: 'bpm', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierOxygenSaturation', type: 'oxygen_saturation', unit: '%', valueKey: 'percent', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierRespiratoryRate', type: 'respiratory_rate', unit: 'count/min', valueKey: 'breathsPerMinute', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierVO2Max', type: 'vo2_max', unit: 'ml/(kg*min)', valueKey: 'mlPerKgMin', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierBloodGlucose', type: 'blood_glucose', unit: 'mg/dL', valueKey: 'mgDl', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierBodyTemperature', type: 'body_temperature', unit: 'degC', valueKey: 'celsius', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierBasalBodyTemperature', type: 'basal_body_temperature', unit: 'degC', valueKey: 'celsius', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierAppleSleepingWristTemperature', type: 'wrist_temperature', unit: 'degC', valueKey: 'celsius', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierBloodPressureSystolic', type: 'blood_pressure_systolic', unit: 'mmHg', valueKey: 'mmHg', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierBloodPressureDiastolic', type: 'blood_pressure_diastolic', unit: 'mmHg', valueKey: 'mmHg', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierActiveEnergyBurned', type: 'active_energy', unit: 'kcal', valueKey: 'kcal', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierBasalEnergyBurned', type: 'basal_energy', unit: 'kcal', valueKey: 'kcal', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierDistanceWalkingRunning', type: 'distance_walking_running', unit: 'm', valueKey: 'meters', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierDistanceCycling', type: 'distance_cycling', unit: 'm', valueKey: 'meters', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierDistanceSwimming', type: 'distance_swimming', unit: 'm', valueKey: 'meters', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierFlightsClimbed', type: 'flights_climbed', unit: 'count', valueKey: 'count', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierAppleExerciseTime', type: 'exercise_time', unit: 'min', valueKey: 'minutes', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierAppleStandTime', type: 'stand_time', unit: 'min', valueKey: 'minutes', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierAppleMoveTime', type: 'move_time', unit: 'min', valueKey: 'minutes', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierSwimmingStrokeCount', type: 'swimming_stroke_count', unit: 'count', valueKey: 'count', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierBodyMass', type: 'body_mass', unit: 'kg', valueKey: 'kg', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierBodyMassIndex', type: 'body_mass_index', unit: 'count', valueKey: 'index', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierBodyFatPercentage', type: 'body_fat_percentage', unit: '%', valueKey: 'percent', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierHeight', type: 'height', unit: 'm', valueKey: 'meters', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierLeanBodyMass', type: 'lean_body_mass', unit: 'kg', valueKey: 'kg', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierWaistCircumference', type: 'waist_circumference', unit: 'm', valueKey: 'meters', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierWalkingSpeed', type: 'walking_speed', unit: 'm/s', valueKey: 'metersPerSecond', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierWalkingStepLength', type: 'walking_step_length', unit: 'm', valueKey: 'meters', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierWalkingAsymmetryPercentage', type: 'walking_asymmetry', unit: '%', valueKey: 'percent', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierWalkingDoubleSupportPercentage', type: 'walking_double_support', unit: '%', valueKey: 'percent', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierSixMinuteWalkTestDistance', type: 'six_minute_walk_distance', unit: 'm', valueKey: 'meters', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierStairAscentSpeed', type: 'stair_ascent_speed', unit: 'm/s', valueKey: 'metersPerSecond', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierStairDescentSpeed', type: 'stair_descent_speed', unit: 'm/s', valueKey: 'metersPerSecond', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierAppleWalkingSteadiness', type: 'walking_steadiness', unit: '%', valueKey: 'percent', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierRunningStrideLength', type: 'running_stride_length', unit: 'm', valueKey: 'meters', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierRunningPower', type: 'running_power', unit: 'W', valueKey: 'watts', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierRunningSpeed', type: 'running_speed', unit: 'm/s', valueKey: 'metersPerSecond', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierAtrialFibrillationBurden', type: 'atrial_fibrillation_burden', unit: '%', valueKey: 'percent', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierForcedVitalCapacity', type: 'forced_vital_capacity', unit: 'L', valueKey: 'liters', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierForcedExpiratoryVolume1', type: 'forced_expiratory_volume_1', unit: 'L', valueKey: 'liters', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierPeakExpiratoryFlowRate', type: 'peak_expiratory_flow', unit: 'L/min', valueKey: 'litersPerMinute', window: 'cycle' },
  { identifier: 'HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances', type: 'sleeping_breathing_disturbances', unit: 'count', valueKey: 'count', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierPeripheralPerfusionIndex', type: 'peripheral_perfusion_index', unit: '%', valueKey: 'percent', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierNumberOfTimesFallen', type: 'times_fallen', unit: 'count', valueKey: 'count', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierTimeInDaylight', type: 'time_in_daylight', unit: 'min', valueKey: 'minutes', window: 'recent' },
  { identifier: 'HKQuantityTypeIdentifierPhysicalEffort', type: 'physical_effort', unit: 'kcal/(kg*hr)', valueKey: 'kcalPerHourKg', window: 'recent' },
];

export function sleepStageLabel(value: number): string {
  switch (value) {
    case 0:
      return 'in_bed';
    case 2:
      return 'awake';
    case 3:
      return 'asleep_core';
    case 4:
      return 'asleep_deep';
    case 5:
      return 'asleep_rem';
    default:
      return 'asleep';
  }
}

export function menstrualFlowLabel(value: number): string {
  switch (value) {
    case 2:
      return 'light';
    case 3:
      return 'medium';
    case 4:
      return 'heavy';
    case 5:
      return 'none';
    default:
      return 'unspecified';
  }
}

function enumLabel(table: Record<number, string>, value: number): string {
  return table[value] ?? 'unspecified';
}

export const CATEGORY_SPECS: readonly CategorySpec[] = [
  {
    identifier: 'HKCategoryTypeIdentifierSleepAnalysis',
    type: 'sleep_segment',
    window: 'recent',
    mapValue: (value) => ({ durationMinutes: 0, stage: sleepStageLabel(value) }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierMenstrualFlow',
    type: 'menstrual_flow',
    window: 'cycle',
    mapValue: (value) => ({ flow: menstrualFlowLabel(value) }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierIntermenstrualBleeding',
    type: 'intermenstrual_bleeding',
    window: 'cycle',
    mapValue: () => ({ present: true }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierCervicalMucusQuality',
    type: 'cervical_mucus_quality',
    window: 'cycle',
    mapValue: (value) => ({
      quality: enumLabel(
        { 1: 'dry', 2: 'sticky', 3: 'creamy', 4: 'watery', 5: 'egg_white' },
        value
      ),
    }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierOvulationTestResult',
    type: 'ovulation_test_result',
    window: 'cycle',
    mapValue: (value) => ({
      result: enumLabel(
        { 1: 'negative', 2: 'lh_surge', 3: 'indeterminate', 4: 'estrogen_surge' },
        value
      ),
    }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierSexualActivity',
    type: 'sexual_activity',
    window: 'cycle',
    mapValue: () => ({ present: true }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierPregnancy',
    type: 'pregnancy',
    window: 'cycle',
    mapValue: () => ({ present: true }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierLactation',
    type: 'lactation',
    window: 'cycle',
    mapValue: () => ({ present: true }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierContraceptive',
    type: 'contraceptive',
    window: 'cycle',
    mapValue: (value) => ({
      method: enumLabel(
        {
          1: 'unspecified',
          2: 'implant',
          3: 'injection',
          4: 'iud',
          5: 'ring',
          6: 'oral',
          7: 'patch',
        },
        value
      ),
    }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierPregnancyTestResult',
    type: 'pregnancy_test_result',
    window: 'cycle',
    mapValue: (value) => ({
      result: enumLabel({ 1: 'negative', 2: 'positive', 3: 'indeterminate' }, value),
    }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierProgesteroneTestResult',
    type: 'progesterone_test_result',
    window: 'cycle',
    mapValue: (value) => ({
      result: enumLabel({ 1: 'negative', 2: 'positive', 3: 'indeterminate' }, value),
    }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierAppleStandHour',
    type: 'stand_hour',
    window: 'recent',
    mapValue: (value) => ({ stood: value === 0 }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierHighHeartRateEvent',
    type: 'high_heart_rate_event',
    window: 'recent',
    mapValue: () => ({ present: true }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierLowHeartRateEvent',
    type: 'low_heart_rate_event',
    window: 'recent',
    mapValue: () => ({ present: true }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierIrregularHeartRhythmEvent',
    type: 'irregular_heart_rhythm_event',
    window: 'recent',
    mapValue: () => ({ present: true }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierLowCardioFitnessEvent',
    type: 'low_cardio_fitness_event',
    window: 'cycle',
    mapValue: () => ({ present: true }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierAppleWalkingSteadinessEvent',
    type: 'walking_steadiness_event',
    window: 'cycle',
    mapValue: (value) => ({ category: value }),
  },
  {
    identifier: 'HKCategoryTypeIdentifierMindfulSession',
    type: 'mindful_session',
    window: 'recent',
    mapValue: () => ({ present: true }),
  },
];

export const WORKOUT_TYPE_IDENTIFIER = 'HKWorkoutTypeIdentifier';

export const HEALTHKIT_READ_IDENTIFIERS: readonly string[] = [
  ...QUANTITY_SPECS.map((spec) => spec.identifier),
  ...CATEGORY_SPECS.map((spec) => spec.identifier),
  WORKOUT_TYPE_IDENTIFIER,
];

export const ORIGINAL_HEALTHKIT_TYPES = [
  'steps',
  'heart_rate',
  'sleep_segment',
  'resting_heart_rate',
  'menstrual_flow',
  'hrv',
] as const;

export function storedQuantityUnit(spec: QuantitySpec): string {
  if (spec.valueKey === 'bpm') return 'bpm';
  if (spec.unit === 'degC') return 'celsius';
  return spec.unit;
}

export function measurementContext(
  identifier: string,
  extras: Record<string, unknown> = {}
): Record<string, unknown> {
  return { identifier, ...extras };
}

export type SampleProvenanceInput = {
  uuid?: string;
  startDate?: Date;
  endDate?: Date;
  metadata?: Record<string, unknown>;
  device?: {
    name?: string;
    manufacturer?: string;
    model?: string;
    hardwareVersion?: string;
    softwareVersion?: string;
  };
  sourceRevision?: {
    version?: string;
    productType?: string;
    source?: {
      name?: string;
      bundleIdentifier?: string;
      toJSON?: (key?: string) => { name?: string; bundleIdentifier?: string };
    };
  };
};

export function provenanceFromSample(sample: SampleProvenanceInput): Record<string, unknown> {
  const src = sample.sourceRevision?.source;
  let sourceName: string | undefined;
  let sourceBundle: string | undefined;
  try {
    const json = src && typeof src.toJSON === 'function' ? src.toJSON() : src;
    sourceName = json?.name;
    sourceBundle = json?.bundleIdentifier;
  } catch {
    sourceName = src?.name;
    sourceBundle = src?.bundleIdentifier;
  }

  const provenance: Record<string, unknown> = {};
  if (sample.uuid) provenance.uuid = sample.uuid;
  if (sourceName) provenance.sourceName = sourceName;
  if (sourceBundle) provenance.sourceBundle = sourceBundle;
  if (sample.sourceRevision?.productType) provenance.productType = sample.sourceRevision.productType;
  if (sample.sourceRevision?.version) provenance.sourceVersion = sample.sourceRevision.version;
  if (sample.device?.name) provenance.deviceName = sample.device.name;
  if (sample.device?.manufacturer) provenance.deviceManufacturer = sample.device.manufacturer;
  if (sample.device?.model) provenance.deviceModel = sample.device.model;
  if (sample.device?.hardwareVersion) provenance.deviceHardware = sample.device.hardwareVersion;
  if (sample.device?.softwareVersion) provenance.deviceSoftware = sample.device.softwareVersion;
  return provenance;
}

export function mergeObservationContext(
  sample: SampleProvenanceInput,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return { ...extra, ...provenanceFromSample(sample) };
}

export function workoutDurationMinutes(
  duration: { unit?: string; quantity?: number } | undefined,
  startDate: Date,
  endDate: Date
): number {
  if (duration && typeof duration.quantity === 'number') {
    const unit = duration.unit ?? 's';
    if (unit === 's' || unit === 'sec' || unit === 'second') return duration.quantity / 60;
    if (unit === 'min' || unit === 'minute') return duration.quantity;
    if (unit === 'hr' || unit === 'hour') return duration.quantity * 60;
    return duration.quantity;
  }
  return (endDate.getTime() - startDate.getTime()) / 60000;
}
