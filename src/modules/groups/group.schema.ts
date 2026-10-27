import { z } from 'zod';

export const createGroupSessionSchema = z.object({
  restaurantId: z.string().uuid({ message: 'Valid restaurant ID is required' }),
  creatorName: z.string().min(1, 'Creator name is required').max(60),
  creatorPhone: z.string().optional(),
  name: z.string().max(60).optional(),
});

export type CreateGroupSessionInput = z.infer<typeof createGroupSessionSchema>;

export const joinGroupSessionSchema = z.object({
  name: z.string().min(1, 'Member name is required').max(60),
  phone: z.string().optional(),
  dietaryNotes: z.string().max(250).optional(),
});

export type JoinGroupSessionInput = z.infer<typeof joinGroupSessionSchema>;

export const updateMemberReadySchema = z.object({
  isReady: z.boolean(),
});

export type UpdateMemberReadyInput = z.infer<typeof updateMemberReadySchema>;

export const submitGroupQueueSchema = z.object({
  notes: z.string().max(250).optional(),
});

export type SubmitGroupQueueInput = z.infer<typeof submitGroupQueueSchema>;
