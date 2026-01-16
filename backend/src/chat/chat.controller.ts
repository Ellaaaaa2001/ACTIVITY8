import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('api')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('health')
  getHealth() {
    return this.chatService.getHealth();
  }

  @Get('chatrooms')
  getChatrooms() {
    return this.chatService.getChatrooms();
  }

  @Post('chatrooms')
  async createChatroom(@Body() body: any) {
    const room = await this.chatService.createChatroom(body);
    return room;
  }

  @Get('chatrooms/:roomId/messages')
  getMessages(@Param('roomId') roomId: string) {
    return this.chatService.getMessages(roomId);
  }
}
