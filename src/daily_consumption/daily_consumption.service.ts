import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Historical } from './schemas/historical.schema';
import { ConsumptionDto } from './dto/consumption.dto';
import { calculateConsumptionCore } from './daily-consumption.util';

@Injectable()
export class DailyConsumptionService {
  constructor(
    @InjectModel(Historical.name, 'surajcotton')
    private historicalModel: Model<Historical>,
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
    { energy: 'U10_PLC_Del_ActiveEnergy', power: 'U10_PLC_ActivePower_Total', powerFactor: 'U10_PLC_PowerFactor_Avg', voltage: 'U10_PLC_Voltage_Avg', metername: 'Ring 1-4', deptname: 'Ring Dept', MCS: '4', installedLoad: '80' },
    { energy: 'U11_PLC_Del_ActiveEnergy', power: 'U11_PLC_ActivePower_Total', powerFactor: 'U11_PLC_PowerFactor_Avg', voltage: 'U11_PLC_Voltage_Avg', metername: 'Ring 16-20', deptname: 'Ring Dept', MCS: '4', installedLoad: '80' },
    { energy: 'U12_PLC_Del_ActiveEnergy', power: 'U12_PLC_ActivePower_Total', powerFactor: 'U12_PLC_PowerFactor_Avg', voltage: 'U12_PLC_Voltage_Avg', metername: 'Ring 21-24', deptname: 'Ring Dept', MCS: '4', installedLoad: '80' },
    { energy: 'U17_PLC_Del_ActiveEnergy', power: 'U17_PLC_ActivePower_Total', powerFactor: 'U17_PLC_PowerFactor_Avg', voltage: 'U17_PLC_Voltage_Avg', metername: 'Ring AC', deptname: 'AC_Ring', MCS: '02', installedLoad: '347.5', info: 'Supply Fans+Return fans+Water Pumps+Dust collector fans' },
    { energy: 'U18_PLC_Del_ActiveEnergy', power: 'U18_PLC_ActivePower_Total', powerFactor: 'U18_PLC_PowerFactor_Avg', voltage: 'U18_PLC_Voltage_Avg', metername: 'Ring AC (Bypass)', deptname: 'AC_Ring', MCS: '02', installedLoad: '347.5' , info: 'Supply Fans+Return fans+Water Pumps+Dust collector fans' },
    { energy: 'U6_PLC_Del_ActiveEnergy',  power: 'U6_PLC_ActivePower_Total',  powerFactor: 'U6_PLC_PowerFactor_Avg',  voltage: 'U6_PLC_Voltage_Avg',  metername: 'Turbine', deptname: 'Deep Well Turbine', MCS: '1', installedLoad: '22' },
     { energy: 'U14_PLC_Del_ActiveEnergy', power: 'U14_PLC_ActivePower_Total', powerFactor: 'U14_PLC_PowerFactor_Avg', voltage: 'U14_PLC_Voltage_Avg', metername: 'Compressor 119kw', deptname: 'Air Compressor', MCS: '3', installedLoad: '119' , info: 'Compressors 37kw+37kw+45kw' },
    { energy: 'U16_PLC_Del_ActiveEnergy', power: 'U16_PLC_ActivePower_Total', powerFactor: 'U16_PLC_PowerFactor_Avg', voltage: 'U16_PLC_Voltage_Avg', metername: 'Compressor 303kw', deptname: 'Air Compressor', MCS: '3', installedLoad: '303' },
    { energy: 'U4_PLC_Del_ActiveEnergy',  power: 'U4_PLC_ActivePower_Total',  powerFactor: 'U4_PLC_PowerFactor_Avg',  voltage: 'U4_PLC_Voltage_Avg',  metername: 'Lightning Inside', deptname: 'Mills Lighting', MCS: '1340', installedLoad: '25' },
    { energy: 'U3_PLC_Del_ActiveEnergy',  power: 'U3_PLC_ActivePower_Total',  powerFactor: 'U3_PLC_PowerFactor_Avg',  voltage: 'U3_PLC_Voltage_Avg',  metername: 'Lightning Outside', deptname: 'Mills Lighting', MCS: '48', installedLoad: '7' },
    { energy: 'U15_PLC_Del_ActiveEnergy', power: 'U15_PLC_ActivePower_Total', powerFactor: 'U15_PLC_PowerFactor_Avg', voltage: 'U15_PLC_Voltage_Avg', metername: 'Simplex 1~6', deptname: 'Drawing Simplex', MCS: '6', installedLoad: '16.5' },
    { energy: 'U9_PLC_Del_ActiveEnergy', power: 'U9_PLC_ActivePower_Total', powerFactor: 'U9_PLC_PowerFactor_Avg', voltage: 'U9_PLC_Voltage_Avg', metername: 'Winding 7~9', deptname: 'Auto Cone (Winding) 10-18', MCS: '3', installedLoad: '30' },
    { energy: 'U1_PLC_Del_ActiveEnergy',  power: 'U1_PLC_ActivePower_Total',  powerFactor: 'U1_PLC_PowerFactor_Avg',  voltage: 'U1_PLC_Voltage_Avg',  metername: 'Transport', deptname: 'R. Transport System', MCS: '1', installedLoad: '30' },
    { energy: 'U2_PLC_Del_ActiveEnergy',  power: 'U2_PLC_ActivePower_Total',  powerFactor: 'U2_PLC_PowerFactor_Avg',  voltage: 'U2_PLC_Voltage_Avg',  metername: 'Unit 5 Lighting', deptname: 'Mills Lighting', MCS: '1490', installedLoad: '30' },
    { energy: 'U5_PLC_Del_ActiveEnergy',  power: 'U5_PLC_ActivePower_Total',  powerFactor: 'U5_PLC_PowerFactor_Avg',  voltage: 'U5_PLC_Voltage_Avg',  metername: 'Power House (2nd Source Gas)', deptname: 'Power House', MCS: '1', installedLoad: '50' },
    { energy: 'U13_PLC_Del_ActiveEnergy',  power: 'U13_PLC_ActivePower_Total',  powerFactor: 'U13_PLC_PowerFactor_Avg',  voltage: 'U13_PLC_Voltage_Avg',  metername: 'Comber 1~10 + Uni Lap 1~2', deptname: 'Comber + Uni Lap', MCS: '12', installedLoad: '18' },
    { energy: 'U8_PLC_Del_ActiveEnergy',  power: 'U8_PLC_ActivePower_Total',  powerFactor: 'U8_PLC_PowerFactor_Avg',  voltage: 'U8_PLC_Voltage_Avg',  metername: 'Drawing Finisher 1~6 + 2 Breaker', deptname: 'Drawing (Finisher) + 2 Breaker', MCS: '8', installedLoad: '22' },



];

