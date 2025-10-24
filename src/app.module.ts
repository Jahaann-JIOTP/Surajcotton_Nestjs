import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';

import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { PrivellegesModule } from './privelleges/privelleges.module';
import { TrendsModule } from './trends/trends.module';
import { ProductionModule } from './production/production.module';
import { EnergyCostModule } from './energy_cost/energy_cost.module';
import { LogsDataModule } from './logs_data/logs_data.module';
import { NodeRedLinkModule } from './node_red_link/node_red_link.module';
import { meter_dataModule } from './meter_data/meter_data.module';
import { EnergyUsageReportModule } from './energy_usage_report/energy_usage_report.module';
import {EnergyconsumptionreportModule } from './energy_consumption_report/energy_consumption_report.module';
import { Unit4Lt1Module } from './unit4_lt1/unit4_lt1.module';
import { sankeyModule } from './sankey/sankey.module';
import { ProductionMonthwiseModule } from './production-monthwise/production-monthwise.module';
import { ConsumptionEnergyModule } from './consumption_energy/consumption_energy.module';
import { GenerationEnergyModule } from './generation_energy/generation_energy.module';
import { EnergyModule } from './energy/energy.module';
import { EnergySpindleModule } from './energy_spindle/energy_spindle.module';
import { PieChartModule } from './piechart/piechart.module';
import { MeterModule } from './meter/meter.module';
import { PowerComparisonModule } from './power_comparison/power_comparison.module';
import { HeatMapModule } from './heat_map/heat_map.module';
import { Unit4Lt2Module } from './unit4_lt2/unit4_lt2.module';
import { Unit5Lt3Module } from './unit5_lt3/unit5_lt3.module';
import { Unit5Lt4Module } from './unit5_lt4/unit5_lt4.module';
import { PowerSummaryReportModule } from './power_summary_report/power_summary_report.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AlarmsModule } from './alarms/alarms.module';
import { DailyConsumptionModule } from './daily_consumption/daily_consumption.module';
import { PlantsTrendsModule } from './plants_trends/plants_trends.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // MongooseModule.forRoot(process.env.surajcotton_URI!),
    // MongooseModule.forRoot(process.env.MONGODB_URI!),
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(process.env.surajcotton_URI!, {
      connectionName: 'surajcotton',
    }),
    UsersModule,
    AuthModule,
    AlarmsModule,
    RolesModule,
    PrivellegesModule,
    TrendsModule,
    ProductionModule,
    EnergyCostModule,
    LogsDataModule,
    NodeRedLinkModule,
    meter_dataModule,
    EnergyUsageReportModule,
    EnergyconsumptionreportModule,
    Unit4Lt1Module,
    sankeyModule,
    ProductionMonthwiseModule,
    ConsumptionEnergyModule,
    GenerationEnergyModule,
    EnergyModule,
    EnergySpindleModule,
    PieChartModule,
    MeterModule,
    PowerComparisonModule,
    HeatMapModule,
    Unit4Lt2Module,
    Unit5Lt3Module,
    Unit5Lt4Module,
    PowerSummaryReportModule,
    DailyConsumptionModule,
    PlantsTrendsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
