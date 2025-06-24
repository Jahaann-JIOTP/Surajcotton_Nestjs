import { Module, forwardRef } from '@nestjs/common'; // Import forwardRef
import { MongooseModule } from '@nestjs/mongoose';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';
import { RolesSchema } from './schema/roles.schema';
import { UsersModule } from '../users/users.module'; // Import UsersModule
import { PrivellegesSchema } from 'src/privelleges/schema/privelleges.schema';
@Module({
  imports: [
  MongooseModule.forFeature(
    [
      { name: 'Roles', schema: RolesSchema },
      { name: 'Privelleges', schema: PrivellegesSchema },
    ],
    'surajcotton' // ✅ This must match your forRoot connectionName
  ),
  forwardRef(() => UsersModule),
],

  controllers: [RolesController],
  providers: [RolesService],
  exports: [MongooseModule, RolesService],
})
export class RolesModule {}
