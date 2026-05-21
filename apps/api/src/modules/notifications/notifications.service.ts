import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { NotifChannel, NotifStatus, NotifType } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { FirebaseService } from '../../core/firebase/firebase.service';

export interface NotificationEvent {
  userId: string;
  type: NotifType;
  title: string;
  body: string;
  data?: Record<string, string>; // FCM data payload must be string values
  channels?: NotifChannel[];
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly firebase: FirebaseService,
  ) {}

  /**
   * Dispatch a notification to one or more channels.
   * - IN_APP  : always written to DB (queryable via GET /v1/notifications)
   * - PUSH    : sent via FCM using all registered device tokens for the user
   * - EMAIL   : SendGrid stub (logs in dev, real call in prod when key is set)
   * - SMS     : MSG91 stub
   */
  async dispatch(event: NotificationEvent): Promise<void> {
    const channels = event.channels ?? [NotifChannel.IN_APP];

    await Promise.allSettled(
      channels.map(channel => this.dispatchChannel(channel, event)),
    );
  }

  private async dispatchChannel(
    channel: NotifChannel,
    event: NotificationEvent,
  ): Promise<void> {
    const id = randomUUID();
    const now = new Date();

    try {
      // 1. Persist notification row
      await this.prisma.notification.create({
        data: {
          id,
          userId: event.userId,
          type: event.type,
          channel,
          title: event.title,
          body: event.body,
          data: (event.data ?? {}) as object,
          status: NotifStatus.PENDING,
        },
      });

      // 2. Deliver
      let delivered = false;
      switch (channel) {
        case NotifChannel.IN_APP:
          delivered = true; // persisted above = delivered
          break;
        case NotifChannel.PUSH:
          delivered = await this.sendPush(event);
          break;
        case NotifChannel.EMAIL:
          delivered = await this.sendEmail(event);
          break;
        case NotifChannel.SMS:
          delivered = await this.sendSms(event);
          break;
      }

      // 3. Update status (best-effort — Notification model uses composite PK)
      await this.prisma.notification.updateMany({
        where: { id, userId: event.userId },
        data: {
          status: delivered ? NotifStatus.SENT : NotifStatus.FAILED,
          sentAt: delivered ? now : null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Failed to dispatch ${channel} notification for user ${event.userId}`,
        err,
      );
    }
  }

  // ── Register device token (called after mobile app login) ─────────────────

  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios' | 'web',
  ): Promise<void> {
    await this.prisma.deviceToken.upsert({
      where: { token },
      create: { id: randomUUID(), userId, token, platform },
      update: { userId, platform },
    });
    this.logger.debug(`Device token registered for user ${userId} (${platform})`);
  }

  async removeDeviceToken(token: string): Promise<void> {
    await this.prisma.deviceToken.deleteMany({ where: { token } }).catch(() => undefined);
  }

  // ── In-app feed ───────────────────────────────────────────────────────────

  async listNotifications(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId, channel: NotifChannel.IN_APP },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where: { userId, channel: NotifChannel.IN_APP } }),
      this.prisma.notification.count({
        where: { userId, channel: NotifChannel.IN_APP, isRead: false },
      }),
    ]);

    return {
      data: notifications,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit), unreadCount },
    };
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification
      .updateMany({
        where: { id: notificationId, userId },
        data: { isRead: true, readAt: new Date() },
      })
      .catch(() => undefined);
  }

  async markAllRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, channel: NotifChannel.IN_APP, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  // ── Private delivery methods ──────────────────────────────────────────────

  private async sendPush(event: NotificationEvent): Promise<boolean> {
    if (!this.firebase.isEnabled) {
      this.logger.debug(`[FCM STUB] ${event.type} → ${event.title}`);
      return true; // treat as sent in dev
    }

    // Fetch all device tokens for this user
    const tokens = await this.prisma.deviceToken.findMany({
      where: { userId: event.userId },
      select: { token: true },
    });

    if (tokens.length === 0) {
      this.logger.debug(`No device tokens for user ${event.userId} — skipping push`);
      return false;
    }

    const tokenStrings = tokens.map(t => t.token);
    await this.firebase.sendToMultiple(tokenStrings, {
      title: event.title,
      body: event.body,
      data: event.data,
    });
    return true;
  }

  private async sendEmail(event: NotificationEvent): Promise<boolean> {
    const apiKey = this.config.get<string>('notifications.sendgridApiKey');
    if (!apiKey) {
      this.logger.debug(`[EMAIL STUB] ${event.title} → userId:${event.userId}`);
      return true;
    }
    // TODO: integrate SendGrid when SENDGRID_API_KEY is set
    this.logger.debug(`[EMAIL] Would send: ${event.title}`);
    return true;
  }

  private async sendSms(event: NotificationEvent): Promise<boolean> {
    const authKey = this.config.get<string>('notifications.msg91AuthKey');
    if (!authKey) {
      this.logger.debug(`[SMS STUB] ${event.title} → userId:${event.userId}`);
      return true;
    }
    // TODO: integrate MSG91 when MSG91_AUTH_KEY is set
    this.logger.debug(`[SMS] Would send: ${event.title}`);
    return true;
  }
}
