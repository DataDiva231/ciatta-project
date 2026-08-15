import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii } from '../theme/tokens';
import type { Profile } from '../lib/types';
import BottomSheet from '../components/BottomSheet';
import PrimaryButton from '../components/PrimaryButton';
import { CloseIcon } from '../components/icons';

type FieldKind = 'text' | 'longtext' | 'date' | 'choice' | 'list';

interface FieldSpec {
  key: keyof Profile;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  helper?: string;
  choices?: string[];
}

/**
 * Every editable row in the You screen, keyed by the row id it is opened
 * from. These rows previously all opened the same "I'm still learning what
 * matters most to show here" placeholder — nothing captured at onboarding
 * could be corrected afterwards.
 */
export const PROFILE_FIELDS: Record<string, FieldSpec> = {
  identity: {
    key: 'name',
    label: 'Your name',
    kind: 'text',
    placeholder: 'What should I call you?',
  },
  'life-stage': {
    key: 'life_stage',
    label: 'Life stage',
    kind: 'choice',
    choices: [
      'Cycling',
      'Trying to conceive',
      'Pregnant',
      'Postpartum',
      'Perimenopause',
      'Menopause',
      'Post-menopause',
    ],
    helper: 'This shapes what I look for in your data.',
  },
  goals: {
    key: 'goals',
    label: 'Goals & focus',
    kind: 'list',
    placeholder: 'One per line',
    helper: 'What you want me to pay attention to. One per line.',
  },
  about: {
    key: 'about',
    label: 'About you',
    kind: 'longtext',
    placeholder: 'Anything that helps me understand your everyday life',
  },
  dob: {
    key: 'dob',
    label: 'Date of birth',
    kind: 'date',
    placeholder: 'YYYY-MM-DD',
    helper: 'Used to interpret what is typical for your age.',
  },
  pronouns: {
    key: 'pronouns',
    label: 'Pronouns',
    kind: 'text',
    placeholder: 'she/her',
  },
};

function toInput(profile: Profile, spec: FieldSpec): string {
  const raw = profile[spec.key];
  if (spec.kind === 'list') return Array.isArray(raw) ? raw.join('\n') : '';
  return typeof raw === 'string' ? raw : '';
}

export default function ProfileEditSheet({
  rowId,
  profile,
  onClose,
  onSave,
}: {
  rowId: string | null;
  profile: Profile | null;
  onClose: () => void;
  onSave: (patch: Partial<Profile>) => Promise<void>;
}) {
  const spec = rowId ? PROFILE_FIELDS[rowId] ?? null : null;
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (spec && profile) {
      setValue(toInput(profile, spec));
      setError(null);
    }
  }, [spec, profile]);

  const dateInvalid = useMemo(() => {
    if (!spec || spec.kind !== 'date') return false;
    const t = value.trim();
    if (!t) return false;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return true;
    const d = new Date(t);
    return Number.isNaN(d.getTime()) || d > new Date();
  }, [spec, value]);

  async function handleSave() {
    if (!spec || dateInvalid) return;
    setSaving(true);
    setError(null);
    try {
      const trimmed = value.trim();
      const patch: Partial<Profile> =
        spec.kind === 'list'
          ? ({ [spec.key]: trimmed ? trimmed.split('\n').map((l) => l.trim()).filter(Boolean) : [] } as Partial<Profile>)
          : ({ [spec.key]: trimmed || null } as Partial<Profile>);
      await onSave(patch);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't save — try again.");
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
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <CloseIcon />
            </Pressable>
          </View>

          {spec.helper ? <Text style={styles.helper}>{spec.helper}</Text> : null}

          {spec.kind === 'choice' ? (
            <View style={styles.choices}>
              {spec.choices?.map((c) => {
                const active = value.toLowerCase() === c.toLowerCase();
                return (
                  <Pressable
                    key={c}
                    onPress={() => setValue(c)}
                    accessibilityRole="button"
                    accessibilityLabel={c}
                    accessibilityState={{ selected: active }}
                    style={[styles.choice, active && styles.choiceActive]}
                  >
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              value={value}
              onChangeText={setValue}
              placeholder={spec.placeholder}
              placeholderTextColor={colors.ink3}
              style={[
                styles.input,
                (spec.kind === 'longtext' || spec.kind === 'list') && styles.inputTall,
                dateInvalid && styles.inputError,
              ]}
              multiline={spec.kind === 'longtext' || spec.kind === 'list'}
              autoCapitalize={spec.kind === 'date' ? 'none' : 'sentences'}
              accessibilityLabel={spec.label}
            />
          )}

          {dateInvalid ? (
            <Text style={styles.error}>Use YYYY-MM-DD, and a date that has already happened.</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={{ marginTop: 22 }}>
            <PrimaryButton
              label="Save"
              onPress={handleSave}
              loading={saving}
              disabled={dateInvalid}
            />
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
    fontFamily: fonts.serif,
    fontSize: 27,
    color: colors.ink,
    flex: 1,
    paddingRight: 12,
  },
  helper: {
    fontFamily: fonts.sans,
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
    fontFamily: fonts.sans,
    fontSize: 15.5,
    color: colors.ink,
  },
  inputTall: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.accent,
  },
  choices: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  choice: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceActive: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  choiceText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    color: colors.ink2,
  },
  choiceTextActive: {
    color: colors.accent,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 10,
  },
});
