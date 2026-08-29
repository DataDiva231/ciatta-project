import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from '../theme/tokens';
import Card from './Card';
import GlassChip from './GlassChip';
import { GlassGroup } from './GlassSurface';
import PrimaryButton from './PrimaryButton';
import GhostButton from './GhostButton';
import type { TamponAbsorbency, TamponWearUnderstanding } from '../lib/tamponWear';

const ABSORBENCIES: TamponAbsorbency[] = ['light', 'regular', 'super', 'super plus'];

export default function TamponWearCard({
  understanding,
  bleedingNow,
  busy,
  onConfirmInserted,
  onConfirmRemoved,
}: {
  understanding: TamponWearUnderstanding;
  bleedingNow: boolean;
  busy: boolean;
  onConfirmInserted: (absorbency: TamponAbsorbency) => void;
  onConfirmRemoved: () => void;
}) {
  const [absorbency, setAbsorbency] = useState<TamponAbsorbency>('regular');
  const active = understanding.activeTimerState !== 'insufficient' && understanding.activeTimerState !== 'idle';

  if (!active && !bleedingNow) return null;

  if (!active) {
    return (
      <Card>
        <Text style={styles.label}>TAMPON</Text>
        <Text style={styles.body}>
          If you are using a tampon, share when you put it in. Ciatta times the
          check from that moment, not from a guess.
        </Text>
        <GlassGroup spacing={8} style={styles.chips}>
          {ABSORBENCIES.map((option) => (
            <GlassChip
              key={option}
              label={option}
              selected={absorbency === option}
              onPress={() => setAbsorbency(option)}
            />
          ))}
        </GlassGroup>
        <View style={{ marginTop: 14 }}>
          <PrimaryButton
            label="I put one in just now"
            onPress={() => onConfirmInserted(absorbency)}
            loading={busy}
          />
        </View>
      </Card>
    );
  }

  return (
    <Card>
      <Text style={styles.label}>TAMPON</Text>
      <Text style={styles.headline}>{understanding.narrative}</Text>
      <Text style={styles.safety}>{understanding.safetyLimitNote}</Text>
      <Text style={styles.meta}>{understanding.confidenceLabel}</Text>
      <GhostButton label="I took it out" tone="ink" onPress={onConfirmRemoved} />
    </Card>
  );
}

const styles = StyleSheet.create({
  label: {
    ...fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 10,
  },
  body: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.ink2,
  },
  headline: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.ink,
  },
  safety: {
    ...type.footnote,
    color: colors.ink3,
    marginTop: 10,
  },
  meta: {
    ...type.caption1,
    color: colors.ink3,
    marginTop: 6,
    marginBottom: 4,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
});
