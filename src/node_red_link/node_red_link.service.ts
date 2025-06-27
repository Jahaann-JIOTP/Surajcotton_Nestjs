
import { Injectable, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class NodeRedLinkService {
  constructor(private readonly httpService: HttpService) {}

  async fetchNodeRedData(): Promise<any> {
    try {
      const response = await this.httpService.axiosRef.get('http://13.234.241.103:1880/surajcotton');
      return response.data;
    } catch (error) {
      throw new HttpException('Unable to fetch data from Node-RED', 500);
    }
  }
}
