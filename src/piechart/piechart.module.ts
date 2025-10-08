// src/pie-chart/pie_chart.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PieChartService } from './piechart.service';
import { PieChartController } from './piechart.controller';
import { PieChartSchema } from './schemas/pie-chart.schema';

@Module({
  imports: [
    MongooseModule.forFeature(
      [{ name: 'PieChart', schema: PieChartSchema }],
      'surajcotton', // 👈 Make sure this is your DB connection name
    ),
  ],
  controllers: [PieChartController],
  providers: [PieChartService],
})
export class PieChartModule {}
