import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * BookingsGateway — real-time events for the booking lifecycle.
 *
 * Rooms:
 *   doctor:{doctorId}   — all events for a doctor's bookings
 *   booking:{bookingId} — events for a specific booking
 *
 * Events emitted:
 *   booking:new        — new PENDING_PAYMENT booking created
 *   booking:confirmed  — payment captured
 *   booking:cancelled  — any cancellation
 *   booking:completed  — consultation ended
 */
@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws',
})
export class BookingsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(BookingsGateway.name);

  handleConnection(client: Socket) {
    this.logger.debug(`WS connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`WS disconnected: ${client.id}`);
  }

  /** Client subscribes to a doctor room (doctor dashboard) */
  @SubscribeMessage('join:doctor')
  joinDoctorRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() doctorId: string,
  ) {
    void client.join(`doctor:${doctorId}`);
    this.logger.debug(`${client.id} joined doctor:${doctorId}`);
  }

  /** Client subscribes to a specific booking room (booking detail page) */
  @SubscribeMessage('join:booking')
  joinBookingRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() bookingId: string,
  ) {
    void client.join(`booking:${bookingId}`);
    this.logger.debug(`${client.id} joined booking:${bookingId}`);
  }

  // ── Emit helpers (called by BookingsService / PaymentsService) ────────────

  emitBookingNew(doctorId: string, payload: Record<string, unknown>) {
    this.server.to(`doctor:${doctorId}`).emit('booking:new', payload);
  }

  emitBookingConfirmed(doctorId: string, bookingId: string, payload: Record<string, unknown>) {
    this.server.to(`doctor:${doctorId}`).emit('booking:confirmed', payload);
    this.server.to(`booking:${bookingId}`).emit('booking:confirmed', payload);
  }

  emitBookingCancelled(doctorId: string, bookingId: string, payload: Record<string, unknown>) {
    this.server.to(`doctor:${doctorId}`).emit('booking:cancelled', payload);
    this.server.to(`booking:${bookingId}`).emit('booking:cancelled', payload);
  }

  emitBookingCompleted(doctorId: string, bookingId: string, payload: Record<string, unknown>) {
    this.server.to(`doctor:${doctorId}`).emit('booking:completed', payload);
    this.server.to(`booking:${bookingId}`).emit('booking:completed', payload);
  }
}
