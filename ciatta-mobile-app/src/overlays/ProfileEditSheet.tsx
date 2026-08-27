import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radii, type } from '../theme/tokens';
import type { Profile } from '../lib/types';
import BottomSheet from '../components/BottomSheet';
import PrimaryButton from '../components/PrimaryButton';
import GlassChip from '../components/GlassChip';
import { GlassGroup } from '../components/GlassSurface';
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
    placeholder: 'What should we call you?',
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
      'Postmenopause',
    ],
    helper: 'This shapes how your data is read.',
  },
  goals: {
    key: 'goals',
    label: 'Goals & focus',
    kind: 'list',
    placeholder: 'One per line',
    helper: 'What you want this picture to hold. One per line.',
  },
  about: {
    key: 'about',
    label: 'About you',
    kind: 'longtext',
    placeholder: 'Anything about your everyday life that belongs here',
  },
  dob: {
    key: 'dob',
    label: 'Date of birth',
    kind: 'date',
    placeholder: '1990 06 15',
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
  if (spec.kind === 'date' && typeof raw === 'string') return raw.replace(/-/g, ' ');
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
    if (!/^\d{4}[- ]\d{2}[- ]\d{2}$/.test(t)) return true;
    const iso = t.replace(/ /g, '-');
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) || d > new Date();
  }, [spec, value]);

  async function handleSave() {
    if (!spec || dateInvalid) return;
    setSaving(true);
    setError(null);
    try {
      const trimmed = value.trim();
      const stored =
        spec.kind === 'date' && trimmed ? trimmed.replace(/ /g, '-') : trimmed;
      const patch: Partial<Profile> =
        spec.kind === 'list'
          ? ({ [spec.key]: trimmed ? trimmed.split('\n').map((l) => l.trim()).filter(Boolean) : [] } as Partial<Profile>)
          : ({ [spec.key]: stored || null } as Partial<Profile>);
      await onSave(patch);
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
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <CloseIcon />
            </Pressable>
          </View>

          {spec.helper ? <Text style={styles.helper}>{spec.helper}</Text> : null}

          {spec.kind === 'choice' ? (
            <GlassGroup spacing={8} style={styles.choices}>
              {spec.choices?.map((c) => {
                const active = value.toLowerCase() === c.toLowerCase();
                return (
                  <GlassChip
                    key={c}
                    label={c}
                    selected={active}
                    onPress={() => setValue(c)}
                  />
                );
              })}
            </GlassGroup>
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
            <Text style={styles.error}>
              Use a year, month, and day that have already happened. For example 1990 06 15.
            </Text>
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
    ...type.title2,
    color: colors.ink,
    flex: 1,
    paddingRight: 12,
  },
  helper: {
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
    ...fonts.sans,
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
  error: {
    ...fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 10,
  },
});
