import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
interface OfferPayload {
  to: string;
  from: string;
  offer: RTCSessionDescriptionInit; // Built-in WebRTC type
}
interface WebRTCPayload {
  to: string;
  from: string;
  answer: RTCSessionDescriptionInit;
}
// Enable CORS so your React app can connect
@WebSocketGateway({
  cors: {
    origin: '*', // In production, replace with your React app's URL
  },
})
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private users = new Map<string, string>();

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    // Remove user from map on disconnect
    for (const [userId, socketId] of this.users.entries()) {
      if (socketId === client.id) {
        this.users.delete(userId);
        break;
      }
    }
  }
  @SubscribeMessage('register')
  handleRegister(
    @MessageBody() userId: string,
    @ConnectedSocket() client: Socket,
  ) {
    this.users.set(userId, client.id);
    console.log(`User ${userId} registered with socket ${client.id}`);
  }

  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody() data: { to: string; offer: OfferPayload; from: string },
  ) {
    const destSocketId = this.users.get(data.to);
    if (destSocketId) {
      this.server
        .to(destSocketId)
        .emit('offer', { offer: data.offer, from: data.from });
    }
  }
  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() data: { to: string; answer: WebRTCPayload; from: string },
  ) {
    const destSocketId = this.users.get(data.to);
    if (destSocketId) {
      this.server
        .to(destSocketId)
        .emit('answer', { answer: data.answer, from: data.from });
    }
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(@MessageBody() data: { to: string; candidate: any }) {
    const destSocketId = this.users.get(data.to);
    if (destSocketId) {
      this.server.to(destSocketId).emit('ice-candidate', data.candidate);
    }
  }

  @SubscribeMessage('end-call')
  handleEndCall(@MessageBody() data: { to: string }) {
    const destSocketId = this.users.get(data.to);
    if (destSocketId) {
      this.server.to(destSocketId).emit('end-call');
    }
  }
}
