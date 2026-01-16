import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { ChatService } from './chat.service';

@ApiTags('Chat')
@Controller('api')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('health')
  @ApiOperation({ summary: 'Check API health status' })
  @ApiResponse({ 
    status: 200, 
    description: 'API is healthy',
    schema: {
      example: { status: 'ok', timestamp: '2026-01-16T12:00:00.000Z' }
    }
  })
  getHealth() {
    return this.chatService.getHealth();
  }

  @Get('chatrooms')
  @ApiOperation({ summary: 'Get all chatrooms' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of all chatrooms',
    schema: {
      example: [
        { id: 1, name: 'General', description: 'General discussion', createdAt: '2026-01-15T10:00:00.000Z' },
        { id: 2, name: 'Tech Talk', description: 'Technology discussions', createdAt: '2026-01-15T11:30:00.000Z' }
      ]
    }
  })
  getChatrooms() {
    return this.chatService.getChatrooms();
  }

  @Post('chatrooms')
  @ApiOperation({ summary: 'Create a new chatroom' })
  @ApiBody({
    description: 'Chatroom creation payload',
    schema: {
      example: {
        name: 'Random',
        description: 'A place for random conversations'
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Chatroom created successfully',
    schema: {
      example: {
        id: 3,
        name: 'Random',
        description: 'A place for random conversations',
        createdAt: '2026-01-16T12:00:00.000Z'
      }
    }
  })
  async createChatroom(@Body() body: any) {
    const room = await this.chatService.createChatroom(body);
    return room;
  }

  @Get('chatrooms/:roomId/messages')
  @ApiOperation({ summary: 'Get messages from a specific chatroom' })
  @ApiParam({ 
    name: 'roomId', 
    description: 'The ID of the chatroom',
    example: '1'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of messages in the chatroom',
    schema: {
      example: [
        { 
          id: 1, 
          roomId: 1, 
          username: 'john_doe', 
          message: 'Hello everyone!', 
          timestamp: '2026-01-16T11:45:00.000Z' 
        },
        { 
          id: 2, 
          roomId: 1, 
          username: 'jane_smith', 
          message: 'Hi there!', 
          timestamp: '2026-01-16T11:46:30.000Z' 
        }
      ]
    }
  })
  getMessages(@Param('roomId') roomId: string) {
    return this.chatService.getMessages(roomId);
  }
}
