import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radii } from '../theme/tokens';
import type { ActiveCuriosity } from '../lib/curiosity';
import { insertObservation } from '../lib/observations';
import TextField from '../components/TextField';
import PrimaryButton from '../components/PrimaryButton';
import { CloseIcon } from '../components/icons';
import KeyboardAvoidingScreen from '../components/KeyboardAvoidingScreen';

export default function CuriosityOverlay({
  visible,
  onClose,
  userId,
  activeCuriosity,
  onAnswerCuriosity,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  activeCuriosity: ActiveCuriosity | null;
  onAnswerCuriosity: (answer: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [answered, setAnswered] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function handleClose() {
    setText('');
    setAnswered(false);
    setNoteSaved(false);
    setSubmitError(null);
    onClose();
  }

  async function handleAnswer(answer: string) {
    setSubmitError(null);
    try {
      await onAnswerCuriosity(answer);
      setAnswered(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "That didn't save — try again.");
    }
  }

  /**
   * The free-text field used to be decorative — it captured keystrokes into
   * state and nothing ever read them. It now writes a manual observation, so
   * anything shared here actually reaches the Understanding Engine.
   */
  async function handleShareNote() {
    const note = text.trim();
    if (!note || !userId) return;
    setSubmitError(null);
    setSavingNote(true);
    try {
      await insertObservation(userId, {
        source: 'manual',
        type: 'note',
        value: { text: note },
        context: { enteredFrom: 'curiosity-overlay' },
      });
      setText('');
      setNoteSaved(true);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "That didn't save — try again.");
    } finally {
      setSavingNote(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingScreen style={[styles.flex, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Tell me anything.</Text>
          <Pressable onPress={handleClose} hitSlop={10}>
            <CloseIcon />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {activeCuriosity && !answered ? (
            <View style={styles.questionBlock}>
              <Text style={styles.sectionLabel}>ONE QUESTION FOR YOU</Text>
              <Text style={styles.question}>{activeCuriosity.question}</Text>
              {activeCuriosity.purpose ? (
                <Text style={styles.purpose}>{activeCuriosity.purpose}</Text>
              ) : null}
              <View style={styles.options}>
                {activeCuriosity.answerOptions.map((opt) => (
                  <Pressable
                    key={opt}
                    onPress={() => handleAnswer(opt)}
                    style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                  >
                    <Text style={styles.optionText}>{opt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {answered ? (
            <Text style={styles.confirmation}>Added to your understanding.</Text>
          ) : null}

          <View style={styles.noteBlock}>
            <Text style={styles.sectionLabel}>
              {activeCuriosity && !answered ? 'OR TELL ME SOMETHING ELSE' : 'IN YOUR OWN WORDS'}
            </Text>
            <Text style={styles.noteHint}>
              How you slept, how you're feeling, anything you've noticed. There's no wrong
              thing to say here.
            </Text>
            <View style={{ marginTop: 12 }}>
              <TextField
                value={text}
                onChangeText={(t) => {
                  setText(t);
                  if (noteSaved) setNoteSaved(false);
                }}
                placeholder="Tell me anything…"
                multiline
              />
            </View>
            {text.trim().length > 0 ? (
              <View style={{ marginTop: 12 }}>
                <PrimaryButton
                  label="Share this with me"
                  onPress={handleShareNote}
                  loading={savingNote}
                />
              </View>
            ) : null}
            {noteSaved ? (
              <Text style={styles.confirmationSmall}>Added to your understanding.</Text>
            ) : null}
          </View>

          {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}>
          <Text style={styles.securityText}>
            Private to you, and used only to understand you better.
          </Text>
        </View>
      </KeyboardAvoidingScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    color: colors.ink,
  },
  scroll: {
    flex: 1,
  },
  sectionLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: colors.ink3,
    marginBottom: 10,
  },
  questionBlock: {
    marginTop: 22,
  },
  question: {
    fontFamily: fonts.serif,
    fontSize: 24,
    lineHeight: 31,
    color: colors.ink,
  },
  purpose: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink2,
    marginTop: 8,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  option: {
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionPressed: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  optionText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14.5,
    color: colors.ink,
  },
  confirmation: {
    fontFamily: fonts.serif,
    fontSize: 20,
    lineHeight: 28,
    color: colors.ink,
    marginTop: 24,
  },
  confirmationSmall: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.evidence,
    marginTop: 12,
  },
  noteBlock: {
    marginTop: 34,
  },
  noteHint: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.ink2,
    marginTop: -2,
  },
  submitError: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 12,
  },
  footer: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  securityText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.ink3,
    textAlign: 'center',
  },
});
