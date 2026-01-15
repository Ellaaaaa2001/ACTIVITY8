import { Pool } from 'mysql2/promise';
export declare class ChatService {
    private readonly pool;
    constructor(pool: Pool);
    getHealth(): Promise<{
        status: string;
    }>;
    getChatrooms(): Promise<any[]>;
    createChatroom(body: any): Promise<{
        id: any;
        name: any;
        description: any;
        members: number;
        activeUsers: number;
        createdBy: any;
        createdAt: Date;
    }>;
    getMessages(roomId: string): Promise<any[]>;
}
