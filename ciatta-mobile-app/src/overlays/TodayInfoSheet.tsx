// What the Today screen is, explained on demand.
//
// The screen shows a conclusion ("what I'm noticing") without showing the
// work behind it. That is the right default — the work is the Core screen's
// job — but a reader who wants to know where the sentence came from has
// nowhere to ask. This is that answer, and it uses the reader's own totals
// rather than describing the system in the abstract.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from '../theme/tokens';
import BottomSheet from '../components/BottomSheet';
import GhostButton from '../components/GhostButton';
import type { UnderstandingRow } from '../lib/queries';

export default function TodayInfoSheet({
  visible,
  understandings,
  onClose,
}: {
  visible: boolean;
  understandings: UnderstandingRow[];
  onClose: () => void;
}) {
  const total = understandings.reduce((n, u) => n + (u.observations_count ?? 0), 0);
  const formed = understandings.length;

  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightPct={0.7}>
      <Text style={styles.eyebrow}>ABOUT TODAY</Text>
      <Text style={styles.title}>Where this comes from.</Text>

      <Text style={styles.body}>
        Everything on this screen is drawn from what you've shared and what
        your devices have recorded, never from averages for people like you.
      </Text>

      {formed > 0 ? (
        <View style={styles.stats}>
          <Stat value={String(total)} label={total === 1 ? 'observation' : 'observations'} />
          <Stat
            value={String(formed)}
            label={formed === 1 ? 'understanding' : 'understandings'}
          />
        </View>
      ) : null}

      <Text style={styles.body}>
        The understanding shown is whichever one changed most recently. The
        priority beneath it is either an action anchored to something measured,
        or the open question that would sharpen this picture. If neither is
        available, nothing appears there. Better to say less than guess.
      </Text>

      <Text style={styles.body}>
        Open <Text style={styles.emphasis}>Core</Text> to see every understanding,
        the evidence behind it, and how each one has changed over time.
      </Text>

      <GhostButton label="Close" onPress={onClose} />
    </BottomSheet>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    ...fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 8,
  },
  title: {
    ...type.title2,
    color: colors.ink,
    marginBottom: 16,
  },
  body: {
    ...fonts.sans,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.ink2,
    marginBottom: 16,
  },
  emphasis: {
    ...fonts.sansSemiBold,
    color: colors.ink,
  },
  stats: {
    flexDirection: 'row',
    gap: 28,
    marginBottom: 20,
  },
  stat: {},
  statValue: {
    ...fonts.mono,
    fontSize: 20,
    color: colors.evidence,
  },
  statLabel: {
    ...fonts.sans,
    fontSize: 12,
    color: colors.ink3,
    marginTop: 2,
  },
});
