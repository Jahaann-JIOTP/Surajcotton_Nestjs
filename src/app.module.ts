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
  ],
  controllers: [AppController],
  providers: [AppService],
  
})
export class AppModule {}
