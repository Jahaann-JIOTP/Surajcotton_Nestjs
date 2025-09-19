// src/meter_data/meter_data.service.ts
import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class meter_dataService {
  constructor(private readonly httpService: HttpService) {}

  private readonly url = 'http://13.234.241.103:1880/surajcotton';

 private getMeterPrefixes(groupKey: string): string[] {
  
     const mapping: Record<string, string[]> = {
  hfo: [
    'U21_PLC','U22_PLC', 'U23_PLC', 'U24_PLC', 'U25_PLC', 'U26_PLC', 'U27_PLC'
  ],

  ht:['U20_GW03','U19_GW03', 'U22_GW01', 'U23_GW01'],

  'unit4_lt1': [
    'U1_PLC', 'U2_PLC', 'U3_PLC', 'U03_PLC', 'U4_PLC', 'U5_PLC', 'U6_PLC', 'U7_PLC', 'U8_PLC',
        'U9_PLC', 'U10_PLC', 'U11_PLC', 'U12_PLC', 'U13_PLC', 'U14_PLC', 'U15_PLC', 'U16_PLC',
        'U17_PLC', 'U18_PLC', 'U19_PLC', 'U20_PLC'
  ],

  'unit4_lt2': [
   'U1_GW01', 'U2_GW01', 'U3_GW01', 'U4_GW01', 'U5_GW01', 'U6_GW01', 'U7_GW01',
        'U8_GW01', 'U9_GW01', 'U10_GW01', 'U11_GW01', 'U12_GW01', 'U13_GW01', 'U14_GW01',
        'U15_GW01', 'U16_GW01', 'U17_GW01', 'U18_GW01', 'U19_GW01', 'U20_GW01', 'U21_GW01'
        
  ],

  'unit5_lt1': [
    'U1_GW02', 'U2_GW02', 'U3_GW02', 'U4_GW02', 'U5_GW02', 'U6_GW02', 'U7_GW02',
        'U8_GW02', 'U9_GW02', 'U10_GW02', 'U11_GW02', 'U12_GW02', 'U13_GW02', 'U14_GW02',
        'U15_GW02', 'U16_GW02', 'U17_GW02', 'U18_GW02', 'U19_GW02', 'U20_GW02', 'U21_GW02',
        'U22_GW02', 'U23_GW02'
  ],

  'unit5_lt2': [
  'U1_GW03', 'U2_GW03', 'U3_GW03', 'U4_GW03', 'U5_GW03', 'U6_GW03', 'U7_GW03',
        'U8_GW03', 'U9_GW03', 'U10_GW03', 'U11_GW03', 'U12_GW03', 'U13_GW03', 'U14_GW03',
        'U15_GW03', 'U16_GW03', 'U17_GW03', 'U18_GW03', 'U21_GW03',
        'U22_GW03', 'U23_GW03'],

      
    };

    return mapping[groupKey] || [];
  }

async getFilteredData(groupKey: string, meterId: string): Promise<any> {
  const response = await firstValueFrom(this.httpService.get(this.url));
  const data = response.data;

  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid response from API: ${JSON.stringify(data)}`);
  }

  const allowedMeterIds = this.getMeterPrefixes(groupKey);
  if (!allowedMeterIds.includes(meterId)) {
    throw new Error(`Invalid meterId "${meterId}" for group "${groupKey}"`);
  }

  const filtered: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith(meterId)) {
      filtered[key] = value;
    }
  }

  return filtered;
}




}
