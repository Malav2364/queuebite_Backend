import {
  PrismaClient,
  QueueEntryStatus,
  TableStatus,
} from '@prisma/client';
import { AppError, ConflictError, NotFoundError } from '../../errors/app-error.js';
import {
  CancelQueueInput,
  JoinQueueInput,
  NoShowInput,
  SeatPartyInput,
} from './queue.schema.js';
import { QueueRealtimeEmitter } from './queue.events.js';

export class QueueService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly emitter?: QueueRealtimeEmitter
  ) {}

  /**
   * Joins a virtual queue at a restaurant.
   */
  async joinQueue(
    restaurantId: string,
    input: JoinQueueInput,
    userId?: string
  ) {
    // 1. Fetch restaurant with operating settings
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        operatingSettings: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundError(`Restaurant "${restaurantId}" not found`);
    }

    if (!restaurant.isQueueOpen) {
      throw new AppError(
        'Virtual queue is currently closed for this restaurant.',
        400,
        'QUEUE_CLOSED'
      );
    }

    const settings = restaurant.operatingSettings ?? {
      minPartySize: 1,
      maxPartySize: 12,
      estimatedMinutesPerParty: 15,
      maxActiveQueueEntries: 50,
    };

    // 2. Validate party size bounds
    if (
      input.partySize < settings.minPartySize ||
      input.partySize > settings.maxPartySize
    ) {
      throw new AppError(
        `Party size must be between ${settings.minPartySize} and ${settings.maxPartySize} guests.`,
        400,
        'INVALID_PARTY_SIZE'
      );
    }

    // 3. Check idempotency key if provided
    if (input.idempotencyKey) {
      const existingByIdempotency = await this.prisma.queueEntry.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: {
          restaurant: {
            select: { id: true, name: true, slug: true },
          },
        },
      });
      if (existingByIdempotency) {
        return this.enrichQueueEntry(existingByIdempotency);
      }
    }

    // 4. Prevent duplicate active entries for the same user or phone number at this restaurant
    const activeEntry = await this.prisma.queueEntry.findFirst({
      where: {
        restaurantId,
        status: { in: [QueueEntryStatus.WAITING, QueueEntryStatus.CALLED] },
        OR: [
          ...(userId ? [{ userId }] : []),
          { guestPhone: input.guestPhone },
        ],
      },
    });

    if (activeEntry) {
      throw new ConflictError(
        'You already have an active spot in this virtual queue.',
        { activeEntryId: activeEntry.id, queueNumber: activeEntry.queueNumber }
      );
    }

    // 5. Check queue maximum capacity
    const currentWaitingCount = await this.prisma.queueEntry.count({
      where: {
        restaurantId,
        status: QueueEntryStatus.WAITING,
      },
    });

    if (currentWaitingCount >= settings.maxActiveQueueEntries) {
      throw new AppError(
        'This queue is currently at maximum capacity. Please try again later.',
        400,
        'QUEUE_FULL'
      );
    }

    // 6. Compute sequential queue number for today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const highestToday = await this.prisma.queueEntry.findFirst({
      where: {
        restaurantId,
        createdAt: { gte: startOfDay },
      },
      orderBy: { queueNumber: 'desc' },
      select: { queueNumber: true },
    });

    const nextQueueNumber = (highestToday?.queueNumber ?? 0) + 1;
    const estimatedMinutesPerParty = settings.estimatedMinutesPerParty ?? 15;
    const estimatedWaitMinutes = (currentWaitingCount + 1) * estimatedMinutesPerParty;

    // 7. Create queue entry and initial audit event in transaction
    const entry = await this.prisma.$transaction(async (tx) => {
      const created = await tx.queueEntry.create({
        data: {
          restaurantId,
          userId: userId ?? null,
          guestName: input.guestName,
          guestPhone: input.guestPhone,
          partySize: input.partySize,
          queueNumber: nextQueueNumber,
          estimatedWaitMinutes,
          notes: input.notes,
          idempotencyKey: input.idempotencyKey,
          status: QueueEntryStatus.WAITING,
        },
        include: {
          restaurant: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      await tx.queueEvent.create({
        data: {
          queueEntryId: created.id,
          fromStatus: null,
          toStatus: QueueEntryStatus.WAITING,
          triggeredBy: userId ? 'USER' : 'GUEST',
          reason: 'Initial queue join',
          metadata: {
            partySize: input.partySize,
            queueNumber: nextQueueNumber,
          },
        },
      });

      return created;
    });

    const enriched = await this.enrichQueueEntry(entry);
    this.emitter?.emitQueueJoined(restaurantId, enriched, currentWaitingCount + 1);
    this.emitter?.broadcastPositionUpdates(restaurantId);

    return enriched;
  }

  /**
   * Retrieves single queue entry with live position and wait times.
   */
  async getQueueEntry(id: string) {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            coverImageUrl: true,
            operatingSettings: true,
          },
        },
        tableAssignment: {
          include: {
            table: true,
          },
        },
        events: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!entry) {
      throw new NotFoundError(`Queue entry "${id}" was not found`);
    }

    return this.enrichQueueEntry(entry);
  }

  /**
   * Cancels a queue entry.
   */
  async cancelQueueEntry(id: string, input: CancelQueueInput, actor = 'USER') {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id },
      include: { tableAssignment: true },
    });

    if (!entry) {
      throw new NotFoundError(`Queue entry "${id}" was not found`);
    }

    if (
      entry.status === QueueEntryStatus.CANCELLED ||
      entry.status === QueueEntryStatus.COMPLETED ||
      entry.status === QueueEntryStatus.NO_SHOW
    ) {
      throw new AppError(
        `Cannot cancel queue entry in status "${entry.status}".`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.queueEntry.update({
        where: { id },
        data: {
          status: QueueEntryStatus.CANCELLED,
          cancelledAt: new Date(),
        },
      });

      // Free table if one was already held
      if (entry.tableAssignment) {
        await tx.tableAssignment.update({
          where: { id: entry.tableAssignment.id },
          data: { freedAt: new Date() },
        });
        await tx.restaurantTable.update({
          where: { id: entry.tableAssignment.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      await tx.queueEvent.create({
        data: {
          queueEntryId: id,
          fromStatus: entry.status,
          toStatus: QueueEntryStatus.CANCELLED,
          triggeredBy: actor,
          reason: input.reason ?? 'Customer requested cancellation',
        },
      });

      return updated;
    });

    this.emitter?.emitQueueCancelled(entry.restaurantId, id, 'CANCELLED', input.reason ?? undefined);
    this.emitter?.broadcastPositionUpdates(entry.restaurantId);

    return result;
  }

  /**
   * Lists active queue for a restaurant (Host/Staff dashboard).
   */
  async listRestaurantQueue(
    restaurantId: string,
    statusFilter?: string
  ) {
    const where: any = { restaurantId };

    if (!statusFilter || statusFilter === 'WAITING') {
      where.status = QueueEntryStatus.WAITING;
    } else if (statusFilter === 'ALL') {
      // Don't filter by status
    } else {
      where.status = statusFilter as QueueEntryStatus;
    }

    const [entries, waitingCount, calledCount, seatedTodayCount] =
      await Promise.all([
        this.prisma.queueEntry.findMany({
          where,
          orderBy: { queueNumber: 'asc' },
          include: {
            tableAssignment: {
              include: {
                table: true,
              },
            },
          },
        }),
        this.prisma.queueEntry.count({
          where: {
            restaurantId,
            status: QueueEntryStatus.WAITING,
          },
        }),
        this.prisma.queueEntry.count({
          where: {
            restaurantId,
            status: QueueEntryStatus.CALLED,
          },
        }),
        this.prisma.queueEntry.count({
          where: {
            restaurantId,
            status: QueueEntryStatus.SEATED,
            seatedAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);

    return {
      restaurantId,
      summary: {
        waitingCount,
        calledCount,
        seatedTodayCount,
      },
      entries: entries.map((e, index) => ({
        ...e,
        positionInLine: e.status === QueueEntryStatus.WAITING ? index + 1 : null,
      })),
    };
  }

  /**
   * Calls a waiting party to the host stand.
   */
  async callParty(id: string, staffId = 'HOST') {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id },
      include: {
        restaurant: { select: { name: true } },
      },
    });

    if (!entry) {
      throw new NotFoundError(`Queue entry "${id}" not found`);
    }

    if (entry.status !== QueueEntryStatus.WAITING) {
      throw new AppError(
        `Can only call parties in "WAITING" status. Current status: "${entry.status}".`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const callResult = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.queueEntry.update({
        where: { id },
        data: {
          status: QueueEntryStatus.CALLED,
          calledAt: new Date(),
        },
      });

      await tx.queueEvent.create({
        data: {
          queueEntryId: id,
          fromStatus: QueueEntryStatus.WAITING,
          toStatus: QueueEntryStatus.CALLED,
          triggeredBy: staffId,
          reason: 'Host called party to front desk',
        },
      });

      // If user is registered, record a notification
      if (entry.userId) {
        await tx.notification.create({
          data: {
            userId: entry.userId,
            title: 'Your Table is Ready!',
            message: `Please proceed to the host stand at ${entry.restaurant.name}. Your queue number is #${entry.queueNumber}.`,
            type: 'TABLE_READY',
            metadata: {
              queueEntryId: entry.id,
              queueNumber: entry.queueNumber,
            },
          },
        });
      }

      return updated;
    });

    this.emitter?.emitQueueCalled(callResult);
    this.emitter?.broadcastPositionUpdates(entry.restaurantId);

    return callResult;
  }

  /**
   * Seats a party at an assigned table.
   */
  async seatParty(id: string, input: SeatPartyInput, staffId = 'HOST') {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      throw new NotFoundError(`Queue entry "${id}" not found`);
    }

    if (
      entry.status !== QueueEntryStatus.CALLED &&
      entry.status !== QueueEntryStatus.WAITING
    ) {
      throw new AppError(
        `Party must be WAITING or CALLED to be seated. Current status: "${entry.status}".`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Verify table
    const table = await this.prisma.restaurantTable.findUnique({
      where: { id: input.tableId },
    });

    if (!table || table.restaurantId !== entry.restaurantId) {
      throw new NotFoundError(`Table "${input.tableId}" does not exist at this restaurant.`);
    }

    const seatResult = await this.prisma.$transaction(async (tx) => {
      const updatedEntry = await tx.queueEntry.update({
        where: { id },
        data: {
          status: QueueEntryStatus.SEATED,
          seatedAt: new Date(),
        },
      });

      // Update table to OCCUPIED
      await tx.restaurantTable.update({
        where: { id: input.tableId },
        data: { status: TableStatus.OCCUPIED },
      });

      // Record table assignment
      const assignment = await tx.tableAssignment.create({
        data: {
          queueEntryId: id,
          tableId: input.tableId,
        },
        include: { table: true },
      });

      await tx.queueEvent.create({
        data: {
          queueEntryId: id,
          fromStatus: entry.status,
          toStatus: QueueEntryStatus.SEATED,
          triggeredBy: staffId,
          reason: `Seated at Table ${table.tableNumber}`,
          metadata: {
            tableId: table.id,
            tableNumber: table.tableNumber,
          },
        },
      });

      return {
        ...updatedEntry,
        tableAssignment: assignment,
      };
    });

    this.emitter?.emitQueueSeated(seatResult, table.tableNumber);
    this.emitter?.broadcastPositionUpdates(entry.restaurantId);

    return seatResult;
  }

  /**
   * Completes dining session, frees the table.
   */
  async completeDining(id: string, staffId = 'STAFF') {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id },
      include: { tableAssignment: true },
    });

    if (!entry) {
      throw new NotFoundError(`Queue entry "${id}" not found`);
    }

    if (entry.status !== QueueEntryStatus.SEATED) {
      throw new AppError(
        `Can only complete entries in "SEATED" status. Current status: "${entry.status}".`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const completeResult = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.queueEntry.update({
        where: { id },
        data: {
          status: QueueEntryStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      // Free table if assigned
      if (entry.tableAssignment) {
        await tx.tableAssignment.update({
          where: { id: entry.tableAssignment.id },
          data: { freedAt: new Date() },
        });

        await tx.restaurantTable.update({
          where: { id: entry.tableAssignment.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      await tx.queueEvent.create({
        data: {
          queueEntryId: id,
          fromStatus: QueueEntryStatus.SEATED,
          toStatus: QueueEntryStatus.COMPLETED,
          triggeredBy: staffId,
          reason: 'Dining completed, table freed',
        },
      });

      return updated;
    });

    this.emitter?.emitQueueCompleted(entry.restaurantId, id);
    this.emitter?.broadcastPositionUpdates(entry.restaurantId);

    return completeResult;
  }

  /**
   * Marks a party as no-show when they do not arrive within the timeout window.
   */
  async markNoShow(id: string, input: NoShowInput, staffId = 'HOST') {
    const entry = await this.prisma.queueEntry.findUnique({
      where: { id },
      include: { tableAssignment: true },
    });

    if (!entry) {
      throw new NotFoundError(`Queue entry "${id}" not found`);
    }

    if (
      entry.status !== QueueEntryStatus.CALLED &&
      entry.status !== QueueEntryStatus.WAITING
    ) {
      throw new AppError(
        `Cannot mark as no-show from status "${entry.status}".`,
        400,
        'INVALID_STATUS_TRANSITION'
      );
    }

    const noShowResult = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.queueEntry.update({
        where: { id },
        data: {
          status: QueueEntryStatus.NO_SHOW,
          noShowAt: new Date(),
        },
      });

      if (entry.tableAssignment) {
        await tx.tableAssignment.update({
          where: { id: entry.tableAssignment.id },
          data: { freedAt: new Date() },
        });

        await tx.restaurantTable.update({
          where: { id: entry.tableAssignment.tableId },
          data: { status: TableStatus.AVAILABLE },
        });
      }

      await tx.queueEvent.create({
        data: {
          queueEntryId: id,
          fromStatus: entry.status,
          toStatus: QueueEntryStatus.NO_SHOW,
          triggeredBy: staffId,
          reason: input.reason ?? 'Guest did not arrive after being called',
        },
      });

      return updated;
    });

    this.emitter?.emitQueueCancelled(entry.restaurantId, id, 'NO_SHOW', input.reason ?? undefined);
    this.emitter?.broadcastPositionUpdates(entry.restaurantId);

    return noShowResult;
  }

  /**
   * Helper to enrich queue entry with live position and wait times.
   */
  private async enrichQueueEntry(entry: any) {
    if (entry.status !== QueueEntryStatus.WAITING) {
      return {
        ...entry,
        positionInLine: null,
        partiesAhead: 0,
      };
    }

    const partiesAhead = await this.prisma.queueEntry.count({
      where: {
        restaurantId: entry.restaurantId,
        status: QueueEntryStatus.WAITING,
        joinedAt: { lt: entry.joinedAt },
      },
    });

    const positionInLine = partiesAhead + 1;
    const estimatedMinutesPerParty =
      entry.restaurant?.operatingSettings?.estimatedMinutesPerParty ?? 15;
    const currentEstimatedWaitMinutes = positionInLine * estimatedMinutesPerParty;

    return {
      ...entry,
      positionInLine,
      partiesAhead,
      currentEstimatedWaitMinutes,
    };
  }
}
