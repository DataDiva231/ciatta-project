import * as Notifications from 'expo-notifications';
import { tamponNotificationPlan, type TamponWearUnderstanding } from './tamponWear';

const IDS = ['checkSoon', 'changeNow', 'safetyLimit'] as const;

export async function syncTamponWearNotifications(
  understanding: TamponWearUnderstanding,
  now = new Date()
): Promise<void> {
  for (const id of IDS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`ciatta.tampon.${id}`);
    } catch {
      // Best effort: a missing identifier is not a failure.
    }
  }

  const plan = tamponNotificationPlan(understanding, now);
  for (const cue of plan) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: `ciatta.tampon.${cue.id}`,
        content: {
          title: 'Ciatta',
          body: cue.body,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(cue.fireAt),
        },
      });
    } catch {
      // Simulator and denied permission must never block the screen.
    }
  }
}

export async function clearTamponWearNotifications(): Promise<void> {
  for (const id of IDS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(`ciatta.tampon.${id}`);
    } catch {
      // Best effort.
    }
  }
}
