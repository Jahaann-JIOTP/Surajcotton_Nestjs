import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';

import { AuthModule } from './auth/auth.module';
import { RolesModule } from './roles/roles.module';
import { PrivellegesModule } from './privelleges/privelleges.module';
import { TrendsController } from './trends/trends.controller';
import { TrendsService } from './trends/trends.service';

import { TrendsModule } from './trends/trends.module';
import { ProductionService } from './production/production.service';
import { ProductionController } from './production/production.controller';
import { ProductionModule } from './production/production.module';
import { EnergyCostService } from './energy_cost/energy_cost.service';
import { EnergyCostController } from './energy_cost/energy_cost.controller';
import { EnergyCostModule } from './energy_cost/energy_cost.module';
import { LogsDataModule } from './logs_data/logs_data.module';
import { NodeRedLinkService } from './node_red_link/node_red_link.service';
import { NodeRedLinkController } from './node_red_link/node_red_link.controller';
import { NodeRedLinkModule } from './node_red_link/node_red_link.module';
import { meter_dataService } from './meter_data/meter_data.service';
import { meter_dataController } from './meter_data/meter_data.controller';
import { meter_dataModule } from './meter_data/meter_data.module';
import { EnergyUsageReportService } from './energy_usage_report/energy_usage_report.service';
import { EnergyUsageReportController } from './energy_usage_report/energy_usage_report.controller';
import { EnergyUsageReportModule } from './energy_usage_report/energy_usage_report.module';

import { Unit4Lt1Module } from './unit4_lt1/unit4_lt1.module';

import { ProductionMonthwiseModule } from './production-monthwise/production-monthwise.module';
import { ConsumptionEnergyService } from './consumption_energy/consumption_energy.service';
import { ConsumptionEnergyModule } from './consumption_energy/consumption_energy.module';
// import { GenerationEnergyService } from './generation_energy/generation_energy.service';
// import { GenerationEnergyController } from './generation_energy/generation_energy.controller';
import { GenerationEnergyModule } from './generation_energy/generation_energy.module';
import { EnergyService } from './energy/energy.service';
import { EnergyController } from './energy/energy.controller';
import { EnergyModule } from './energy/energy.module';
// import { EnergySpindleService } from './energy_spindle/energy_spindle.service';
// import { EnergySpindleController } from './energy_spindle/energy_spindle.controller';
import { EnergySpindleModule } from './energy_spindle/energy_spindle.module';

import { PieChartModule } from './piechart/piechart.module';
// import { MeterService } from './meter/meter.service';
// import { MeterController } from './meter/meter.controller';
import { MeterModule } from './meter/meter.module';
// import { PowerComparisonController } from './power_comparison/power_comparison.controller';
import { PowerComparisonModule } from './power_comparison/power_comparison.module';
// import { HeatMapService } from './heat_map/heat_map.service';
// import { HeatMapController } from './heat_map/heat_map.controller';
import { HeatMapModule } from './heat_map/heat_map.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // MongooseModule.forRoot(process.env.surajcotton_URI!),
    // MongooseModule.forRoot(process.env.MONGODB_URI!),
    MongooseModule.forRoot(process.env.surajcotton_URI!, {
      connectionName: 'surajcotton',
    }),
    UsersModule,
    AuthModule,
    RolesModule,
    PrivellegesModule,
    TrendsModule,
    ProductionModule,
    EnergyCostModule,
    LogsDataModule,
    NodeRedLinkModule,
    meter_dataModule,
    EnergyUsageReportModule,
    Unit4Lt1Module,
    ProductionMonthwiseModule,
    ConsumptionEnergyModule,
    GenerationEnergyModule,
    EnergyModule,
    EnergySpindleModule,
   PieChartModule,
    MeterModule,
    PowerComparisonModule,
    HeatMapModule,
 
  ],
  controllers: [AppController],
  providers: [AppService ],
  
})
export class AppModule {}