  // 🔹 LT2 meters
  private lt2Meters = [
    { energy: 'U1_GW01_Del_ActiveEnergy', power: 'U1_GW01_ActivePower_Total', powerFactor: 'U1_GW01_PowerFactor_Avg', voltage: 'U1_GW01_Voltage_Avg', metername: 'A/C Back Process', deptname: 'A/C Back Process', MCS: '1', installedLoad: '30' },
    { energy: 'U2_GW01_Del_ActiveEnergy', power: 'U2_GW01_ActivePower_Total', powerFactor: 'U2_GW01_PowerFactor_Avg', voltage: 'U2_GW01_Voltage_Avg', metername: 'Weikel Cond', deptname: 'Conditioning Machine', MCS: '1', installedLoad: '80' },
    { energy: 'U3_GW01_Del_ActiveEnergy', power: 'U3_GW01_ActivePower_Total', powerFactor: 'U3_GW01_PowerFactor_Avg', voltage: 'U3_GW01_Voltage_Avg', metername: 'Winding AC', deptname: 'A/C Auto Cone(Winding)', MCS: '1', installedLoad: '30' },
    { energy: 'U8_GW01_Del_ActiveEnergy', power: 'U8_GW01_ActivePower_Total', powerFactor: 'U8_GW01_PowerFactor_Avg', voltage: 'U8_GW01_Voltage_Avg', metername: 'Blow Room', deptname: 'Blow Room', MCS: '1', installedLoad: '151' },
    { energy: 'U5_GW01_Del_ActiveEnergy', power: 'U5_GW01_ActivePower_Total', powerFactor: 'U5_GW01_PowerFactor_Avg', voltage: 'U5_GW01_Voltage_Avg', metername: 'Card (1-4) (9-12)', deptname: 'Card + Breaker', MCS: '8', installedLoad: '19' },
    { energy: 'U9_GW01_Del_ActiveEnergy', power: 'U9_GW01_ActivePower_Total', powerFactor: 'U9_GW01_PowerFactor_Avg', voltage: 'U9_GW01_Voltage_Avg', metername: 'Card (5-8) (13-14)', deptname: 'Card + Breaker', MCS: '7', installedLoad: '25' },
    { energy: 'U15_GW01_Del_ActiveEnergy', power: 'U15_GW01_ActivePower_Total', powerFactor: 'U15_GW01_PowerFactor_Avg', voltage: 'U15_GW01_Voltage_Avg', metername: 'Ring 5-8', deptname: 'Ring Dept', MCS: '4', installedLoad: '80' },
    { energy: 'U16_GW01_Del_ActiveEnergy', power: 'U16_GW01_ActivePower_Total', powerFactor: 'U16_GW01_PowerFactor_Avg', voltage: 'U16_GW01_Voltage_Avg', metername: 'Ring 13-16', deptname: 'Ring Dept', MCS: '4', installedLoad: '80' },
    { energy: 'U17_GW01_Del_ActiveEnergy', power: 'U17_GW01_ActivePower_Total', powerFactor: 'U17_GW01_PowerFactor_Avg', voltage: 'U17_GW01_Voltage_Avg', metername: 'Ring 9-12', deptname: 'Ring Dept', MCS: '4', installedLoad: '80' },
    { energy: 'U14_GW01_Del_ActiveEnergy', power: 'U14_GW01_ActivePower_Total', powerFactor: 'U14_GW01_PowerFactor_Avg', voltage: 'U14_GW01_Voltage_Avg', metername: 'B/R Card Filter', deptname: 'B/Card + Comber Filter', MCS: '13', installedLoad: '199' },
    { energy: 'U12_GW01_Del_ActiveEnergy', power: 'U12_GW01_ActivePower_Total', powerFactor: 'U12_GW01_PowerFactor_Avg', voltage: 'U12_GW01_Voltage_Avg', metername: 'Card Filter (Bypass)', deptname: 'B/Card + Comber Filter', MCS: '13', installedLoad: '199' },
    { energy: 'U18_GW01_Del_ActiveEnergy', power: 'U18_GW01_ActivePower_Total', powerFactor: 'U18_GW01_PowerFactor_Avg', voltage: 'U18_GW01_Voltage_Avg', metername: 'Colony', deptname: 'Residential Colony', MCS: '1', installedLoad: '15' },
    { energy: 'U10_GW01_Del_ActiveEnergy', power: 'U10_GW01_ActivePower_Total', powerFactor: 'U10_GW01_PowerFactor_Avg', voltage: 'U10_GW01_Voltage_Avg', metername: 'Winding 1~6', deptname: 'Auto Cone (Winding) 10-18', MCS: '6', installedLoad: '30' },

    { energy: 'U4_GW01_Del_ActiveEnergy', power: 'U4_GW01_ActivePower_Total', powerFactor: 'U4_GW01_PowerFactor_Avg', voltage: 'U4_GW01_Voltage_Avg', metername: 'Mills RES-CLNY & Workshop', deptname: 'Workshop', MCS: '1', installedLoad: '60' },
    { energy: 'U6_GW01_Del_ActiveEnergy', power: 'U6_GW01_ActivePower_Total', powerFactor: 'U6_GW01_PowerFactor_Avg', voltage: 'U6_GW01_Voltage_Avg', metername: 'Bale Press', deptname: 'Bailing Press', MCS: '1', installedLoad: '0' },
    { energy: 'U19_GW01_Del_ActiveEnergy', power: 'U19_GW01_ActivePower_Total', powerFactor: 'U19_GW01_PowerFactor_Avg', voltage: 'U19_GW01_Voltage_Avg', metername: 'AC Lab', deptname: 'Lab Offices', MCS: '1', installedLoad: '4' },
    // { energy: 'U20_GW01_Del_ActiveEnergy', power: 'U20_GW01_ActivePower_Total', powerFactor: 'U20_GW01_PowerFactor_Avg', voltage: 'U20_GW01_Voltage_Avg', metername: 'Spare', deptname: 'Bailing Press', MCS: '1', installedLoad: '4' },
    // { energy: 'U3_GW01_Del_ActiveEnergy', power: 'U3_GW01_ActivePower_Total', powerFactor: 'U3_GW01_PowerFactor_Avg', voltage: 'U6_GW01_Voltage_Avg', metername: 'Rooms, Quarter, Bunglows', deptname: 'Residential Colony', MCS: '0', installedLoad: '0' },
    { energy: 'U7_GW01_Del_ActiveEnergy', power: 'U7_GW01_ActivePower_Total', powerFactor: 'U7_GW01_PowerFactor_Avg', voltage: 'U7_GW01_Voltage_Avg', metername: 'Power House Second Source (HFO)', deptname: 'Power House Second Source', MCS: '1', installedLoad: '100' },
// changed in to u11 to u7
    
  ];


