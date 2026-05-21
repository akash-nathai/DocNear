import type { NotifType, NotifChannel } from './enums';

export interface NotificationDto {
  id: string;
  type: NotifType;
  channel: NotifChannel;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  sentAt?: string;
  readAt?: string;
  createdAt: string;
}
