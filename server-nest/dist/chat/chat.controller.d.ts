import { ChatService } from './chat.service';
export declare class ChatController {
    private readonly chatService;
    constructor(chatService: ChatService);
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
