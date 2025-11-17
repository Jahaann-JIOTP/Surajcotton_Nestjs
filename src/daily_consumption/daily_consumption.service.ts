import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Historical } from './schemas/historical.schema';
import { ConsumptionDto } from './dto/consumption.dto';
import { calculateConsumptionCore } from './daily-consumption.util';
import { MeterService } from 'src/meter/meter.service';
import * as moment from 'moment-timezone';
import { info } from 'console';


@Injectable()
export class DailyConsumptionService {
  constructor(
    @InjectModel(Historical.name, 'surajcotton')
    private historicalModel: Model<Historical>,
    private readonly meterService: MeterService,
  ) {}
   // ✅ Utility function — automatically adds `info` if missing
  private withDefaultInfo(meters: any[]) {
    return meters.map((m) => ({
      ...m,
      info: m.info ?? '', // add empty string if info not provided
    }));
  }

  // 🔹 LT1 meters
  private lt1Meters = [

  { energy: 'U1_PLC_Del_ActiveEnergy',  power: 'U1_PLC_ActivePower_Total',  powerFactor: 'U1_PLC_PowerFactor_Avg',  voltage: 'U1_PLC_Voltage_Avg',  metername: 'Roving Transport System', deptname: 'R. Transport System', MCS: '1', installedLoad: '30' },

  { energy: 'U3_PLC_Del_ActiveEnergy',  power: 'U3_PLC_ActivePower_Total',  powerFactor: 'U3_PLC_PowerFactor_Avg',  voltage: 'U3_PLC_Voltage_Avg',  metername: 'Lighting Outside', deptname: 'Mills Lighting', MCS: '48', installedLoad: '10' },

  { energy: 'U4_PLC_Del_ActiveEnergy',  power: 'U4_PLC_ActivePower_Total',  powerFactor: 'U4_PLC_PowerFactor_Avg',  voltage: 'U4_PLC_Voltage_Avg',  metername: 'Lighting Inside', deptname: 'Mills Lighting', MCS: '1340', installedLoad: '50' },

  { energy: 'U5_PLC_Del_ActiveEnergy',  power: 'U5_PLC_ActivePower_Total',  powerFactor: 'U5_PLC_PowerFactor_Avg',  voltage: 'U5_PLC_Voltage_Avg',  metername: 'HFO Plant Aux(2nd Source)', deptname: 'HFO Plant Aux(2nd Source)', MCS: '0', installedLoad: '0' },

  { energy: 'U6_PLC_Del_ActiveEnergy',  power: 'U6_PLC_ActivePower_Total',  powerFactor: 'U6_PLC_PowerFactor_Avg',  voltage: 'U6_PLC_Voltage_Avg',  metername: 'Deep Valve Turbine', deptname: 'Deep Valve Turbine', MCS: '1', installedLoad: '22' },

  { energy: 'U8_PLC_Del_ActiveEnergy',  power: 'U8_PLC_ActivePower_Total',  powerFactor: 'U8_PLC_PowerFactor_Avg',  voltage: 'U8_PLC_Voltage_Avg',  metername: 'Drawing Finisher 1-6 + Breaker 1-4', deptname: 'Drawing Finisher + Breaker', MCS: '10', installedLoad: '94.2',info:'6*15kW + 2*18kW' },

  { energy: 'U9_PLC_Del_ActiveEnergy', power: 'U9_PLC_ActivePower_Total', powerFactor: 'U9_PLC_PowerFactor_Avg', voltage: 'U9_PLC_Voltage_Avg', metername: 'Winding 7-9', deptname: 'Winding', MCS: '3', installedLoad: '125.7' },

  { energy: 'U10_PLC_Del_ActiveEnergy', power: 'U10_PLC_ActivePower_Total', powerFactor: 'U10_PLC_PowerFactor_Avg', voltage: 'U10_PLC_Voltage_Avg', metername: 'Ring 1-4', deptname: 'Ring Dept', MCS: '4', installedLoad: '320' },

  { energy: 'U11_PLC_Del_ActiveEnergy', power: 'U11_PLC_ActivePower_Total', powerFactor: 'U11_PLC_PowerFactor_Avg', voltage: 'U11_PLC_Voltage_Avg', metername: 'Ring 17-20', deptname: 'Ring Dept', MCS: '4', installedLoad: '320' },

  { energy: 'U12_PLC_Del_ActiveEnergy', power: 'U12_PLC_ActivePower_Total', powerFactor: 'U12_PLC_PowerFactor_Avg', voltage: 'U12_PLC_Voltage_Avg', metername: 'Ring 21-24', deptname: 'Ring Dept', MCS: '4', installedLoad: '320' },

  { energy: 'U13_PLC_Del_ActiveEnergy', power: 'U13_PLC_ActivePower_Total', powerFactor: 'U13_PLC_PowerFactor_Avg', voltage: 'U13_PLC_Voltage_Avg', metername: 'Comber 1-10 + Lap Former 1-2', deptname: 'Comber + Lap Former', MCS: '12', installedLoad: '84' },

  { energy: 'U14_PLC_Del_ActiveEnergy', power: 'U14_PLC_ActivePower_Total', powerFactor: 'U14_PLC_PowerFactor_Avg', voltage: 'U14_PLC_Voltage_Avg', metername: 'Compressor (119 kW)', deptname: 'Air Compressor', MCS: '3', installedLoad: '119', info: '41kW + 41kW + 50kW' },

  { energy: 'U15_PLC_Del_ActiveEnergy', power: 'U15_PLC_ActivePower_Total', powerFactor: 'U15_PLC_PowerFactor_Avg', voltage: 'U15_PLC_Voltage_Avg', metername: 'Simplex 1-6', deptname: 'Simplex', MCS: '6', installedLoad: '108' },

  { energy: 'U17_PLC_Del_ActiveEnergy', power: 'U17_PLC_ActivePower_Total', powerFactor: 'U17_PLC_PowerFactor_Avg', voltage: 'U17_PLC_Voltage_Avg', metername: 'Ring A/C (Supply & Return Fans)', deptname: 'Ring A/C', MCS: '20', installedLoad: '333', info: 'Return Fans + Pumps + Dust collector Fans'},

  { energy: 'U18_PLC_Del_ActiveEnergy', power: 'U18_PLC_ActivePower_Total', powerFactor: 'U18_PLC_PowerFactor_Avg', voltage: 'U18_PLC_Voltage_Avg', metername: 'Ring A/C (Supply & Return Fans) Bypass', deptname: 'Ring A/C', MCS: '20', installedLoad: '333', info: 'Return Fans + Pumps + Dust collector Fans'},

  { energy: 'U20_PLC_Del_ActiveEnergy', power: 'U20_PLC_ActivePower_Total', powerFactor: 'U20_PLC_PowerFactor_Avg', voltage: 'U20_PLC_Voltage_Avg', metername: 'Compressor (119 kW) Bypass', deptname: 'Air Compressor', MCS: '3', installedLoad: '119', info: '41kW + 41kW + 50kW' },

  { energy: 'U22_GW02_Del_ActiveEnergy', power: 'U22_GW02_ActivePower_Total', powerFactor: 'U22_GW02_PowerFactor_Avg', voltage: 'U22_GW02_Voltage_Avg', metername: 'Ring Unit 4 (17-20)', deptname: 'Ring Dept', MCS: '4', installedLoad: '320' },

  // { energy: 'U25_PLC_Del_ActiveEnergy', power: 'U25_PLC_ActivePower_Total', powerFactor: 'U25_PLC_PowerFactor_Avg', voltage: 'U25_PLC_Voltage_Avg', metername: 'HFO AUX', deptname: 'HFO + JMS Auxiliary', MCS: '1', installedLoad: '250.0' }

];


