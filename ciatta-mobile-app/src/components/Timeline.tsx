import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';

export interface TimelineStep {
  label: string;
  detail: string;
  active?: boolean;
}

export default function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <View>
      {steps.map((step, i) => (
        <View key={step.label} style={styles.row}>
          <View style={styles.rail}>
            <View
              style={[
                styles.node,
                step.active ? styles.nodeActive : styles.nodeInactive,
              ]}
            />
            {i < steps.length - 1 ? <View style={styles.line} /> : null}
          </View>
          <View style={styles.textCol}>
            <Text
              style={[styles.label, step.active && { color: colors.accent }]}
            >
              {step.label}
            </Text>
            <Text style={styles.detail}>{step.detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  rail: {
    width: 20,
    alignItems: 'center',
  },
  node: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 4,
  },
  nodeActive: {
    backgroundColor: colors.accent,
  },
  nodeInactive: {
    backgroundColor: 'transparent',
    borderWidth: 1.4,
    borderColor: colors.ink3,
  },
  line: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  textCol: {
    flex: 1,
    paddingBottom: 20,
    paddingLeft: 12,
  },
  label: {
    ...fonts.sansMedium,
    fontSize: 13.5,
    color: colors.ink,
  },
  detail: {
    ...fonts.sans,
    fontSize: 13.5,
    color: colors.ink2,
    marginTop: 2,
    lineHeight: 19,
  },
});
