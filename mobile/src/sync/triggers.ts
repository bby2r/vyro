import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import NetInfo, { type NetInfoSubscription } from '@react-native-community/netinfo';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

import { logWarn } from '../log';
import { runOnce } from './syncService';

const FOREGROUND_INTERVAL_MS = 30_000;
export const BACKGROUND_SYNC_TASK = 'vyro-background-sync';

let taskDefined = false;
function ensureTaskDefined(): void {
  if (taskDefined || TaskManager.isTaskDefined(BACKGROUND_SYNC_TASK)) {
    taskDefined = true;
    return;
  }
  taskDefined = true;
  TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
    try {
      await runOnce();
      return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (err) {
      logWarn('background sync failed', err);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

let registered = false;

type Cleanup = () => void;

export function registerSyncTriggers(): Cleanup {
  if (registered) {
    return () => {};
  }
  registered = true;

  try {
    ensureTaskDefined();
  } catch (err) {
    logWarn('defineTask failed', err);
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;
  let appStateSub: NativeEventSubscription | null = null;
  let netInfoSub: NetInfoSubscription | null = null;

  const startForegroundInterval = () => {
    if (intervalId) {
      return;
    }
    intervalId = setInterval(() => {
      void runOnce();
    }, FOREGROUND_INTERVAL_MS);
  };
  const stopForegroundInterval = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  // 1. Foreground interval starts immediately, since the app is active.
  startForegroundInterval();

  // 2. AppState listener
  const handleAppState = (state: AppStateStatus) => {
    if (state === 'active') {
      startForegroundInterval();
      void runOnce();
    } else {
      stopForegroundInterval();
    }
  };
  appStateSub = AppState.addEventListener('change', handleAppState);

  // 3. NetInfo listener — sync when connectivity returns.
  let wasConnected: boolean | null = null;
  netInfoSub = NetInfo.addEventListener((state) => {
    const isConnected = !!state.isConnected;
    if (isConnected && wasConnected === false) {
      void runOnce();
    }
    wasConnected = isConnected;
  });

  // 4. Background fetch (best effort, OS may throttle).
  void (async () => {
    try {
      await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
        minimumInterval: 15 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    } catch (err) {
      logWarn('register background fetch failed', err);
    }
  })();

  return () => {
    stopForegroundInterval();
    appStateSub?.remove();
    netInfoSub?.();
    registered = false;
  };
}