  // 🔹 LT2 meters
 private lt2Meters = [
  { energy: 'U1_GW01_Del_ActiveEnergy', power: 'U1_GW01_ActivePower_Total', powerFactor: 'U1_GW01_PowerFactor_Avg', voltage: 'U1_GW01_Voltage_Avg', metername: 'Back Process A/C', deptname: 'Back Process A/C', MCS: '1', installedLoad: '142.2' },

  { energy: 'U2_GW01_Del_ActiveEnergy', power: 'U2_GW01_ActivePower_Total', powerFactor: 'U2_GW01_PowerFactor_Avg', voltage: 'U2_GW01_Voltage_Avg', metername: 'Conditioning Machine', deptname: 'Conditioning Machine', MCS: '1', installedLoad: '72' },

  { energy: 'U3_GW01_Del_ActiveEnergy', power: 'U3_GW01_ActivePower_Total', powerFactor: 'U3_GW01_PowerFactor_Avg', voltage: 'U3_GW01_Voltage_Avg', metername: 'Winding A/C', deptname: 'Winding A/C', MCS: '1', installedLoad: '98' },

  { energy: 'U4_GW01_Del_ActiveEnergy', power: 'U4_GW01_ActivePower_Total', powerFactor: 'U4_GW01_PowerFactor_Avg', voltage: 'U4_GW01_Voltage_Avg', metername: 'Mills Residential Colony & Workshop', deptname: 'Residential Colony', MCS: '1', installedLoad: '60' },

  { energy: 'U5_GW01_Del_ActiveEnergy', power: 'U5_GW01_ActivePower_Total', powerFactor: 'U5_GW01_PowerFactor_Avg', voltage: 'U5_GW01_Voltage_Avg', metername: 'Card 1-4 + 9-12', deptname: 'Card + Breaker', MCS: '8', installedLoad: '156.8', info:'7*19.37kW + 21.21kW' },

  { energy: 'U6_GW01_Del_ActiveEnergy', power: 'U6_GW01_ActivePower_Total', powerFactor: 'U6_GW01_PowerFactor_Avg', voltage: 'U6_GW01_Voltage_Avg', metername: 'Spare', deptname: 'Spare/PF Panels', MCS: '0', installedLoad: '0' },

  { energy: 'U8_GW01_Del_ActiveEnergy', power: 'U8_GW01_ActivePower_Total', powerFactor: 'U8_GW01_PowerFactor_Avg', voltage: 'U8_GW01_Voltage_Avg', metername: 'Blow Room', deptname: 'Blow Room', MCS: '2', installedLoad: '151' },

  { energy: 'U9_GW01_Del_ActiveEnergy', power: 'U9_GW01_ActivePower_Total', powerFactor: 'U9_GW01_PowerFactor_Avg', voltage: 'U9_GW01_Voltage_Avg', metername: 'Card 5-8 + 13-14 + Breaker 5-6', deptname: 'Card + Breaker', MCS: '8', installedLoad: '135.6', info:'7*19.37kW' },

  { energy: 'U10_GW01_Del_ActiveEnergy', power: 'U10_GW01_ActivePower_Total', powerFactor: 'U10_GW01_PowerFactor_Avg', voltage: 'U10_GW01_Voltage_Avg', metername: 'Winding 1-6', deptname: 'Winding', MCS: '6', installedLoad: '251.4' },

  { energy: 'U11_GW01_Del_ActiveEnergy', power: 'U11_GW01_ActivePower_Total', powerFactor: 'U11_GW01_PowerFactor_Avg', voltage: 'U11_GW01_Voltage_Avg', metername: 'Gas Plant Aux (2nd Source)', deptname: 'Gas Plant Aux (2nd Source)', MCS: '0', installedLoad: '0' },

  { energy: 'U12_GW01_Del_ActiveEnergy', power: 'U12_GW01_ActivePower_Total', powerFactor: 'U12_GW01_PowerFactor_Avg', voltage: 'U12_GW01_Voltage_Avg', metername: 'B/Card + Comber Filter', deptname: 'B/Card + Comber Filter', MCS: '3', installedLoad: '203.2' },

  { energy: 'U14_GW01_Del_ActiveEnergy', power: 'U14_GW01_ActivePower_Total', powerFactor: 'U14_GW01_PowerFactor_Avg', voltage: 'U14_GW01_Voltage_Avg', metername: 'B/Card + Comber Filter Bypass', deptname: 'B/Card + Comber Filter', MCS: '2', installedLoad: '203.2' },

  { energy: 'U15_GW01_Del_ActiveEnergy', power: 'U15_GW01_ActivePower_Total', powerFactor: 'U15_GW01_PowerFactor_Avg', voltage: 'U15_GW01_Voltage_Avg', metername: 'Ring 5-8', deptname: 'Ring Dept', MCS: '4', installedLoad: '320' },

  { energy: 'U16_GW01_Del_ActiveEnergy', power: 'U16_GW01_ActivePower_Total', powerFactor: 'U16_GW01_PowerFactor_Avg', voltage: 'U16_GW01_Voltage_Avg', metername: 'Ring 13-16', deptname: 'Ring Dept', MCS: '4', installedLoad: '320' },

  { energy: 'U17_GW01_Del_ActiveEnergy', power: 'U17_GW01_ActivePower_Total', powerFactor: 'U17_GW01_PowerFactor_Avg', voltage: 'U17_GW01_Voltage_Avg', metername: 'Ring 9-12', deptname: 'Ring Dept', MCS: '4', installedLoad: '320' },

  { energy: 'U18_GW01_Del_ActiveEnergy', power: 'U18_GW01_ActivePower_Total', powerFactor: 'U18_GW01_PowerFactor_Avg', voltage: 'U18_GW01_Voltage_Avg', metername: 'Colony', deptname: 'Residential Colony', MCS: '1', installedLoad: '60' },

  { energy: 'U19_GW01_Del_ActiveEnergy', power: 'U19_GW01_ActivePower_Total', powerFactor: 'U19_GW01_PowerFactor_Avg', voltage: 'U19_GW01_Voltage_Avg', metername: 'Lab A/C', deptname: 'Lap + Offices', MCS: '2', installedLoad: '8' },

  { energy: 'U20_GW01_Del_ActiveEnergy', power: 'U20_GW01_ActivePower_Total', powerFactor: 'U20_GW01_PowerFactor_Avg', voltage: 'U20_GW01_Voltage_Avg', metername: 'Bailing Press', deptname: 'Bailing Press', MCS: '1', installedLoad: '15' },

  { energy: 'U21_GW01_Del_ActiveEnergy', power: 'U21_GW01_ActivePower_Total', powerFactor: 'U21_GW01_PowerFactor_Avg', voltage: 'U21_GW01_Voltage_Avg', metername: 'Spare 2', deptname: 'Spare/PF Panels', MCS: '0', installedLoad: '0' }
];



