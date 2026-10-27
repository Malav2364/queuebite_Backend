import {
  GroupSessionStatus,
  MemberRsvpStatus,
  PrismaClient,
} from '@prisma/client';
import { customAlphabet } from 'nanoid';
import { AppError, ConflictError, NotFoundError } from '../../errors/app-error.js';
import { QueueService } from '../queues/queue.service.js';
import { GroupRealtimeEmitter } from './group.events.js';
import {
  CreateGroupSessionInput,
  JoinGroupSessionInput,
} from './group.schema.js';

const generateCode = customAlphabet('23456789ABCDEFGHJKLMNPQRSTUVWXYZ', 4);

export class GroupService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly queueService: QueueService,
    private readonly emitter?: GroupRealtimeEmitter
  ) {}

  /**
   * Generates a collision-resistant share code like QB-8K4P.
   */
  private async generateUniqueCode(): Promise<string> {
    for (let attempts = 0; attempts < 5; attempts++) {
      const candidate = `QB-${generateCode()}`;
      const existing = await this.prisma.groupSession.findUnique({
        where: { code: candidate },
        select: { id: true },
      });
      if (!existing) return candidate;
    }
    return `QB-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  }

  /**
   * Creates a new collaborative group dining session.
   */
  async createSession(input: CreateGroupSessionInput, userId?: string) {
    const restaurant = await this.prisma.restaurant.findUnique({
      where: { id: input.restaurantId },
      select: { id: true, name: true, isQueueOpen: true },
    });

    if (!restaurant) {
      throw new NotFoundError(`Restaurant "${input.restaurantId}" not found`);
    }

    const code = await this.generateUniqueCode();

    const session = await this.prisma.groupSession.create({
      data: {
        code,
        restaurantId: input.restaurantId,
        creatorId: userId ?? null,
        creatorName: input.creatorName,
        name: input.name ?? `${input.creatorName}'s Party`,
        status: GroupSessionStatus.PLANNING,
        members: {
          create: {
            name: input.creatorName,
            phone: input.creatorPhone ?? null,
            userId: userId ?? null,
            status: MemberRsvpStatus.ACCEPTED,
            isReady: true,
          },
        },
      },
      include: {
        restaurant: {
          include: {
            location: true,
          },
        },
        members: true,
      },
    });

    return session;
  }

  /**
   * Fetches a group session by invite code or UUID.
   */
  async getSession(codeOrId: string) {
    const session = await this.prisma.groupSession.findFirst({
      where: {
        OR: [
          { id: codeOrId },
          { code: codeOrId.toUpperCase() },
        ],
      },
      include: {
        restaurant: {
          include: {
            location: true,
          },
        },
        members: {
          orderBy: { joinedAt: 'asc' },
        },
        queueEntry: true,
        preOrders: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundError(`Group session "${codeOrId}" not found`);
    }

    return session;
  }

  /**
   * Adds a member to an existing party using code or session id.
   */
  async joinSession(
    codeOrId: string,
    input: JoinGroupSessionInput,
    userId?: string
  ) {
    const session = await this.getSession(codeOrId);

    if (
      session.status === GroupSessionStatus.COMPLETED ||
      session.status === GroupSessionStatus.CANCELLED
    ) {
      throw new ConflictError(
        'This group dining session is no longer active.'
      );
    }

    // Check if member with same name already joined
    const existingMember = session.members.find(
      (m) => m.name.toLowerCase() === input.name.trim().toLowerCase()
    );

    let member;
    if (existingMember) {
      member = await this.prisma.groupMember.update({
        where: { id: existingMember.id },
        data: {
          phone: input.phone ?? existingMember.phone,
          dietaryNotes: input.dietaryNotes ?? existingMember.dietaryNotes,
          userId: userId ?? existingMember.userId,
        },
      });
    } else {
      member = await this.prisma.groupMember.create({
        data: {
          sessionId: session.id,
          name: input.name.trim(),
          phone: input.phone ?? null,
          dietaryNotes: input.dietaryNotes ?? null,
          userId: userId ?? null,
          status: MemberRsvpStatus.ACCEPTED,
          isReady: false,
        },
      });
    }

    this.emitter?.emitMemberJoined(session.id, member);

    return {
      session: await this.getSession(session.id),
      member,
    };
  }

  /**
   * Toggles readiness / arrival of an individual party member.
   */
  async toggleMemberReady(
    sessionId: string,
    memberId: string,
    isReady: boolean
  ) {
    const member = await this.prisma.groupMember.findFirst({
      where: { id: memberId, sessionId },
    });

    if (!member) {
      throw new NotFoundError(
        `Member "${memberId}" not found in session "${sessionId}"`
      );
    }

    const updated = await this.prisma.groupMember.update({
      where: { id: memberId },
      data: { isReady },
    });

    this.emitter?.emitMemberReady(sessionId, memberId, isReady);

    return updated;
  }

  /**
   * Submits the collective group into the restaurant queue as a single consolidated party.
   */
  async submitGroupToQueue(sessionId: string, notes?: string) {
    const session = await this.getSession(sessionId);

    if (session.status === GroupSessionStatus.QUEUE_JOINED) {
      throw new ConflictError(
        'This group is already queued for a table.'
      );
    }

    if (session.status !== GroupSessionStatus.PLANNING) {
      throw new AppError(
        `Cannot join queue from status "${session.status}".`,
        400,
        'INVALID_SESSION_STATUS'
      );
    }

    const acceptedMembers = session.members.filter(
      (m) => m.status === MemberRsvpStatus.ACCEPTED
    );
    const partySize = Math.max(1, acceptedMembers.length);

    const primaryContact = session.members[0];
    const guestName = session.creatorName || primaryContact?.name || 'Party';
    const guestPhone = primaryContact?.phone || '9999999999';

    // Join virtual queue via QueueService
    const queueEntry = await this.queueService.joinQueue(
      session.restaurantId,
      {
        guestName,
        guestPhone,
        partySize,
        notes: notes || session.name || `Group of ${partySize}`,
      },
      session.creatorId ?? undefined
    );

    // Link queue entry to group session
    const updatedSession = await this.prisma.groupSession.update({
      where: { id: session.id },
      data: {
        status: GroupSessionStatus.QUEUE_JOINED,
        queueEntryId: queueEntry.id,
      },
      include: {
        restaurant: {
          include: { location: true },
        },
        members: true,
        queueEntry: true,
      },
    });

    this.emitter?.emitGroupQueueJoined(session.id, queueEntry);

    return updatedSession;
  }
}
