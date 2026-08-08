import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme/tokens';
import { curiosity } from '../lib/mockData';
import CuriosityCard from '../components/CuriosityCard';
import TextField from '../components/TextField';
import { CloseIcon } from '../components/icons';

export default function CuriosityOverlay({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [answered, setAnswered] = useState(false);

  function handleClose() {
    setText('');
    setAnswered(false);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[
          StyleSheet.absoluteFill,
          styles.flex,
          { paddingTop: insets.top + 12 },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Tell me anything.</Text>
          <Pressable onPress={handleClose} hitSlop={10}>
            <CloseIcon />
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Every detail you share helps me understand your body and support you
          better.
        </Text>

        <View style={{ marginTop: 24 }}>
          {answered ? (
            <View style={styles.thanksCard}>
              <Text style={styles.thanksText}>
                Thank you. I'm folding this into what I understand about your
                sleep.
              </Text>
            </View>
          ) : (
            <CuriosityCard
              question={curiosity.question}
              purpose={curiosity.purpose}
              options={curiosity.answerOptions}
              variant="light"
              onAnswer={() => setAnswered(true)}
            />
          )}
        </View>

        <View style={styles.privacyRow}>
          <Text style={styles.privacyText}>
            Your answers are private and used only to improve my understanding
            of you.
          </Text>
        </View>

        <Pressable style={styles.escapeRow} onPress={handleClose}>
          <Text style={styles.escapeTitle}>No question right now.</Text>
          <Text style={styles.escapeSub}>I have enough to keep learning.</Text>
        </Pressable>

        <View style={{ flex: 1 }} />

        <View style={{ paddingBottom: insets.bottom + 16 }}>
          <TextField
            value={text}
            onChangeText={setText}
            placeholder="Tell me anything…"
            onMicPress={() => {}}
          />
          <Text style={styles.securityText}>Private & secure</Text>
        </View>
      </KeyboardAvoidingView>
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
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: 32,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink2,
    marginTop: 8,
    maxWidth: '90%',
  },
  thanksCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
  },
  thanksText: {
    fontFamily: fonts.serif,
    fontSize: 18,
    lineHeight: 25,
    color: colors.ink,
  },
  privacyRow: {
    flexDirection: 'row',
    marginTop: 16,
  },
  privacyText: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.ink3,
    flex: 1,
  },
  escapeRow: {
    marginTop: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  escapeTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 14.5,
    color: colors.ink,
  },
  escapeSub: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.ink2,
    marginTop: 2,
  },
  securityText: {
    fontFamily: fonts.sans,
    fontSize: 11.5,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 10,
  },
});
