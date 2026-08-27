import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii, type } from '../theme/tokens';
import BottomSheet from '../components/BottomSheet';
import PrimaryButton from '../components/PrimaryButton';
import { CloseIcon } from '../components/icons';
import { fetchHealthNote, saveHealthNote } from '../lib/healthNotes';

/**
 * Prompts for the seven "Your Health" rows. Each used to open a placeholder
 * reading "I'm still learning what matters most to show here", so every row
 * showed "Not shared yet" forever with no way to share anything.
 */
const PROMPTS: Record<string, { label: string; prompt: string }> = {
  cycle: {
    label: 'Cycle',
    prompt: 'Typical length, how regular it is, anything that tends to change around it.',
  },
  'medical-history': {
    label: 'Medical history',
    prompt: 'Past diagnoses, surgeries, or anything a clinician would want to know.',
  },
  conditions: {
    label: 'Health conditions',
    prompt: 'Anything ongoing you live with, diagnosed or suspected.',
  },
  medications: {
    label: 'Medications & supplements',
    prompt: 'What you take regularly, and roughly when you started.',
  },
  pregnancy: {
    label: 'Pregnancy history',
    prompt: 'Pregnancies, outcomes, or anything you want this picture to hold.',
  },
  'family-history': {
    label: 'Family history',
    prompt: "Conditions that run in your family, on either side.",
  },
  allergies: {
    label: 'Allergies',
    prompt: 'Foods, medications, environmental, and how they tend to show up.',
  },
};

export function isHealthNoteRow(rowId: string): boolean {
  return rowId in PROMPTS;
}

export default function HealthNoteSheet({
  rowId,
  userId,
  onClose,
  onSaved,
  onGuestSave,
}: {
  rowId: string | null;
  userId: string | null;
  onClose: () => void;
  onSaved: (rowId: string) => void;
  onGuestSave?: (rowId: string, text: string) => void;
}) {
  const spec = rowId ? PROMPTS[rowId] ?? null : null;
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!rowId || !userId || !spec) return;
    setLoading(true);
    setError(null);
    fetchHealthNote(userId, rowId)
      .then((existing) => {
        if (active) setValue(existing ?? '');
      })
      .catch(() => {
        if (active) setError("This couldn't be loaded just now.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [rowId, userId, spec]);

  async function handleSave() {
    if (!rowId) return;
    const text = value.trim();
    if (!userId) {
      onGuestSave?.(rowId, text);
      onSaved(rowId);
      onClose();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveHealthNote(userId, rowId, text);
      onSaved(rowId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet visible={!!spec} onClose={onClose}>
      {spec ? (
        <View>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{spec.label}</Text>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <CloseIcon />
            </Pressable>
          </View>

          <Text style={styles.prompt}>{spec.prompt}</Text>

          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={loading ? 'Loading…' : 'In your own words…'}
            placeholderTextColor={colors.ink3}
            style={styles.input}
            multiline
            editable={!loading}
            accessibilityLabel={spec.label}
          />

          <Text style={styles.privacy}>
            Only you can see this. It helps interpret the rest of your data more carefully.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ marginTop: 20 }}>
            <PrimaryButton label="Save" onPress={handleSave} loading={saving} disabled={loading} />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    ...type.title2,
    color: colors.ink,
    flex: 1,
    paddingRight: 12,
  },
  prompt: {
    ...fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink2,
    marginTop: 6,
  },
  input: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 130,
    textAlignVertical: 'top',
    ...fonts.sans,
    fontSize: 15.5,
    color: colors.ink,
  },
  privacy: {
    ...fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: colors.ink3,
    marginTop: 10,
  },
  error: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 10,
  },
});
