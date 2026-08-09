import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../theme/tokens';
import BottomSheet from '../components/BottomSheet';
import PrimaryButton from '../components/PrimaryButton';
import GhostButton from '../components/GhostButton';
import { exportAndShareUserData, deleteAccount } from '../lib/account';

export default function DataPrivacySheet({
  visible,
  userId,
  onClose,
}: {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
}) {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleClose() {
    setConfirmingDelete(false);
    setExportError(null);
    setDeleteError(null);
    onClose();
  }

  async function handleExport() {
    if (!userId) return;
    setExporting(true);
    setExportError(null);
    try {
      await exportAndShareUserData(userId);
    } catch (e) {
      setExportError(e instanceof Error ? e.message : "That didn't work — try again.");
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // No further cleanup here on success: signing out inside
      // deleteAccount() flips the session to null, which unmounts this
      // entire screen tree from App.tsx's session check.
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "That didn't work — try again.");
      setDeleting(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose}>
      <View>
        <Text style={styles.title}>Export or delete data</Text>
        <Text style={styles.intro}>
          Everything I've learned about you is yours. Take a full copy with you, or ask me to
          forget it all.
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export your data</Text>
          <Text style={styles.sectionBody}>
            A complete copy of your profile, observations, understandings, and discoveries, as a
            JSON file.
          </Text>
          <PrimaryButton label="Export my data" onPress={handleExport} loading={exporting} />
          {exportError ? <Text style={styles.error}>{exportError}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delete your account</Text>
          <Text style={styles.sectionBody}>
            This permanently deletes your account and everything I've learned about you.{' '}
            This can't be undone.
          </Text>
          {confirmingDelete ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmText}>
                Are you sure? Your account and everything in it will be gone for good.
              </Text>
              <PrimaryButton
                label="Yes, delete everything"
                onPress={handleDelete}
                loading={deleting}
              />
              <View style={{ marginTop: 6 }}>
                <GhostButton
                  label="Cancel"
                  tone="ink"
                  onPress={() => setConfirmingDelete(false)}
                />
              </View>
            </View>
          ) : (
            <GhostButton
              label="Delete my account"
              tone="ink"
              onPress={() => setConfirmingDelete(true)}
            />
          )}
          {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.serif,
    fontSize: 26,
    color: colors.ink,
  },
  intro: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink2,
    marginTop: 10,
  },
  section: {
    marginTop: 26,
  },
  sectionTitle: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 4,
  },
  sectionBody: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.ink2,
    marginBottom: 14,
  },
  confirmBox: {
    backgroundColor: colors.canvas,
    borderRadius: 14,
    padding: 16,
  },
  confirmText: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.ink,
    marginBottom: 14,
  },
  error: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.accent,
    marginTop: 10,
  },
});
