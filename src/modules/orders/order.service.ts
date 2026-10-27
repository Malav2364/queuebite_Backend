import {
  PrismaClient,
  PreOrderStatus,
  QueueEntryStatus,
} from '@prisma/client';
import { AppError, NotFoundError } from '../../errors/app-error.js';
import { OrderRealtimeEmitter } from './order.events.js';
import { CreatePreOrderInput } from './order.schema.js';

export class OrderService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly emitter?: OrderRealtimeEmitter
  ) {}

  /**
   * Places a queue-aware pre-order synchronized with table seating time.
   */
  async createPreOrder(input: CreatePreOrderInput, userId?: string) {
    // 1. Validate restaurant
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: input.restaurantId },
      include: { operatingSettings: true },
    });

    if (!restaurant) {
      throw new NotFoundError(`Restaurant "${input.restaurantId}" not found`);
    }

    // 2. Validate queue entry if supplied
    let queueEntry = null;
    if (input.queueEntryId) {
      queueEntry = await this.prisma.queueEntry.findUnique({
        where: { id: input.queueEntryId },
      });

      if (!queueEntry) {
        throw new NotFoundError(
          `Queue entry "${input.queueEntryId}" not found`
        );
      }

      if (queueEntry.restaurantId !== input.restaurantId) {
        throw new AppError(
          'Queue entry does not belong to this restaurant',
          400,
          'QUEUE_RESTAURANT_MISMATCH'
        );
      }

      if (
        queueEntry.status !== QueueEntryStatus.WAITING &&
        queueEntry.status !== QueueEntryStatus.CALLED
      ) {
        throw new AppError(
          `Cannot place pre-order for queue entry in status "${queueEntry.status}"`,
          400,
          'INVALID_QUEUE_STATUS'
        );
      }
    }

    // 3. Validate group session if supplied
    if (input.groupSessionId) {
      const groupSession = await this.prisma.groupSession.findUnique({
        where: { id: input.groupSessionId },
      });

      if (!groupSession) {
        throw new NotFoundError(
          `Group session "${input.groupSessionId}" not found`
        );
      }

      if (groupSession.restaurantId !== input.restaurantId) {
        throw new AppError(
          'Group session does not belong to this restaurant',
          400,
          'GROUP_RESTAURANT_MISMATCH'
        );
      }
    }

    // 4. Fetch and validate all menu items
    const menuItemIds = input.items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        category: { restaurantId: input.restaurantId },
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new AppError(
        'One or more menu items are invalid or do not belong to this restaurant',
        400,
        'INVALID_MENU_ITEMS'
      );
    }

    const menuItemMap = new Map(menuItems.map((m) => [m.id, m]));

    // Check availability
    for (const item of input.items) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem?.isAvailable) {
        throw new AppError(
          `Menu item "${menuItem?.name || item.menuItemId}" is currently unavailable`,
          400,
          'ITEM_UNAVAILABLE'
        );
      }
    }

    // Calculate total amount
    let totalAmount = 0;
    const orderItemsData = input.items.map((item) => {
      const menuItem = menuItemMap.get(item.menuItemId)!;
      const lineTotal = menuItem.price * item.quantity;
      totalAmount += lineTotal;

      return {
        menuItemId: item.menuItemId,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        specialNotes: item.specialNotes ?? null,
      };
    });

    // 5. Calculate target serve time based on queue seating estimate
    let targetServeTime: Date;
    if (queueEntry) {
      const waitMinutes = queueEntry.estimatedWaitMinutes ?? 15;
      targetServeTime = new Date(Date.now() + waitMinutes * 60000);
    } else {
      // Default 20 mins from now
      targetServeTime = new Date(Date.now() + 20 * 60000);
    }

    // 6. Create PreOrder record
    const preOrder = await this.prisma.preOrder.create({
      data: {
        restaurantId: input.restaurantId,
        queueEntryId: input.queueEntryId ?? null,
        groupSessionId: input.groupSessionId ?? null,
        userId: userId ?? null,
        customerName: input.customerName ?? queueEntry?.guestName ?? null,
        customerPhone: input.customerPhone ?? queueEntry?.guestPhone ?? null,
        status: PreOrderStatus.SUBMITTED,
        totalAmount: Math.round(totalAmount * 100) / 100,
        targetServeTime,
        specialNotes: input.specialNotes ?? null,
        items: {
          create: orderItemsData,
        },
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            menuItem: true,
          },
        },
        queueEntry: true,
      },
    });

    this.emitter?.emitOrderCreated(preOrder);

    return preOrder;
  }

  /**
   * Retrieves a pre-order by ID with all item details.
   */
  async getOrderById(orderId: string) {
    const order = await this.prisma.preOrder.findUnique({
      where: { id: orderId },
      include: {
        restaurant: {
          include: { location: true },
        },
        items: {
          include: {
            menuItem: true,
          },
        },
        queueEntry: true,
        groupSession: true,
      },
    });

    if (!order) {
      throw new NotFoundError(`Pre-order "${orderId}" not found`);
    }

    return order;
  }

  /**
   * Retrieves all pre-orders for a restaurant kitchen queue display.
   */
  async getOrdersByRestaurant(restaurantId: string, status?: PreOrderStatus) {
    return this.prisma.preOrder.findMany({
      where: {
        restaurantId,
        status: status ?? undefined,
      },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        queueEntry: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves pre-orders linked to a specific customer queue entry.
   */
  async getOrdersByQueueEntry(queueEntryId: string) {
    return this.prisma.preOrder.findMany({
      where: { queueEntryId },
      include: {
        restaurant: {
          select: { id: true, name: true },
        },
        items: {
          include: {
            menuItem: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves pre-orders linked to a group dining session.
   */
  async getOrdersByGroupSession(groupSessionId: string) {
    return this.prisma.preOrder.findMany({
      where: { groupSessionId },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Transitions pre-order prep status (e.g., CONFIRMED, PREPARING, SERVED, CANCELLED).
   */
  async updateOrderStatus(orderId: string, status: PreOrderStatus) {
    const existing = await this.prisma.preOrder.findUnique({
      where: { id: orderId },
    });

    if (!existing) {
      throw new NotFoundError(`Pre-order "${orderId}" not found`);
    }

    const updated = await this.prisma.preOrder.update({
      where: { id: orderId },
      data: { status },
      include: {
        items: true,
        restaurant: { select: { id: true, name: true } },
      },
    });

    this.emitter?.emitOrderStatusUpdated(updated);

    return updated;
  }
}
