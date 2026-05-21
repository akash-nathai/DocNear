import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const projectId  = this.config.get<string>('fcm.projectId');
    const clientEmail = this.config.get<string>('fcm.clientEmail');
    const privateKey  = this.config.get<string>('fcm.privateKey');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('FCM credentials not set — push notifications disabled');
      return;
    }

    // Avoid double-init in hot-reload
    if (admin.apps.length > 0) {
      this.app = admin.app();
      return;
    }

    try {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          // .env stores \n as literal — replace with real newlines
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.logger.log(`Firebase Admin SDK initialised (project: ${projectId})`);
    } catch (err) {
      this.logger.error('Failed to initialise Firebase Admin SDK', err);
    }
  }

  /**
   * Send a push notification to a single FCM device token.
   * Returns true on success, false if token is invalid or FCM is not configured.
   */
  async sendToToken(token: string, payload: PushPayload): Promise<boolean> {
    if (!this.app) {
      this.logger.debug('[FCM disabled] Would send:', payload.title);
      return false;
    }
    if (!token) return false;

    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        data: payload.data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      };

      const messageId = await admin.messaging(this.app).send(message);
      this.logger.debug(`FCM sent: ${messageId}`);
      return true;
    } catch (err: unknown) {
      // Token expired / unregistered — caller should purge it
      const code = (err as { code?: string }).code;
      if (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token') {
        this.logger.warn(`Invalid FCM token (purge it): ${token.slice(0, 20)}…`);
        return false;
      }
      this.logger.error('FCM send error', err);
      return false;
    }
  }

  /**
   * Send to multiple tokens (Multicast — up to 500 at once).
   */
  async sendToMultiple(tokens: string[], payload: PushPayload): Promise<void> {
    if (!this.app || tokens.length === 0) return;

    const batch: admin.messaging.MulticastMessage = {
      tokens,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    };

    const response = await admin.messaging(this.app).sendEachForMulticast(batch);
    this.logger.debug(
      `FCM multicast: ${response.successCount} sent, ${response.failureCount} failed`,
    );
  }

  get isEnabled(): boolean {
    return this.app !== null;
  }
}