    private unit5Lt1Meters = [
  { energy: 'U2_PLC_Del_ActiveEnergy',  power: 'U2_PLC_ActivePower_Total',  powerFactor: 'U2_PLC_PowerFactor_Avg',  voltage: 'U2_PLC_Voltage_Avg',  metername: 'Lighting Internal Unit 5', deptname: 'Mills Lighting', MCS: '1490', installedLoad: '30' },

  { energy: 'U7_GW02_Del_ActiveEnergy', power: 'U7_GW02_ActivePower_Total', powerFactor: 'U7_GW02_PowerFactor_Avg', voltage: 'U7_GW02_Voltage_Avg', metername: 'Ring 1-3', deptname: 'Ring Dept', MCS: '3', installedLoad: '425.7' },

  { energy: 'U8_GW02_Del_ActiveEnergy', power: 'U8_GW02_ActivePower_Total', powerFactor: 'U8_GW02_PowerFactor_Avg', voltage: 'U8_GW02_Voltage_Avg', metername: 'Ring A/C (Supply Fans)', deptname: 'Ring A/C', MCS: '19', installedLoad: '238', info: 'Pumps+Pnenmafil Fan+Rotary Air Filter' },

  { energy: 'U9_GW02_Del_ActiveEnergy', power: 'U9_GW02_ActivePower_Total', powerFactor: 'U9_GW02_PowerFactor_Avg', voltage: 'U9_GW02_Voltage_Avg', metername: 'Blow Room', deptname: 'Blow Room', MCS: '2', installedLoad: '144.5' },

  { energy: 'U10_GW02_Del_ActiveEnergy', power: 'U10_GW02_ActivePower_Total', powerFactor: 'U10_GW02_PowerFactor_Avg', voltage: 'U10_GW02_Voltage_Avg', metername: 'Ring 4-6', deptname: 'Ring Dept', MCS: '3', installedLoad: '425.7' },

  { energy: 'U11_GW02_Del_ActiveEnergy', power: 'U11_GW02_ActivePower_Total', powerFactor: 'U11_GW02_PowerFactor_Avg', voltage: 'U11_GW02_Voltage_Avg', metername: 'A/C Back Process', deptname: 'Back Process A/C', MCS: '1', installedLoad: '239.1' },
  { energy: 'U12_GW02_Del_ActiveEnergy', power: 'U12_GW02_ActivePower_Total', powerFactor: 'U12_GW02_PowerFactor_Avg', voltage: 'U12_GW02_Voltage_Avg', metername: 'Lighting Internal', deptname: 'Mills Lighting', MCS: '1479', installedLoad: '30' },

  { energy: 'U14_GW02_Del_ActiveEnergy', power: 'U14_GW02_ActivePower_Total', powerFactor: 'U14_GW02_PowerFactor_Avg', voltage: 'U14_GW02_Voltage_Avg', metername: 'Comber 1-14 + Lap Former 1-3', deptname: 'Comber + Lap Former', MCS: '17', installedLoad: '318.2', info:'14*11kW + 03*14.3kW'},

  { energy: 'U15_GW02_Del_ActiveEnergy', power: 'U15_GW02_ActivePower_Total', powerFactor: 'U15_GW02_PowerFactor_Avg', voltage: 'U15_GW02_Voltage_Avg', metername: 'Ring A/C (Return Fans)', deptname: 'Ring A/C', MCS: '18', installedLoad: '238', info: 'Pumps+Pnenmafil Fan+Rotary Air Filter' },

  { energy: 'U16_GW02_Del_ActiveEnergy', power: 'U16_GW02_ActivePower_Total', powerFactor: 'U16_GW02_PowerFactor_Avg', voltage: 'U16_GW02_Voltage_Avg', metername: 'Water Chiller', deptname: 'Water Chiller', MCS: '0', installedLoad: '0' },

  { energy: 'U16_PLC_Del_ActiveEnergy', power: 'U16_PLC_ActivePower_Total', powerFactor: 'U16_PLC_PowerFactor_Avg', voltage: 'U16_PLC_Voltage_Avg', metername: 'Compressor 303 kW', deptname: 'Air Compressor', MCS: '3', installedLoad: '303', info: 'Compressors 101+101+101' },

  { energy: 'U17_GW02_Del_ActiveEnergy', power: 'U17_GW02_ActivePower_Total', powerFactor: 'U17_GW02_PowerFactor_Avg', voltage: 'U17_GW02_Voltage_Avg', metername: 'Card 8-14', deptname: 'Card', MCS: '7', installedLoad: '153.3', info:'07*21.9kW + 01*7kW' },

  { energy: 'U18_GW02_Del_ActiveEnergy', power: 'U18_GW02_ActivePower_Total', powerFactor: 'U18_GW02_PowerFactor_Avg', voltage: 'U18_GW02_Voltage_Avg', metername: 'Winding 1-9', deptname: 'Winding', MCS: '9', installedLoad: '235.53' },

  { energy: 'U19_GW02_Del_ActiveEnergy', power: 'U19_GW02_ActivePower_Total', powerFactor: 'U19_GW02_PowerFactor_Avg', voltage: 'U19_GW02_Voltage_Avg', metername: 'Card 1-7', deptname: 'Card', MCS: '7', installedLoad: '153.3' , info:'07*21.9kW' },

  { energy: 'U20_GW02_Del_ActiveEnergy', power: 'U20_GW02_ActivePower_Total', powerFactor: 'U20_GW02_PowerFactor_Avg', voltage: 'U20_GW02_Voltage_Avg', metername: 'Winding A/C', deptname: 'Winding A/C', MCS: '1', installedLoad: '100.49', info:'100.5kW + 7.5kW' },

  { energy: 'U21_GW02_Del_ActiveEnergy', power: 'U21_GW02_ActivePower_Total', powerFactor: 'U21_GW02_PowerFactor_Avg', voltage: 'U21_GW02_Voltage_Avg', metername: 'Simplex + Drawing Breaker', deptname: 'Simplex + Drawing Breaker', MCS: '11', installedLoad: '209.3', info:'5*33.2kW + 3*14.4kW' },

  { energy: 'U23_GW02_Del_ActiveEnergy', power: 'U23_GW02_ActivePower_Total', powerFactor: 'U23_GW02_PowerFactor_Avg', voltage: 'U23_GW02_Voltage_Avg', metername: 'Drawing Finisher 1-8', deptname: 'Drawing Finisher', MCS: '8', installedLoad: '77.6', info:'8*14.9kW' }
];

