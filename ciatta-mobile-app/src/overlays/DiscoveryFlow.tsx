import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme/tokens';
import type { DiscoveryRow } from '../lib/queries';
import PrimaryButton from '../components/PrimaryButton';
import ConfidenceBar from '../components/ConfidenceBar';

type Step = 1 | 2 | 3;

export default function DiscoveryFlow({
  visible,
  discovery,
  onNameDiscovery,
  onDone,
}: {
  visible: boolean;
  discovery: DiscoveryRow | null;
  onNameDiscovery: (name: string) => Promise<void>;
  onDone: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [custom, setCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function reset() {
    setStep(1);
    setSelected(null);
    setCustom('');
    setSaveError(null);
  }

  function close() {
    reset();
    onDone();
  }

  const finalName = selected === 'custom' ? custom.trim() : selected;

  async function handleFinish() {
    if (!finalName) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onNameDiscovery(finalName);
      close();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "That didn't save — try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!discovery) return null;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={close}>
      <View
        style={[
          StyleSheet.absoluteFill,
          styles.flex,
          styles.light,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
        ]}
      >
        {step === 1 && (
          <View style={styles.flex}>
            <Text style={styles.brand}>CIATTA</Text>
            <View style={styles.star} />
            <Text style={styles.announceTitle}>A new{'\n'}discovery</Text>
            <Text style={styles.announceBody}>{discovery.narrative}</Text>
            <Text style={styles.announceFooter}>
              I think it's strong enough to become part of your story.
            </Text>
            <View style={{ flex: 1 }} />
            <PrimaryButton label="Continue" onPress={() => setStep(2)} />
          </View>
        )}

        {step === 2 && (
          <View style={styles.flex}>
            <Text style={styles.title}>What would you{'\n'}call this?</Text>
            <Text style={styles.subtitle}>
              Choose a name that feels right, or create your own.
            </Text>
            <View style={{ marginTop: 28, gap: 12 }}>
              {discovery.suggested_names.map((name) => (
                <Pressable
                  key={name}
                  onPress={() => setSelected(name)}
                  style={[styles.nameOption, selected === name && styles.nameOptionActive]}
                >
                  <Text style={styles.nameOptionText}>{name}</Text>
                </Pressable>
              ))}
              <View
                style={[
                  styles.nameOption,
                  selected === 'custom' && styles.nameOptionActive,
                ]}
              >
                <TextInput
                  value={custom}
                  onChangeText={(t) => {
                    setCustom(t);
                    setSelected('custom');
                  }}
                  onFocus={() => setSelected('custom')}
                  placeholder="Create my own"
                  placeholderTextColor={colors.ink3}
                  style={styles.nameInput}
                />
              </View>
            </View>
            <View style={{ flex: 1 }} />
            <PrimaryButton
              label="Continue"
              disabled={!finalName}
              onPress={() => setStep(3)}
            />
          </View>
        )}

        {step === 3 && finalName && (
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>YOUR DISCOVERY</Text>
            <Text style={styles.discoveryName}>{finalName}</Text>
            <Text style={styles.discoveryDate}>First discovered today</Text>
            <View style={styles.discoveryBox}>
              <Text style={styles.discoveryNarrative}>{discovery.narrative}</Text>
              {discovery.detail ? (
                <Text style={styles.discoveryDetail}>{discovery.detail}</Text>
              ) : null}
            </View>
            <ConfidenceBar
              value={Math.round((discovery.confidence ?? 0) * 100)}
              label={discovery.confidence_label ?? undefined}
            />
            {saveError ? <Text style={styles.saveError}>{saveError}</Text> : null}
            <View style={{ flex: 1 }} />
            <PrimaryButton label="See in Core" onPress={handleFinish} loading={saving} />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingHorizontal: 26 },
  light: { backgroundColor: colors.canvas },

  brand: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    letterSpacing: 2,
    color: colors.ink3,
    marginTop: 12,
  },
  star: {
    width: 8,
    height: 8,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginTop: 28,
    transform: [{ rotate: '45deg' }],
  },
  announceTitle: {
    fontFamily: fonts.serif,
    fontSize: 42,
    lineHeight: 48,
    color: colors.ink,
    marginTop: 28,
  },
  announceBody: {
    fontFamily: fonts.sans,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink2,
    marginTop: 22,
  },
  announceFooter: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink3,
    marginTop: 14,
  },

  title: {
    fontFamily: fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    color: colors.ink,
    marginTop: 20,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 10,
  },
  nameOption: {
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  nameOptionActive: {
    borderColor: colors.accent,
  },
  nameOptionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink,
  },
  nameInput: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink,
    padding: 0,
  },

  eyebrow: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.ink3,
    marginTop: 16,
  },
  discoveryName: {
    fontFamily: fonts.serif,
    fontSize: 34,
    color: colors.ink,
    marginTop: 8,
  },
  discoveryDate: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink3,
    marginTop: 6,
  },
  discoveryBox: {
    marginTop: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 18,
  },
  discoveryNarrative: {
    fontFamily: fonts.serif,
    fontSize: 19,
    lineHeight: 25,
    color: colors.ink,
  },
  discoveryDetail: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.ink2,
    marginTop: 10,
  },
  saveError: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 14,
  },
});
