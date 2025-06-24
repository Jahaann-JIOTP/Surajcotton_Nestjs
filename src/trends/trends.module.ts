import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TrendsService } from './trends.service';
import { TrendsController } from './trends.controller';
import { CSNew, CSNewSchema } from './schemas/CS-new.schema'; // ✅ Your schema import

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: CSNew.name, schema: CSNewSchema }],
      'surajcotton', // ✅ Must match the connection name used in InjectModel
    ),
  ],
  controllers: [TrendsController],
  providers: [TrendsService],
})
export class TrendsModule {}
