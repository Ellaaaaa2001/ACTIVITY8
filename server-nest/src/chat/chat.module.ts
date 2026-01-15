import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { DatabaseProvider } from './database.provider';

@Module({
  controllers: [ChatController],
  providers: [ChatGateway, ChatService, DatabaseProvider],
})
export class ChatModule {}
