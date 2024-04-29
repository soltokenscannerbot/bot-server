import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TelegramModule } from './telegram/telegram.module';
import { SolanaModule } from './solana/solana.module';

@Module({
  imports: [TelegramModule, SolanaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
