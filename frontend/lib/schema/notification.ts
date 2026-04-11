import { z } from "zod";

// ──────────────────────────────────────────────
// Enumerações
// ──────────────────────────────────────────────

export const NotificationTypeEnum = z.enum(["failure", "completion"]);
export type NotificationType = z.infer<typeof NotificationTypeEnum>;

// ──────────────────────────────────────────────
// Respostas
// ──────────────────────────────────────────────

export const NotificationResponseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string(),
  execution_id: z.string().nullable().default(null),
  type: NotificationTypeEnum,
  title: z.string().max(255),
  message: z.string(),
  read: z.boolean().default(false),
  created_at: z.string().datetime()
});
export type NotificationResponse = z.infer<typeof NotificationResponseSchema>;

export const NotificationListResponseSchema = z.object({
  notifications: z.array(NotificationResponseSchema).default([]),
  unread_count: z.number().min(0).default(0),
  total_count: z.number().min(0).default(0)
});
export type NotificationListResponse = z.infer<typeof NotificationListResponseSchema>;

// ──────────────────────────────────────────────
// Ações
// ──────────────────────────────────────────────

export const MarkNotificationReadRequestSchema = z.object({
  notification_ids: z.array(z.string()).min(1)
});
export type MarkNotificationReadRequest = z.infer<typeof MarkNotificationReadRequestSchema>;

export const MarkNotificationReadResponseSchema = z.object({
  marked_count: z.number().min(0),
  unread_remaining: z.number().min(0)
});
export type MarkNotificationReadResponse = z.infer<typeof MarkNotificationReadResponseSchema>;

// ──────────────────────────────────────────────
// Criação interna (não exposta na API pública)
// ──────────────────────────────────────────────

export const CreateNotificationSchema = z.object({
  user_id: z.string(),
  execution_id: z.string().nullable().default(null),
  type: NotificationTypeEnum,
  title: z.string().max(255),
  message: z.string()
});
export type CreateNotification = z.infer<typeof CreateNotificationSchema>;
