import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersSchema } from './schema/users.schema';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
     MongooseModule.forFeature(
      [
        {
          name: 'Users',
          schema: UsersSchema,
        },
      ],
      'usdenim' // ✅ MUST match the connection name used in forRoot
    ),
    RolesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
