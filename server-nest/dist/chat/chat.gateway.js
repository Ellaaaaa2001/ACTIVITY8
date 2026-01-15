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
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
const database_provider_1 = require("./database.provider");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    constructor(pool) {
        this.pool = pool;
        this.logger = new common_1.Logger(ChatGateway_1.name);
        this.rooms = {};
        this.joinRequests = {};
    }
    handleConnection(client) {
        this.logger.log(`Client connected ${client.id}`);
    }
    handleDisconnect(client) {
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
    getRoomUsers(roomId) {
        if (!this.rooms[roomId])
            return [];
        return Object.values(this.rooms[roomId].users);
    }
    async handleGetRooms(client) {
        try {
            const [rows] = await this.pool.query('SELECT * FROM chatrooms ORDER BY createdAt ASC');
            client.emit('rooms', rows);
        }
        catch (err) {
            this.logger.error('Error fetching rooms from DB', err);
            client.emit('rooms', []);
        }
    }
    async handleCreateRoom(data) {
        const { room } = data || {};
        if (!room || !room.id || !room.name)
            return;
        try {
            await this.pool.query('INSERT IGNORE INTO chatrooms (id, name, description, members, activeUsers, createdBy, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                room.id,
                room.name,
                room.description || null,
                room.members || 0,
                room.activeUsers || 0,
                room.createdBy || null,
                room.createdAt ? new Date(room.createdAt) : new Date(),
            ]);
            this.server.emit('roomCreated', room);
        }
        catch (err) {
            this.logger.error('Error creating room in DB', err);
        }
    }
    handleJoinRoom(data, client) {
        const { roomId, user } = data || {};
        if (!roomId || !user)
            return;
        client.join(roomId);
        if (!this.rooms[roomId]) {
            this.rooms[roomId] = { users: {} };
        }
        this.rooms[roomId].users[client.id] = user;
        this.server.to(roomId).emit('activeUsers', this.getRoomUsers(roomId));
    }
    async handleSendMessage(data) {
        var _a, _b;
        const { roomId, message } = data || {};
        if (!roomId || !message)
            return;
        const withTimestamp = {
            ...message,
            timestamp: message.timestamp || new Date().toISOString(),
        };
        this.server.to(roomId).emit('message', withTimestamp);
        try {
            await this.pool.query('INSERT IGNORE INTO messages (id, roomId, userId, username, content, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                withTimestamp.id,
                roomId,
                ((_a = withTimestamp.user) === null || _a === void 0 ? void 0 : _a.id) || null,
                ((_b = withTimestamp.user) === null || _b === void 0 ? void 0 : _b.username) || null,
                withTimestamp.content,
                withTimestamp.isSystem ? 1 : 0,
                new Date(withTimestamp.timestamp),
            ]);
        }
        catch (err) {
            this.logger.error('Error saving chat message', err);
        }
    }
    handleTyping(data, client) {
        const { roomId, user } = data || {};
        if (!roomId || !user)
            return;
        client.to(roomId).emit('userTyping', { user });
    }
    handleStopTyping(data, client) {
        const { roomId, user } = data || {};
        if (!roomId || !user)
            return;
        client.to(roomId).emit('userStopTyping', { user });
    }
    async handleGetMessages(data, client) {
        const { roomId } = data || {};
        if (!roomId)
            return;
        try {
            const [rows] = await this.pool.query('SELECT id, roomId, userId, username, content, isSystem, createdAt FROM messages WHERE roomId = ? ORDER BY createdAt ASC', [roomId]);
            client.emit('messages', rows);
        }
        catch (err) {
            this.logger.error('Error fetching messages from DB', err);
            client.emit('messages', []);
        }
    }
    async handleLeaveRoom(data, client) {
        const { roomId, user } = data || {};
        if (!roomId || !this.rooms[roomId])
            return;
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
                await this.pool.query('INSERT IGNORE INTO messages (id, roomId, userId, username, content, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [msg.id, roomId, null, 'System', msg.content, 1, new Date(msg.timestamp)]);
            }
            catch (err) {
                this.logger.error('Error saving leave message', err);
            }
        }
    }
    async handleRequestJoinRoom(data, client) {
        const { roomId, user } = data || {};
        if (!roomId || !user)
            return;
        try {
            const [existing] = await this.pool.query('SELECT * FROM join_requests WHERE roomId = ? AND userId = ? AND status = ?', [roomId, user.id, 'pending']);
            if (existing.length > 0) {
                client.emit('joinRequestStatus', { status: 'already_pending' });
                return;
            }
            await this.pool.query('INSERT INTO join_requests (roomId, userId, username, status, createdAt) VALUES (?, ?, ?, ?, ?)', [roomId, user.id, user.username, 'pending', new Date()]);
            if (!this.joinRequests[roomId]) {
                this.joinRequests[roomId] = [];
            }
            const request = {
                userId: user.id,
                username: user.username,
                socketId: client.id,
                timestamp: new Date().toISOString(),
            };
            this.joinRequests[roomId].push(request);
            this.server.to(roomId).emit('newJoinRequest', { roomId, user });
            client.emit('joinRequestStatus', { status: 'sent' });
        }
        catch (err) {
            this.logger.error('Error creating join request', err);
            client.emit('joinRequestStatus', { status: 'error' });
        }
    }
    async handleGetJoinRequests(data, client) {
        const { roomId } = data || {};
        if (!roomId)
            return;
        try {
            const [rows] = await this.pool.query('SELECT * FROM join_requests WHERE roomId = ? AND status = ? ORDER BY createdAt DESC', [roomId, 'pending']);
            const requests = rows.map((row) => ({
                userId: String(row.userId),
                username: row.username,
            }));
            client.emit('joinRequestsList', { roomId, requests });
        }
        catch (err) {
            this.logger.error('Error fetching join requests', err);
            client.emit('joinRequestsList', { roomId, requests: [] });
        }
    }
    async handleApproveJoinRequest(data, client) {
        const { roomId, userId, username } = data || {};
        if (!roomId || !userId)
            return;
        try {
            await this.pool.query('UPDATE join_requests SET status = ? WHERE roomId = ? AND userId = ?', ['approved', roomId, userId]);
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
            await this.pool.query('INSERT IGNORE INTO messages (id, roomId, userId, username, content, isSystem, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)', [msg.id, roomId, null, 'System', msg.content, 1, new Date(msg.timestamp)]);
            this.server.emit('joinRequestApproved', { roomId, userId });
            client.emit('requestApproved', { roomId, userId, username });
        }
        catch (err) {
            this.logger.error('Error approving join request', err);
        }
    }
    async handleRejectJoinRequest(data, client) {
        const { roomId, userId, username } = data || {};
        if (!roomId || !userId)
            return;
        try {
            await this.pool.query('UPDATE join_requests SET status = ? WHERE roomId = ? AND userId = ?', ['rejected', roomId, userId]);
            if (this.joinRequests[roomId]) {
                this.joinRequests[roomId] = this.joinRequests[roomId].filter((r) => r.userId !== userId);
            }
            this.server.emit('joinRequestRejected', { roomId, userId });
            client.emit('requestRejected', { roomId, userId, username });
        }
        catch (err) {
            this.logger.error('Error rejecting join request', err);
        }
    }
    async handleCheckJoinApproval(data, client) {
        const { roomId, userId } = data || {};
        if (!roomId || !userId)
            return;
        try {
            const [rows] = await this.pool.query('SELECT status FROM join_requests WHERE roomId = ? AND userId = ? ORDER BY createdAt DESC LIMIT 1', [roomId, userId]);
            const arr = rows;
            if (arr.length > 0) {
                client.emit('joinApprovalStatus', { roomId, status: arr[0].status });
            }
            else {
                client.emit('joinApprovalStatus', { roomId, status: 'none' });
            }
        }
        catch (err) {
            this.logger.error('Error checking join approval', err);
            client.emit('joinApprovalStatus', { roomId, status: 'error' });
        }
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('getRooms'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleGetRooms", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('createRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleCreateRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sendMessage'),
    __param(0, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('stopTyping'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleStopTyping", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('getMessages'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleGetMessages", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleLeaveRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('requestJoinRoom'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleRequestJoinRoom", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('getJoinRequests'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleGetJoinRequests", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('approveJoinRequest'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleApproveJoinRequest", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('rejectJoinRequest'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleRejectJoinRequest", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('checkJoinApproval'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, socket_io_1.Socket]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleCheckJoinApproval", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: ['http://localhost:3000', 'http://localhost:3002'],
            methods: ['GET', 'POST'],
        },
    }),
    __param(0, (0, common_1.Inject)(database_provider_1.MYSQL_POOL)),
    __metadata("design:paramtypes", [Object])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map