      private unit5Lt2Meters = [
    { energy: 'U1_GW03_Del_ActiveEnergy', power: 'U1_GW03_ActivePower_Total', powerFactor: 'U1_GW03_PowerFactor_Avg', voltage: 'U1_GW03_Voltage_Avg', metername: 'Ring 7-9', deptname: 'Ring Dept', MCS: '3', installedLoad: '425.7' },
    { energy: 'U2_GW03_Del_ActiveEnergy', power: 'U2_GW03_ActivePower_Total', powerFactor: 'U2_GW03_PowerFactor_Avg', voltage: 'U2_GW03_Voltage_Avg', metername: 'conditioning Machine', deptname: 'Conditioning Machine', MCS: '1', installedLoad: '72' },
    { energy: 'U3_GW03_Del_ActiveEnergy', power: 'U3_GW03_ActivePower_Total', powerFactor: 'U3_GW03_PowerFactor_Avg', voltage: 'U3_GW03_Voltage_Avg', metername: 'Colony', deptname: 'Residential Colony', MCS: '1', installedLoad: '0' },
    { energy: 'U4_GW03_Del_ActiveEnergy', power: 'U4_GW03_ActivePower_Total', powerFactor: 'U4_GW03_PowerFactor_Avg', voltage: 'U4_GW03_Voltage_Avg', metername: 'Roving Transport System', deptname: 'R. Transport System', MCS: '1', installedLoad: '30' },
    { energy: 'U5_GW03_Del_ActiveEnergy', power: 'U5_GW03_ActivePower_Total', powerFactor: 'U5_GW03_PowerFactor_Avg', voltage: 'U5_GW03_Voltage_Avg', metername: 'Ring 10-12', deptname: 'Ring Dept', MCS: '3', installedLoad: '425' },
    { energy: 'U6_GW03_Del_ActiveEnergy', power: 'U6_GW03_ActivePower_Total', powerFactor: 'U6_GW03_PowerFactor_Avg', voltage: 'U6_GW03_Voltage_Avg', metername: 'Spare 2', deptname: 'Comber + Lap Former', MCS: '17', installedLoad: '318.2' },
     { energy: 'U7_GW03_Del_ActiveEnergy', power: 'U7_GW03_ActivePower_Total', powerFactor: 'U7_GW03_PowerFactor_Avg', voltage: 'U7_GW03_Voltage_Avg', metername: 'Spare 1', deptname: 'Spare/PF panels', MCS: '0', installedLoad: '0' },
    // { energy: 'U8_GW03_Del_ActiveEnergy', power: 'U8_GW03_ActivePower_Total', powerFactor: 'U8_GW03_PowerFactor_Avg', voltage: 'U8_GW03_Voltage_Avg', metername: 'Spare 2', deptname: 'Spare/PF panels', MCS: '0', installedLoad: '0' },
    { energy: 'U9_GW03_Del_ActiveEnergy', power: 'U9_GW03_ActivePower_Total', powerFactor: 'U9_GW03_PowerFactor_Avg', voltage: 'U9_GW03_Voltage_Avg', metername: 'Ring 13-15', deptname: 'Ring Dept', MCS: '3', installedLoad: '425' },
    { energy: 'U10_GW03_Del_ActiveEnergy', power: 'U10_GW03_ActivePower_Total', powerFactor: 'U10_GW03_PowerFactor_Avg', voltage: 'U10_GW03_Voltage_Avg', metername: 'Winding 10-18', deptname: 'Winding', MCS: '9', installedLoad: '253.53' },
    { energy: 'U11_GW03_Del_ActiveEnergy', power: 'U11_GW03_ActivePower_Total', powerFactor: 'U11_GW03_PowerFactor_Avg', voltage: 'U11_GW03_Voltage_Avg', metername: 'Bailing Press', deptname: 'Bailing Press', MCS: '1', installedLoad: '15', info:'15 + 09' },
    { energy: 'U12_GW03_Del_ActiveEnergy', power: 'U12_GW03_ActivePower_Total', powerFactor: 'U12_GW03_PowerFactor_Avg', voltage: 'U12_GW03_Voltage_Avg', metername: 'Ring 16-18', deptname: 'Ring Dept', MCS: '3', installedLoad: '425' },
    { energy: 'U13_GW03_Del_ActiveEnergy', power: 'U13_GW03_ActivePower_Total', powerFactor: 'U13_GW03_PowerFactor_Avg', voltage: 'U13_GW03_Voltage_Avg', metername: 'B/Card Comber Filter', deptname: 'B/Card + Comber Filter', MCS: '3', installedLoad: '274' },
    { energy: 'U14_GW03_Del_ActiveEnergy', power: 'U14_GW03_ActivePower_Total', powerFactor: 'U14_GW03_PowerFactor_Avg', voltage: 'U14_GW03_Voltage_Avg', metername: 'Lighting Internal', deptname: 'Mills Lighting', MCS: '1479', installedLoad: '30' },
    { energy: 'U15_GW03_Del_ActiveEnergy', power: 'U15_GW03_ActivePower_Total', powerFactor: 'U15_GW03_PowerFactor_Avg', voltage: 'U15_GW03_Voltage_Avg', metername: 'Deep Valve Turbine', deptname: 'Deep Valve Turbine', MCS: '1', installedLoad: '22' },
    { energy: 'U18_GW03_Del_ActiveEnergy', power: 'U18_GW03_ActivePower_Total', powerFactor: 'U18_GW03_PowerFactor_Avg', voltage: 'U18_GW03_Voltage_Avg', metername: 'PF Panel', deptname: 'Spare/PF Panels', MCS: '0', installedLoad: '0'},
  ];

