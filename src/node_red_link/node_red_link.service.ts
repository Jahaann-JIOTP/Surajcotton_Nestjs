// src/node_red_link/node_red_link.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NodeRedStatus } from './schemas/node-red-status.schema';

@Injectable()
export class NodeRedLinkService {
  private previousStatus: 'up' | 'down' = 'up';

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(NodeRedStatus.name, 'surajcotton')
    private readonly statusModel: Model<NodeRedStatus>,
  ) {}

  // 🟢 API to fetch manual status
 

async fetchNodeRedData(): Promise<any> {
  const now = new Date();

  try {
    const response = await this.httpService.axiosRef.get('http://13.234.241.103:1880/surajcotton', {
      timeout: 5000,
      validateStatus: () => true,
    });

    const result = {
      status: 'up',
      startTime: now,
      message: 'Node-RED link is reachable',
    };

    // ✅ Save to DB
    await this.statusModel.create(result);

    return {
      ...result,
      data: response.data,
    };
  } catch (error) {
    const result = {
      status: 'down',
      startTime: now,
      message: 'Node-RED link is unreachable (connection error)',
    };

    // ✅ Save to DB
    await this.statusModel.create(result);

    return result;
  }
}


  // 🔁 Runs every minute
  @Cron('*/1 * * * *')
  async checkNodeRedLink() {
    const now = new Date();

    try {
      const response = await this.httpService.axiosRef.get('http://13.234.241.103:1880/surajcotton', {
        timeout: 5000,
        validateStatus: () => true,
      });

      if (response.status >= 200 && response.status < 300) {
        // Link is UP
        if (this.previousStatus === 'down') {
          await this.statusModel.findOneAndUpdate(
            { status: 'down', endTime: null },
            {
              endTime: now,
              status: 'up',
            }
          );
          console.log('✅ Link is back up at', now);
        }

        this.previousStatus = 'up';
      } else {
        // Link is DOWN (non-2xx)
        if (this.previousStatus === 'up') {
          await this.statusModel.create({
            status: 'down',
            startTime: now,
            endTime: null,
          });
          console.log('❌ Link is down at', now);
        }

        this.previousStatus = 'down';
      }
    } catch (err) {
      // Total connection failure
      if (this.previousStatus === 'up') {
        await this.statusModel.create({
          status: 'down',
          startTime: now,
          endTime: null,
        });
        console.log('❌ Link is down (connection error) at', now);
        this.previousStatus = 'down';
      }
    }
  }
}
