import { Server as SocketIOServer } from 'socket.io';

export class OrderRealtimeEmitter {
  constructor(private readonly io?: SocketIOServer) {}

  /**
   * Broadcasts when a pre-order is placed to restaurant kitchen and customer queue room.
   */
  emitOrderCreated(order: any) {
    if (!this.io) return;
    const payload = {
      order,
      timestamp: new Date().toISOString(),
    };

    // Emit to kitchen board room
    this.io.to(`restaurant:${order.restaurantId}`).emit('order:created', payload);

    // Emit to customer queue room if attached
    if (order.queueEntryId) {
      this.io.to(`queue:${order.queueEntryId}`).emit('order:created', payload);
    }

    // Emit to group room if attached
    if (order.groupSessionId) {
      this.io.to(`group:${order.groupSessionId}`).emit('order:created', payload);
    }
  }

  /**
   * Broadcasts when an order status changes (e.g., CONFIRMED, PREPARING, SERVED).
   */
  emitOrderStatusUpdated(order: any) {
    if (!this.io) return;
    const payload = {
      orderId: order.id,
      restaurantId: order.restaurantId,
      queueEntryId: order.queueEntryId,
      groupSessionId: order.groupSessionId,
      status: order.status,
      timestamp: new Date().toISOString(),
    };

    this.io.to(`restaurant:${order.restaurantId}`).emit('order:status_updated', payload);

    if (order.queueEntryId) {
      this.io.to(`queue:${order.queueEntryId}`).emit('order:status_updated', payload);
    }

    if (order.groupSessionId) {
      this.io.to(`group:${order.groupSessionId}`).emit('order:status_updated', payload);
    }

    this.io.to(`order:${order.id}`).emit('order:status_updated', payload);
  }
}