  // ✅ merged function
 // ✅ Main function
  // ✅ Main function
async calculateConsumption(
  dto: ConsumptionDto,
  line: 'LT1' | 'LT2' | 'Unit5-LT1' | 'Unit5-LT2',
) {
  let metersConfig;

  switch (line) {
    case 'LT1':
      metersConfig = this.withDefaultInfo(this.lt1Meters);
      break;
    case 'LT2':
      metersConfig = this.withDefaultInfo(this.lt2Meters);
      break;
    case 'Unit5-LT1':
      metersConfig = this.withDefaultInfo(this.unit5Lt1Meters);
      break;
    case 'Unit5-LT2':
      metersConfig = this.withDefaultInfo(this.unit5Lt2Meters);
      break;
    default:
      throw new Error(`❌ No metersConfig found for line=${line}`);
  }

  const fmCons = await this.meterService.getMeterWiseConsumption(
    dto.startDate,
    dto.endDate,
    { startTime: dto.startTime, endTime: dto.endTime },
  );

  // --- same energy adjustments as before ---
  const PDB07_U4 = +(Number(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const deepValve = +(Number(fmCons?.U15_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const Bailing = +(Number(fmCons?.U11_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB1CD1_U5 = +(Number(fmCons?.U5_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB1CD1_U4 = +(Number(fmCons?.U4_U1_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB1CD1_Total = Math.max(0, +(PDB1CD1_U4 + PDB1CD1_U5).toFixed(2));
  const PDB2CD2_U4 = +(Number(fmCons?.U4_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB2CD2_U5 = +(Number(fmCons?.U5_U2_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB2CD2_Total = Math.max(0, +(PDB2CD2_U4 + PDB2CD2_U5).toFixed(2));
  const PDB10_U4 = +(Number(fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB08_U4 = +(Number(fmCons?.U4_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB08_U5 = +(Number(fmCons?.U5_U4_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB08_Total = Math.max(0, +(PDB08_U4 + PDB08_U5).toFixed(2));
  const CardPDB1_U5 = +(Number(fmCons?.U5_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const CardPDB1_U4 = +(Number(fmCons?.U4_U3_GW02_Del_ActiveEnergy ?? 0).toFixed(2));
  const CardPDB1_sum = Math.max(0, +(CardPDB1_U5 + CardPDB1_U4).toFixed(2));
  const PDB07_U5 = +(Number(fmCons?.U5_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB07_sum = Math.max(0, +(PDB07_U5 + PDB07_U4).toFixed(2));
  const PDB10_U5 = +(Number(fmCons?.U5_U23_GW03_Del_ActiveEnergy ?? 0).toFixed(2));
  const PDB10_sum = Math.max(0, +(PDB10_U4 + PDB10_U5).toFixed(2));

  const result = await calculateConsumptionCore(dto, metersConfig, this.historicalModel);

  const adjustedMeters = metersConfig.map((m) => {
    const foundMeter = result?.meters?.find((x: any) => x.metername === m.metername);
    const energyField = `${m.energy.replace('_Del_ActiveEnergy', '')}_energy_consumption`;
    let adjustedEnergy = foundMeter?.[energyField] ?? 0;

    switch (m.energy) {
      case 'U12_PLC_Del_ActiveEnergy':
        adjustedEnergy = Math.max(0, adjustedEnergy - PDB07_U4);
        break;
      case 'U5_GW01_Del_ActiveEnergy':
        adjustedEnergy = PDB1CD1_Total;
        break;
      case 'U9_GW01_Del_ActiveEnergy':
        adjustedEnergy = PDB2CD2_Total;
        break;
      case 'U15_GW01_Del_ActiveEnergy':
        adjustedEnergy = Math.max(0, adjustedEnergy - PDB10_U4);
        break;
      case 'U14_GW02_Del_ActiveEnergy':
        adjustedEnergy = PDB08_Total;
        break;
      case 'U17_GW02_Del_ActiveEnergy':
        adjustedEnergy = CardPDB1_sum;
        break;
      case 'U18_GW02_Del_ActiveEnergy':
        adjustedEnergy = PDB07_sum;
        break;
      case 'U10_GW03_Del_ActiveEnergy':
        adjustedEnergy = PDB10_sum;
        break;
    }

    
const { totalHours } = result;
// console.log("totalHours:", totalHours);
    const avgPower = totalHours > 0 ? adjustedEnergy / totalHours : 0;

    return {
      ...foundMeter,
      [energyField]: +adjustedEnergy.toFixed(2),
      avgPower: +avgPower.toFixed(2), // new field
      info: m.info ?? '',
    };
  });

  if (result?.meters && Array.isArray(result.meters)) {
    result.meters = result.meters.map((meter: any) => {
      const matched = adjustedMeters.find((cfg) => cfg.metername === meter.metername);
      return {
        ...meter,
        ...matched,
        info: matched?.info ?? '',
      };
    });
  }

  return result;
}





}
