import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection('surajcotton') private readonly connection: Connection,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health/db')
  async checkDatabaseHealth() {
    try {
      const db = this.connection.db;
      
      if (!db) {
        return {
          status: 'error',
          message: 'Database connection not initialized',
          timestamp: new Date().toISOString(),
        };
      }

      const admin = db.admin();
      
      // Get connection pool stats
      const serverStatus = await admin.serverStatus();
      const connections = serverStatus.connections;

      return {
        status: this.connection.readyState === 1 ? 'connected' : 'disconnected',
        database: db.databaseName,
        connections: {
          current: connections.current,
          available: connections.available,
          totalCreated: connections.totalCreated,
        },
        poolSize: {
          max: 20, // from config
          min: 5,  // from config
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
