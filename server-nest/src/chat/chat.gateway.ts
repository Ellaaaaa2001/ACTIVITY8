import {
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { MYSQL_POOL } from './database.provider';

interface UserPayload {
  id: string;
  username: string;
}

interface JoinRequest {
  userId: string;
  username: string;
  socketId: string;
  timestamp: string;
}

interface RoomState {
  users: Record<string, UserPayload>;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3002'],
    methods: ['GET', 'POST'],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  private rooms: Record<string, RoomState> = {};
  private joinRequests: Record<string, JoinRequest[]> = {};

  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    Object.keys(this.rooms).forEach((roomId) => {
      const room = this.rooms[roomId];
      const user = room.users[client.id];
      if (user) {
        delete room.users[client.id];
        this.server.to(roomId).emit('activeUsers', this.getRoomUsers(roomId));
      }
    });

    this.logger.log(`Client disconnected ${client.id}`);
  }

  private getRoomUsers(roomId: string): UserPayload[] {
    if (!this.rooms[roomId]) return [];
    return Object.values(this.rooms[roomId].users);
  }

  // Socket events mirrored from existing Express server

  @SubscribeMessage('getRooms')
  async handleGetRooms(@ConnectedSocket() client: Socket) {
    try {
      const [rows] = await this.pool.query('SELECT * FROM chatrooms ORDER BY createdAt ASC');
      client.emit('rooms', rows);
    } catch (err) {
      this.logger.error('Error fetching rooms from DB', err as any);
      client.emit('rooms', []);
    }
  }

  @SubscribeMessage('createRoom')
  async handleCreateRoom(@MessageBody() data: any) {
    const { room } = data || {};
    if (!room || !room.id || !room.name) return;

    try {
      await this.pool.query(
        'INSERT IGNORE INTO chatrooms (id, name, description, members, activeUsers, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          room.id,
          room.name,
          room.description || null,
          room.members || 0,
          room.activeUsers || 0,
          room.createdBy || null,
          room.createdAt ? new Date(room.createdAt) : new Date(),
        ],
      );

      this.server.emit('roomCreated', room);
    } catch (err) {
      this.logger.error('Error creating room in DB', err as any);
    }
  }

  @SubscribeMessage('joinRoom')
  handleJoinRoom(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId, user } = data || {};
    if (!roomId || !user) return;

    client.join(roomId);

    if (!this.rooms[roomId]) {
      this.rooms[roomId] = { users: {} };
    }

    this.rooms[roomId].users[client.id] = user;

    this.server.to(roomId).emit('activeUsers', this.getRoomUsers(roomId));
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(@MessageBody() data: any) {
    const { roomId, message } = data || {};
    if (!roomId || !message) return;

    const withTimestamp = {
      ...message,
      timestamp: message.timestamp || new Date().toISOString(),
    };

    this.server.to(roomId).emit('message', withTimestamp);

    try {
      await this.pool.query(
        'INSERT IGNORE INTO messages (id, roomId, userId, username, content, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          withTimestamp.id,
          roomId,
          withTimestamp.user?.id || null,
          withTimestamp.user?.username || null,
          withTimestamp.content,
          withTimestamp.isSystem ? 1 : 0,
          new Date(withTimestamp.timestamp),
        ],
      );
    } catch (err) {
      this.logger.error('Error saving chat message', err as any);
    }
  }

  @SubscribeMessage('typing')
  handleTyping(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId, user } = data || {};
    if (!roomId || !user) return;
    client.to(roomId).emit('userTyping', { user });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId, user } = data || {};
    if (!roomId || !user) return;
    client.to(roomId).emit('userStopTyping', { user });
  }

  @SubscribeMessage('getMessages')
  async handleGetMessages(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId } = data || {};
    if (!roomId) return;

    try {
      const [rows] = await this.pool.query(
        'SELECT id, roomId, userId, username, content, isSystem, createdAt FROM messages WHERE roomId = ? ORDER BY createdAt ASC',
        [roomId],
      );
      client.emit('messages', rows);
    } catch (err) {
      this.logger.error('Error fetching messages from DB', err as any);
      client.emit('messages', []);
    }
  }

  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId, user } = data || {};
    if (!roomId || !this.rooms[roomId]) return;

    client.leave(roomId);

    if (this.rooms[roomId].users[client.id]) {
      delete this.rooms[roomId].users[client.id];
      this.server.to(roomId).emit('activeUsers', this.getRoomUsers(roomId));

      const msg = {
        id: Date.now().toString(),
        user: { id: 'system', username: 'System' },
        content: `${user.username} left the room.`,
        timestamp: new Date().toISOString(),
        isSystem: true,
      };

      this.server.to(roomId).emit('systemMessage', msg);

      try {
        await this.pool.query(
          'INSERT IGNORE INTO messages (id, roomId, userId, username, content, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [msg.id, roomId, null, 'System', msg.content, 1, new Date(msg.timestamp)],
        );
      } catch (err) {
        this.logger.error('Error saving leave message', err as any);
      }
    }
  }

  // Join request system

  @SubscribeMessage('requestJoinRoom')
  async handleRequestJoinRoom(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId, user } = data || {};
    if (!roomId || !user) return;

    try {
      const [existing] = await this.pool.query(
        'SELECT * FROM join_requests WHERE roomId = ? AND userId = ? AND status = ?',[roomId, user.id, 'pending'],
      );

      if ((existing as any[]).length > 0) {
        client.emit('joinRequestStatus', { status: 'already_pending' });
        return;
      }

      await this.pool.query(
        'INSERT INTO join_requests (roomId, userId, username, status, createdAt) VALUES (?, ?, ?, ?, ?)',
        [roomId, user.id, user.username, 'pending', new Date()],
      );

      if (!this.joinRequests[roomId]) {
        this.joinRequests[roomId] = [];
      }

      const request: JoinRequest = {
        userId: user.id,
        username: user.username,
        socketId: client.id,
        timestamp: new Date().toISOString(),
      };

      this.joinRequests[roomId].push(request);

      this.server.to(roomId).emit('newJoinRequest', { roomId, user });
      client.emit('joinRequestStatus', { status: 'sent' });
    } catch (err) {
      this.logger.error('Error creating join request', err as any);
      client.emit('joinRequestStatus', { status: 'error' });
    }
  }

  @SubscribeMessage('getJoinRequests')
  async handleGetJoinRequests(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId } = data || {};
    if (!roomId) return;

    try {
      const [rows] = await this.pool.query(
        'SELECT * FROM join_requests WHERE roomId = ? AND status = ? ORDER BY createdAt DESC',
        [roomId, 'pending'],
      );

      const requests = (rows as any[]).map((row) => ({
        userId: String(row.userId),
        username: row.username,
      }));

      client.emit('joinRequestsList', { roomId, requests });
    } catch (err) {
      this.logger.error('Error fetching join requests', err as any);
      client.emit('joinRequestsList', { roomId, requests: [] });
    }
  }

  @SubscribeMessage('approveJoinRequest')
  async handleApproveJoinRequest(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId, userId, username } = data || {};
    if (!roomId || !userId) return;

    try {
      await this.pool.query(
        'UPDATE join_requests SET status = ? WHERE roomId = ? AND userId = ?',
        ['approved', roomId, userId],
      );

      if (this.joinRequests[roomId]) {
        this.joinRequests[roomId] = this.joinRequests[roomId].filter((r) => r.userId !== userId);
      }

      const msg = {
        id: Date.now().toString(),
        user: { id: 'system', username: 'System' },
        content: `${username} joined the room.`,
        timestamp: new Date().toISOString(),
        isSystem: true,
      };

      this.server.to(roomId).emit('systemMessage', msg);

      await this.pool.query(
        'INSERT IGNORE INTO messages (id, roomId, userId, username, content, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [msg.id, roomId, null, 'System', msg.content, 1, new Date(msg.timestamp)],
      );

      this.server.emit('joinRequestApproved', { roomId, userId });
      client.emit('requestApproved', { roomId, userId, username });
    } catch (err) {
      this.logger.error('Error approving join request', err as any);
    }
  }

  @SubscribeMessage('rejectJoinRequest')
  async handleRejectJoinRequest(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId, userId, username } = data || {};
    if (!roomId || !userId) return;

    try {
      await this.pool.query(
        'UPDATE join_requests SET status = ? WHERE roomId = ? AND userId = ?',
        ['rejected', roomId, userId],
      );

      if (this.joinRequests[roomId]) {
        this.joinRequests[roomId] = this.joinRequests[roomId].filter((r) => r.userId !== userId);
      }

      this.server.emit('joinRequestRejected', { roomId, userId });
      client.emit('requestRejected', { roomId, userId, username });
    } catch (err) {
      this.logger.error('Error rejecting join request', err as any);
    }
  }

  @SubscribeMessage('checkJoinApproval')
  async handleCheckJoinApproval(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const { roomId, userId } = data || {};
    if (!roomId || !userId) return;

    try {
      const [rows] = await this.pool.query(
        'SELECT status FROM join_requests WHERE roomId = ? AND userId = ? ORDER BY createdAt DESC LIMIT 1',
        [roomId, userId],
      );

      const arr = rows as any[];
      if (arr.length > 0) {
        client.emit('joinApprovalStatus', { roomId, status: arr[0].status });
      } else {
        client.emit('joinApprovalStatus', { roomId, status: 'none' });
      }
    } catch (err) {
      this.logger.error('Error checking join approval', err as any);
      client.emit('joinApprovalStatus', { roomId, status: 'error' });
    }
  }
}
