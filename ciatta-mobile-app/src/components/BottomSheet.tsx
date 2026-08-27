import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { colors, glass } from '../theme/tokens';
import KeyboardAvoidingScreen from './KeyboardAvoidingScreen';
import GlassSurface, { useLiquidGlass } from './GlassSurface';

const { height: SCREEN_H } = Dimensions.get('window');

export default function BottomSheet({
  visible,
  onClose,
  children,
  maxHeightPct = 0.9,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeightPct?: number;
}) {
  const translateY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const native = useLiquidGlass();

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(backdrop, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(SCREEN_H);
      backdrop.setValue(0);
    }
  }, [visible, translateY, backdrop]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingScreen style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheetMotion,
            { maxHeight: SCREEN_H * maxHeightPct, transform: [{ translateY }] },
          ]}
        >
          <GlassSurface
            kind="regular"
            tintColor={glass.tint}
            colorScheme="auto"
            style={[styles.sheet, native && styles.sheetNative]}
            fallbackStyle={styles.sheetFallback}
          >
            <View style={styles.handle} />
            <ScrollView
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          </GlassSurface>
        </Animated.View>
      </KeyboardAvoidingScreen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(28, 28, 30, 0.45)',
  },
  sheetMotion: {
    width: '100%',
  },
  sheet: {
    borderTopLeftRadius: glass.radius,
    borderTopRightRadius: glass.radius,
  },
  sheetNative: {
    borderWidth: 0,
  },
  sheetFallback: {
    backgroundColor: glass.fillCard,
    borderTopLeftRadius: glass.radius,
    borderTopRightRadius: glass.radius,
    borderWidth: 1,
    borderColor: glass.border,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
});
