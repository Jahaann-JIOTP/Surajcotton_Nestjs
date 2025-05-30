import { Module } from '@nestjs/common';
import { PrivellegesController } from './privelleges.controller';
import { PrivellegesService } from './privelleges.service';
import { MongooseModule } from '@nestjs/mongoose';
import { PrivellegesSchema } from './schema/privelleges.schema';
import { RolesModule } from 'src/roles/roles.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'Privelleges',
        schema: PrivellegesSchema,
      },
    ]),
    RolesModule,
  ],
  controllers: [PrivellegesController],
  providers: [PrivellegesService],
})
export class PrivellegesModule {}