    private unit5Lt1Meters = [
    { energy: 'U9_GW02_Del_ActiveEnergy', power: 'U9_GW02_ActivePower_Total', powerFactor: 'U9_GW02_PowerFactor_Avg', voltage: 'U9_GW02_Voltage_Avg', metername: 'Blow Room L1', deptname: 'Blow Room', MCS: '1', installedLoad: '144.5' },
    { energy: 'U19_GW02_Del_ActiveEnergy', power: 'U19_GW02_ActivePower_Total', powerFactor: 'U19_GW02_PowerFactor_Avg', voltage: 'U19_GW02_Voltage_Avg', metername: 'Card M/C 1-7', deptname: 'Card', MCS: '7', installedLoad: '20.9' },
    { energy: 'U17_GW02_Del_ActiveEnergy', power: 'U17_GW02_ActivePower_Total', powerFactor: 'U17_GW02_PowerFactor_Avg', voltage: 'U17_GW02_Voltage_Avg', metername: 'Card M/C 8-14', deptname: 'Card', MCS: '7', installedLoad: '20.9' },
    { energy: 'U23_GW02_Del_ActiveEnergy', power: 'U23_GW02_ActivePower_Total', powerFactor: 'U23_GW02_PowerFactor_Avg', voltage: 'U23_GW02_Voltage_Avg', metername: 'Draw Frame Finish 1~8', deptname: 'Drawing Finisher 1-8', MCS: '8', installedLoad: '13.6' },
    { energy: 'U21_GW02_Del_ActiveEnergy', power: 'U21_GW02_ActivePower_Total', powerFactor: 'U21_GW02_PowerFactor_Avg', voltage: 'U21_GW02_Voltage_Avg', metername: 'Simplex M/C 1~6 + 1~5 Breaker Machines', deptname: 'Drawing Simplex + Breaker', MCS: '8', installedLoad: '34' },
    { energy: 'U10_GW02_Del_ActiveEnergy', power: 'U10_GW02_ActivePower_Total', powerFactor: 'U10_GW02_PowerFactor_Avg', voltage: 'U10_GW02_Voltage_Avg', metername: 'Ring Frames 4-6', deptname: 'Ring Dept', MCS: '3', installedLoad: '141' },
    { energy: 'U7_GW02_Del_ActiveEnergy', power: 'U7_GW02_ActivePower_Total', powerFactor: 'U7_GW02_PowerFactor_Avg', voltage: 'U7_GW02_Voltage_Avg', metername: 'Ring 1-3', deptname: 'Ring Dept', MCS: '3', installedLoad: '141' },
    { energy: 'U18_GW02_Del_ActiveEnergy', power: 'U18_GW02_ActivePower_Total', powerFactor: 'U18_GW02_PowerFactor_Avg', voltage: 'U18_GW02_Voltage_Avg', metername: 'Auto Con 1-9', deptname: 'Auto Cone (Winding) 10-18', MCS: '9', installedLoad: '26.2' },
    { energy: 'U12_GW02_Del_ActiveEnergy', power: 'U12_GW02_ActivePower_Total', powerFactor: 'U12_GW02_PowerFactor_Avg', voltage: 'U12_GW02_Voltage_Avg', metername: 'MLDB1 Blower Room Card', deptname: 'Blow Room', MCS: '1', installedLoad: '70' },
    { energy: 'U20_GW02_Del_ActiveEnergy', power: 'U20_GW02_ActivePower_Total', powerFactor: 'U20_GW02_PowerFactor_Avg', voltage: 'U20_GW02_Voltage_Avg', metername: 'AC Plant Winding', deptname: 'A/C Auto Cone(Winding)', MCS: '1', installedLoad: '70' },
    { energy: 'U8_GW02_Del_ActiveEnergy', power: 'U8_GW02_ActivePower_Total', powerFactor: 'U8_GW02_PowerFactor_Avg', voltage: 'U8_GW02_Voltage_Avg', metername: 'AC Supply Fan', deptname: 'AC_Ring', MCS: '14', installedLoad: '476' },
    { energy: 'U15_GW02_Del_ActiveEnergy', power: 'U15_GW02_ActivePower_Total', powerFactor: 'U15_GW02_PowerFactor_Avg', voltage: 'U15_GW02_Voltage_Avg', metername: 'AC Return Fan', deptname: 'AC_Ring', MCS: '9', installedLoad: '476' },
    { energy: 'U11_GW02_Del_ActiveEnergy', power: 'U11_GW02_ActivePower_Total', powerFactor: 'U11_GW02_PowerFactor_Avg', voltage: 'U11_GW02_Voltage_Avg', metername: 'A/C Plant Blowing', deptname: 'A/C Back Process', MCS: '1', installedLoad: '75' },

   
  
    
    ];

