import { z } from 'zod';

export const queueEntryStatusEnum = z.enum([
  'WAITING',
  'CALLED',
  'SEATED',
  'COMPLETED',
  'CANCELLED',
  'EXPIRED',
  'NO_SHOW',
]);

export const joinQueueSchema = z.object({
  guestName: z.string().min(2).max(100),
  guestPhone: z.string().min(8).max(25),
  partySize: z.number().int().min(1).max(30),
  notes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().max(100).optional().nullable(),
});

export type JoinQueueInput = z.infer<typeof joinQueueSchema>;

export const cancelQueueSchema = z.object({
  reason: z.string().max(255).optional().nullable(),
});

export type CancelQueueInput = z.infer<typeof cancelQueueSchema>;

export const seatPartySchema = z.object({
  tableId: z.string().uuid('Valid tableId UUID is required'),
});

export type SeatPartyInput = z.infer<typeof seatPartySchema>;

export const noShowSchema = z.object({
  reason: z.string().max(255).optional().nullable(),
});

export type NoShowInput = z.infer<typeof noShowSchema>;

export const queueListQuerySchema = z.object({
  status: z
    .enum(['WAITING', 'CALLED', 'SEATED', 'COMPLETED', 'CANCELLED', 'ALL'])
    .default('WAITING')
    .optional(),
});

export type QueueListQuery = z.infer<typeof queueListQuerySchema>;
