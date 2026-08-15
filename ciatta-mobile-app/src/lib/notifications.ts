import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';
import { colors } from '../theme/tokens';

/**
 * Ciatta's whole value is noticing something and telling you about it. Until
 * now the preference collected at onboarding was written to the profile and
 * never read by anything — a discovery could only be seen by someone who
 * happened to open the app that day.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** 'discoveries' | 'weekly' | 'none' — mirrors profiles.notification_preference. */
export type NotificationPreference = string;

export function notificationsWanted(pref: NotificationPreference | null | undefined): boolean {
  return pref !== 'none' && pref != null;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('discoveries', {
    name: 'Discoveries',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: colors.accent,
    // Quiet by design: this is a reflective app, not an alerting one.
    vibrationPattern: [0, 120],
  });
}

/**
 * Registers this device for push and stores the token. Safe to call on every
 * launch — the row is keyed on (user_id, token), so re-registering the same
 * device is a no-op rather than a duplicate.
 *
 * Returns null (without throwing) whenever push simply isn't available:
 * simulators, denied permission, or a missing EAS project id. Push is an
 * enhancement, so a failure here must never interrupt the app.
 */
export async function registerForPush(
  userId: string,
  pref: NotificationPreference | null | undefined
): Promise<string | null> {
  try {
    if (!notificationsWanted(pref)) return null;
    if (!Device.isDevice) return null;

    await ensureAndroidChannel();

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked.status;
    }
    if (status !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return null;

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: Platform.OS,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      );
    if (error) throw error;

    return token;
  } catch {
    // Never let a push failure surface to the user or block startup.
    return null;
  }
}

/** Removes this device's token, so a signed-out phone stops receiving pushes. */
export async function unregisterPush(userId: string): Promise<void> {
  try {
    if (!Device.isDevice) return;
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return;
    await supabase.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  } catch {
    // Best effort.
  }
}
