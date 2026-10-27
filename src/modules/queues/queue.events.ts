import { PrismaClient, QueueEntryStatus } from '@prisma/client';
import { Server as SocketIOServer } from 'socket.io';

export class QueueRealtimeEmitter {
  constructor(
    private readonly io?: SocketIOServer,
    private readonly prisma?: PrismaClient
  ) {}

  /**
   * Broadcasts when a customer joins the queue.
   */
  emitQueueJoined(restaurantId: string, entry: any, waitingCount: number) {
    if (!this.io) return;
    this.io.to(`restaurant:${restaurantId}`).emit('queue:joined', {
      entry,
      waitingCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcasts when host calls a party to the stand.
   */
  emitQueueCalled(entry: any) {
    if (!this.io) return;
    const payload = {
      queueEntryId: entry.id,
      restaurantId: entry.restaurantId,
      queueNumber: entry.queueNumber,
      guestName: entry.guestName,
      status: 'CALLED',
      message: 'Your table is ready! Please proceed to the host stand.',
      calledAt: entry.calledAt,
      timestamp: new Date().toISOString(),
    };

    // Emit to individual customer room
    this.io.to(`queue:${entry.id}`).emit('queue:called', payload);

    // Emit to host dashboard room
    this.io.to(`restaurant:${entry.restaurantId}`).emit('restaurant:entry_called', payload);
  }

  /**
   * Broadcasts when party is seated.
   */
  emitQueueSeated(entry: any, tableNumber?: string) {
    if (!this.io) return;
    const payload = {
      queueEntryId: entry.id,
      restaurantId: entry.restaurantId,
      tableNumber,
      status: 'SEATED',
      timestamp: new Date().toISOString(),
    };

    this.io.to(`queue:${entry.id}`).emit('queue:seated', payload);
    this.io.to(`restaurant:${entry.restaurantId}`).emit('restaurant:entry_seated', payload);
  }

  /**
   * Broadcasts when dining is completed and table is freed.
   */
  emitQueueCompleted(restaurantId: string, queueEntryId: string) {
    if (!this.io) return;
    const payload = {
      queueEntryId,
      restaurantId,
      status: 'COMPLETED',
      timestamp: new Date().toISOString(),
    };

    this.io.to(`queue:${queueEntryId}`).emit('queue:completed', payload);
    this.io.to(`restaurant:${restaurantId}`).emit('restaurant:entry_completed', payload);
  }

  /**
   * Broadcasts when an entry is cancelled or marked no-show.
   */
  emitQueueCancelled(
    restaurantId: string,
    queueEntryId: string,
    status: 'CANCELLED' | 'NO_SHOW',
    reason?: string
  ) {
    if (!this.io) return;
    const payload = {
      queueEntryId,
      restaurantId,
      status,
      reason,
      timestamp: new Date().toISOString(),
    };

    this.io.to(`queue:${queueEntryId}`).emit('queue:status_changed', payload);
    this.io.to(`restaurant:${restaurantId}`).emit('restaurant:entry_removed', payload);
  }

  /**
   * Recalculates and broadcasts live queue positions to all waiting parties in the restaurant.
   */
  async broadcastPositionUpdates(restaurantId: string) {
    if (!this.io || !this.prisma) return;

    try {
      const [waitingEntries, restaurant] = await Promise.all([
        this.prisma.queueEntry.findMany({
          where: {
            restaurantId,
            status: QueueEntryStatus.WAITING,
          },
          orderBy: { joinedAt: 'asc' },
          select: { id: true, partySize: true, queueNumber: true },
        }),
        this.prisma.restaurant.findUnique({
          where: { id: restaurantId },
          select: {
            operatingSettings: {
              select: { estimatedMinutesPerParty: true },
            },
          },
        }),
      ]);

      const estimatedPerParty =
        restaurant?.operatingSettings?.estimatedMinutesPerParty ?? 15;

      waitingEntries.forEach((entry, index) => {
        const positionInLine = index + 1;
        const partiesAhead = index;
        const estimatedWaitMinutes = positionInLine * estimatedPerParty;

        this.io!.to(`queue:${entry.id}`).emit('queue:position_updated', {
          queueEntryId: entry.id,
          queueNumber: entry.queueNumber,
          positionInLine,
          partiesAhead,
          estimatedWaitMinutes,
          timestamp: new Date().toISOString(),
        });
      });

      // Update host stand summary
      this.io.to(`restaurant:${restaurantId}`).emit('restaurant:queue_count_updated', {
        restaurantId,
        waitingCount: waitingEntries.length,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Non-blocking background broadcast
    }
  }
}
