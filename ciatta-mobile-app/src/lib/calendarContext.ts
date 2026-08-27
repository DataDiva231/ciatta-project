import { Platform } from 'react-native';
import * as Calendar from 'expo-calendar';
import { insertObservation } from './observations';

export async function requestCalendarPermission(): Promise<{ granted: boolean }> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return { granted: true };
  }
  try {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return { granted: status === 'granted' };
  } catch {
    return { granted: false };
  }
}

/**
 * Writes today's event count as a health note. Event titles are not stored.
 */
export async function syncCalendarContext(userId: string): Promise<void> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
  const { status } = await Calendar.getCalendarPermissionsAsync();
  if (status !== 'granted') return;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const ids = calendars.map((calendar) => calendar.id);
  const events = ids.length > 0 ? await Calendar.getEventsAsync(ids, start, end) : [];
  const count = events.length;

  await insertObservation(userId, {
    source: 'manual',
    type: 'health_profile_note',
    value: {
      text:
        count === 0
          ? 'No events on the calendar today.'
          : `${count} event${count === 1 ? '' : 's'} on the calendar today.`,
    },
    context: { category: 'calendar', eventCount: count },
  });
}
