import { PreOrderStatus } from '@prisma/client';
import { z } from 'zod';

export const createPreOrderSchema = z.object({
  restaurantId: z.string().uuid({ message: 'Valid restaurant ID is required' }),
  queueEntryId: z.string().uuid().optional(),
  groupSessionId: z.string().uuid().optional(),
  customerName: z.string().max(60).optional(),
  customerPhone: z.string().optional(),
  specialNotes: z.string().max(250).optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.string().uuid({ message: 'Valid menu item ID is required' }),
        quantity: z.number().int().min(1).max(25),
        specialNotes: z.string().max(200).optional(),
      })
    )
    .min(1, 'At least one menu item must be included in the pre-order'),
});

export type CreatePreOrderInput = z.infer<typeof createPreOrderSchema>;

export const updateOrderStatusSchema = z.object({
  status: z.nativeEnum(PreOrderStatus, {
    errorMap: () => ({ message: 'Invalid pre-order status' }),
  }),
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
