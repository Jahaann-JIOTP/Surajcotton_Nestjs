
import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NodeRedStatus1, NodeRedStatusDocument1 } from './schemas/node-red-status.schema';
import { firstValueFrom } from 'rxjs';
import * as moment from 'moment-timezone';

@Injectable()
export class NodeRedLinkService {
  private previousStatus: 'up' | 'down' | 'cache' = 'up';
  private isFirstCheckDone = false;

  constructor(
    private readonly httpService: HttpService,
    @InjectModel(NodeRedStatus1.name, 'surajcotton') private readonly statusModel: Model<NodeRedStatusDocument1>,
  ) {}
  async fetchNodeRedData(): Promise<any> {
    try {
      const response = await this.httpService.axiosRef.get('http://43.204.118.114:6881/surajcotton');
      return response.data;
    } catch (error) {
      throw new HttpException('Unable to fetch data from Node-RED', 500);
    }
  }

async checkNodeRedLink(): Promise<string> {
  let currentStatus: 'up' | 'down' | 'cache' = 'up';
  let message = 'Link is up';

  try {
    const { data } = await firstValueFrom(
      this.httpService.get('http://43.204.118.114:6881/surajcotton')
    );

    if (data?.error) {
        currentStatus =
          data.error.includes('Invalid Data Structure') ||
          data.error.includes('Missing Time field')
            ? 'down'
            : 'down';
        message =
          data.error.includes('Invalid Data Structure') ||
          data.error.includes('Missing Time field')
            ? 'Link is down'
            : data.error;
      } else if (data?.warning) {
        currentStatus = 'cache';
        message = data.warning.includes('Cache Data Receiving')
          ? data.warning
          : 'Cache data in use';
      } else {
        currentStatus = 'up';
        message = 'Link is up';
      }
    } catch (error) {
      currentStatus = 'down';
      message = 'Link is down (no response)';
    }

  const now = moment().tz('Asia/Karachi').toDate();

  if (!this.isFirstCheckDone || currentStatus !== this.previousStatus) {
    if (currentStatus === 'down') {
      // Create a new document for link down
      await this.statusModel.create({
        status: 'down',
        message: 'Node-RED link is down',
        startTime: now,
      });
    } else if (currentStatus === 'up') {
      // Create a new document for link up
      await this.statusModel.create({
        status: 'up',
        message: 'Node-RED link is reachable',
        endTime: now,
      });
    }
    else if (currentStatus === 'cache') {
      // Create a new document for link up
      await this.statusModel.create({
        status: 'cache',
        message: 'Cache data in use',
        endTime: now,
      });
    }


    this.previousStatus = currentStatus;
    this.isFirstCheckDone = true;
  }
  return message;
}


}
