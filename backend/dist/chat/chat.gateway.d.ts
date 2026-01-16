import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Pool } from 'mysql2/promise';
export declare class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly pool;
    server: Server;
    private readonly logger;
    private rooms;
    private joinRequests;
    constructor(pool: Pool);
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    private getRoomUsers;
    handleGetRooms(client: Socket): Promise<void>;
    handleCreateRoom(data: any): Promise<void>;
    handleJoinRoom(data: any, client: Socket): void;
    handleSendMessage(data: any): Promise<void>;
    handleTyping(data: any, client: Socket): void;
    handleStopTyping(data: any, client: Socket): void;
    handleGetMessages(data: any, client: Socket): Promise<void>;
    handleLeaveRoom(data: any, client: Socket): Promise<void>;
    handleRequestJoinRoom(data: any, client: Socket): Promise<void>;
    handleGetJoinRequests(data: any, client: Socket): Promise<void>;
    handleApproveJoinRequest(data: any, client: Socket): Promise<void>;
    handleRejectJoinRequest(data: any, client: Socket): Promise<void>;
    handleCheckJoinApproval(data: any, client: Socket): Promise<void>;
}
