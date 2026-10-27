import { Server as SocketIOServer } from 'socket.io';

export class GroupRealtimeEmitter {
  constructor(private readonly io?: SocketIOServer) {}

  /**
   * Broadcasts when a member joins the group session.
   */
  emitMemberJoined(sessionId: string, member: any) {
    if (!this.io) return;
    this.io.to(`group:${sessionId}`).emit('group:member_joined', {
      sessionId,
      member,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcasts when a member toggles readiness.
   */
  emitMemberReady(sessionId: string, memberId: string, isReady: boolean) {
    if (!this.io) return;
    this.io.to(`group:${sessionId}`).emit('group:member_ready', {
      sessionId,
      memberId,
      isReady,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcasts when the group enters the restaurant queue.
   */
  emitGroupQueueJoined(sessionId: string, queueEntry: any) {
    if (!this.io) return;
    this.io.to(`group:${sessionId}`).emit('group:queue_joined', {
      sessionId,
      queueEntry,
      timestamp: new Date().toISOString(),
    });
  }
}
