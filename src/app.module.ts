import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';

import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { PrivellegesModule } from './privelleges/privelleges.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // MongooseModule.forRoot(process.env.surajcotton_URI!),
    // MongooseModule.forRoot(process.env.MONGODB_URI!),
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(process.env.usdenim_URI!, {
      connectionName: 'usdenim',
    }),
    UsersModule,
    AuthModule,
    
    RolesModule,
    PrivellegesModule,
   
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
