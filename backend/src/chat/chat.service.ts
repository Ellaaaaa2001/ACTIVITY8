import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'mysql2/promise';
import { MYSQL_POOL } from './database.provider';

@Injectable()
export class ChatService {
  constructor(@Inject(MYSQL_POOL) private readonly pool: Pool) {}

  async getHealth() {
    return { status: 'ok' };
  }

  async getChatrooms() {
    const [rows] = await this.pool.query('SELECT * FROM chatrooms ORDER BY createdAt ASC');
    return rows as any[];
  }

  async createChatroom(body: any) {
    const { id, name, description, createdBy } = body || {};
    if (!name) {
      throw new Error('Name is required');
    }

    const roomId = id || Date.now().toString();
    const createdAt = new Date();

    await this.pool.query(
      'INSERT IGNORE INTO chatrooms (id, name, description, members, activeUsers, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roomId, name, description || null, 0, 0, createdBy || null, createdAt],
    );

    return {
      id: roomId,
      name,
      description: description || '',
      members: 0,
      activeUsers: 0,
      createdBy: createdBy || null,
      createdAt,
    };
  }

  async getMessages(roomId: string) {
    const [rows] = await this.pool.query(
      'SELECT id, roomId, userId, username, content, isSystem, createdAt FROM messages WHERE roomId = ? ORDER BY createdAt ASC',
      [roomId],
    );
    return rows as any[];
  }
}
