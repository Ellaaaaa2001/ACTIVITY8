"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const database_provider_1 = require("./database.provider");
let ChatService = class ChatService {
    constructor(pool) {
        this.pool = pool;
    }
    async getHealth() {
        return { status: 'ok' };
    }
    async getChatrooms() {
        const [rows] = await this.pool.query('SELECT * FROM chatrooms ORDER BY createdAt ASC');
        return rows;
    }
    async createChatroom(body) {
        const { id, name, description, createdBy } = body || {};
        if (!name) {
            throw new Error('Name is required');
        }
        const roomId = id || Date.now().toString();
        const createdAt = new Date();
        await this.pool.query('INSERT IGNORE INTO chatrooms (id, name, description, members, activeUsers, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [roomId, name, description || null, 0, 0, createdBy || null, createdAt]);
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
    async getMessages(roomId) {
        const [rows] = await this.pool.query('SELECT id, roomId, userId, username, content, isSystem, createdAt FROM messages WHERE roomId = ? ORDER BY createdAt ASC', [roomId]);
        return rows;
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(database_provider_1.MYSQL_POOL)),
    __metadata("design:paramtypes", [Object])
], ChatService);
//# sourceMappingURL=chat.service.js.map