      private unit5Lt2Meters = [
    { energy: 'U4_GW03_Del_ActiveEnergy', power: 'U4_GW03_ActivePower_Total', powerFactor: 'U4_GW03_PowerFactor_Avg', voltage: 'U4_GW03_Voltage_Avg', metername: 'Roving Transport System', deptname: 'R. Transport System', MCS: '1', installedLoad: '30' },
    { energy: 'U1_GW03_Del_ActiveEnergy', power: 'U1_GW03_ActivePower_Total', powerFactor: 'U1_GW03_PowerFactor_Avg', voltage: 'U1_GW03_Voltage_Avg', metername: 'Ring Frame 7-9', deptname: 'Ring Dept', MCS: '3', installedLoad: '141' },
    { energy: 'U5_GW03_Del_ActiveEnergy', power: 'U5_GW03_ActivePower_Total', powerFactor: 'U5_GW03_PowerFactor_Avg', voltage: 'U5_GW03_Voltage_Avg', metername: 'Ring Frame 10-12', deptname: 'Ring Dept', MCS: '3', installedLoad: '141' },
    { energy: 'U9_GW03_Del_ActiveEnergy', power: 'U9_GW03_ActivePower_Total', powerFactor: 'U9_GW03_PowerFactor_Avg', voltage: 'U9_GW03_Voltage_Avg', metername: 'Ring Frame 13-15', deptname: 'Ring Dept', MCS: '3', installedLoad: '141' },
    { energy: 'U12_GW03_Del_ActiveEnergy', power: 'U12_GW03_ActivePower_Total', powerFactor: 'U12_GW03_PowerFactor_Avg', voltage: 'U12_GW03_Voltage_Avg', metername: 'Ring Frame 16-18', deptname: 'Ring Dept', MCS: '3', installedLoad: '141' },
    { energy: 'U2_GW03_Del_ActiveEnergy', power: 'U2_GW03_ActivePower_Total', powerFactor: 'U2_GW03_PowerFactor_Avg', voltage: 'U2_GW03_Voltage_Avg', metername: 'Yarn Conditioning M/C', deptname: 'Conditioning Machine', MCS: '1', installedLoad: '17' },
    { energy: 'U6_GW03_Del_ActiveEnergy', power: 'U6_GW03_ActivePower_Total', powerFactor: 'U6_GW03_PowerFactor_Avg', voltage: 'U6_GW03_Voltage_Avg', metername: 'Spare 3', deptname: 'Comber + Uni Lap', MCS: '14', installedLoad: '19.9' },
    { energy: 'U14_GW03_Del_ActiveEnergy', power: 'U14_GW03_ActivePower_Total', powerFactor: 'U14_GW03_PowerFactor_Avg', voltage: 'U14_GW03_Voltage_Avg', metername: 'MLDB2 Ring Con (Lighting)', deptname: 'Mills Lighting', MCS: '1490', installedLoad: '27' },
    { energy: 'U13_GW03_Del_ActiveEnergy', power: 'U13_GW03_ActivePower_Total', powerFactor: 'U13_GW03_PowerFactor_Avg', voltage: 'U13_GW03_Voltage_Avg', metername: 'Fiber Deposit Plant', deptname: 'B/Card + Comber Filter', MCS: '1', installedLoad: '160' },
    { energy: 'U15_GW03_Del_ActiveEnergy', power: 'U15_GW03_ActivePower_Total', powerFactor: 'U15_GW03_PowerFactor_Avg', voltage: 'U15_GW03_Voltage_Avg', metername: 'Deep Valve Turbine', deptname: 'Deep Well Turbine', MCS: '1', installedLoad: '22.0' },
    { energy: 'U11_GW03_Del_ActiveEnergy', power: 'U11_GW03_ActivePower_Total', powerFactor: 'U11_GW03_PowerFactor_Avg', voltage: 'U11_GW03_Voltage_Avg', metername: 'Bailing Press', deptname: 'Bailing Press', MCS: '1', installedLoad: '22.5' },
    { energy: 'U10_GW03_Del_ActiveEnergy', power: 'U10_GW03_ActivePower_Total', powerFactor: 'U10_GW03_PowerFactor_Avg', voltage: 'U10_GW03_Voltage_Avg', metername: 'Auto Con 10-18', deptname: 'Auto Cone (Winding) 10-18', MCS: '9', installedLoad: '26.2' },

  ];

  // ✅ merged function
async calculateConsumption(
  dto: ConsumptionDto,
  line: 'LT1' | 'LT2' | 'Unit5-LT1' | 'Unit5-LT2'
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

  // Step 1: get the original calculated result
  const result = await calculateConsumptionCore(dto, metersConfig, this.historicalModel);

  // Step 2: map info field back to each meter (if present)
  if (result?.meters && Array.isArray(result.meters)) {
    result.meters = result.meters.map((meter: any) => {
      const matchedConfig = metersConfig.find(
        (cfg) => cfg.metername === meter.metername
      );
      return {
        ...meter,
        info: matchedConfig?.info ?? '',
      };
    });
  }

  return result;
}




}
