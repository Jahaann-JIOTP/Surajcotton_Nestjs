import { Module } from '@nestjs/common';
// import { PrivellegesController } from './privelleges.controller';
import { PrivellegesService } from './privelleges.service';
import { MongooseModule } from '@nestjs/mongoose';
// import { PrivellegesService } from './privelleges.service';
import { Privelleges, PrivellegesSchema } from './schema/privelleges.schema';
import { Users, UsersSchema } from 'src/users/schema/users.schema';
import { Roles, RolesSchema } from 'src/roles/schema/roles.schema';
import { PrivellegesController } from './privelleges.controller';

@Module({
 imports: [
    MongooseModule.forFeature(
      [
        { name: Privelleges.name, schema: PrivellegesSchema },
        { name: Users.name, schema: UsersSchema },
        { name: Roles.name, schema: RolesSchema },
      ],
      'usdenim', // << make sure this matches your DB connection name
    ),
  ],

  controllers: [PrivellegesController],
  providers: [PrivellegesService],
})
export class PrivellegesModule {}
