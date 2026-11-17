import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import Owner from '../models/Owner.js';

let messaging;

export function initializePushNotifications() {
  const hasLocalCredentials = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
  const isGoogleManagedRuntime = Boolean(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || process.env.K_SERVICE);
  if (!hasLocalCredentials && !isGoogleManagedRuntime) {
    console.warn('[fcm] disabled: set GOOGLE_APPLICATION_CREDENTIALS to an external service-account file');
    return false;
  }

  try {
    const app = getApps()[0] ?? initializeApp({
      credential: applicationDefault(),
      ...(process.env.FIREBASE_PROJECT_ID ? { projectId: process.env.FIREBASE_PROJECT_ID } : {}),
    });
    messaging = getMessaging(app);
    console.info('[fcm] Firebase Admin initialized');
    return true;
  } catch (error) {
    console.error('[fcm] initialization failed', { code: error.code ?? 'initialization-error' });
    return false;
  }
}

export async function sendPushToOwner(ownerId, { title, body, data }) {
  if (!messaging) return;

  try {
    const owner = await Owner.findById(ownerId).select('+fcmTokens');
    const tokens = [...new Set(owner?.fcmTokens ?? [])];
    if (tokens.length === 0) return;

    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key, String(value)]),
    );
    const invalidTokens = [];
    let successCount = 0;

    for (let offset = 0; offset < tokens.length; offset += 500) {
      const batch = tokens.slice(offset, offset + 500);
      const result = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: cleanData,
        android: {
          priority: 'high',
          notification: { channelId: 'parksafe_alerts' },
        },
      });
      successCount += result.successCount;
      result.responses.forEach((response, index) => {
        if (!response.success && [
          'messaging/invalid-registration-token',
          'messaging/registration-token-not-registered',
        ].includes(response.error?.code)) invalidTokens.push(batch[index]);
      });
    }

    if (invalidTokens.length) {
      await Owner.updateOne({ _id: ownerId }, { $pull: { fcmTokens: { $in: invalidTokens } } });
    }
    console.info('[fcm] notification dispatched', {
      successCount,
      tokenCount: tokens.length,
      removedExpiredTokenCount: invalidTokens.length,
      notificationType: cleanData.type ?? 'unknown',
    });
  } catch (error) {
    // Push delivery must not undo an already-saved message or interrupt call setup.
    console.error('[fcm] notification dispatch failed', { code: error.code ?? 'send-error' });
  }
}
