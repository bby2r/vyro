import * as Notifications from 'expo-notifications';

import { logWarn } from '../log';

let handlerConfigured = false;

export function configureNotificationHandler(): void {
  if (handlerConfigured) {
    return;
  }
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let permissionRequested = false;

export async function requestPermissions(): Promise<boolean> {
  if (permissionRequested) {
    const current = await Notifications.getPermissionsAsync();
    return current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  permissionRequested = true;

  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) {
      return true;
    }
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  } catch (err) {
    logWarn('Notification permission request failed', err);
    return false;
  }
}

export async function scheduleTodoReminder(title: string, when: Date): Promise<string> {
  return await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminder',
      body: title,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
    },
  });
}

export async function cancelTodoReminder(id: string | null | undefined): Promise<void> {
  if (!id) {
    return;
  }
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch (err) {
    logWarn('Cancel notification failed', err);
  }
}
