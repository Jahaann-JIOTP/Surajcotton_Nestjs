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

  // 🔹 LT1 meters
  private lt1Meters = [
    { energy: 'U10_PLC_Del_ActiveEnergy', power: 'U10_PLC_ActivePower_Total', powerFactor: 'U10_PLC_PowerFactor_Avg', voltage: 'U10_PLC_Voltage_Avg', metername: 'Ring Db 01', deptname: 'Ring', MCS: '24', installedLoad: '80' },
    { energy: 'U11_PLC_Del_ActiveEnergy', power: 'U11_PLC_ActivePower_Total', powerFactor: 'U11_PLC_PowerFactor_Avg', voltage: 'U11_PLC_Voltage_Avg', metername: 'Ring Db 02', deptname: 'Ring', MCS: '24', installedLoad: '80' },
    { energy: 'U12_PLC_Del_ActiveEnergy', power: 'U12_PLC_ActivePower_Total', powerFactor: 'U12_PLC_PowerFactor_Avg', voltage: 'U12_PLC_Voltage_Avg', metername: 'Ring Db 03', deptname: 'Ring', MCS: '24', installedLoad: '80' },
    { energy: 'U17_PLC_Del_ActiveEnergy', power: 'U17_PLC_ActivePower_Total', powerFactor: 'U17_PLC_PowerFactor_Avg', voltage: 'U17_PLC_Voltage_Avg', metername: 'AC_Ring Db 01', deptname: 'AC_Ring', MCS: '0', installedLoad: '347.5' },
    { energy: 'U18_PLC_Del_ActiveEnergy', power: 'U18_PLC_ActivePower_Total', powerFactor: 'U18_PLC_PowerFactor_Avg', voltage: 'U18_PLC_Voltage_Avg', metername: 'AC_Ring Db 02', deptname: 'AC_Ring', MCS: '0', installedLoad: '347.5' },
    { energy: 'U6_PLC_Del_ActiveEnergy',  power: 'U6_PLC_ActivePower_Total',  powerFactor: 'U6_PLC_PowerFactor_Avg',  voltage: 'U6_PLC_Voltage_Avg',  metername: 'Deep Velve Turbine', deptname: 'Turbine', MCS: '1', installedLoad: '22' },
     { energy: 'U14_PLC_Del_ActiveEnergy', power: 'U14_PLC_ActivePower_Total', powerFactor: 'U14_PLC_PowerFactor_Avg', voltage: 'U14_PLC_Voltage_Avg', metername: 'Air Compressor', deptname: 'Air Compressor', MCS: '3', installedLoad: '119' },
    { energy: 'U16_PLC_Del_ActiveEnergy', power: 'U16_PLC_ActivePower_Total', powerFactor: 'U16_PLC_PowerFactor_Avg', voltage: 'U16_PLC_Voltage_Avg', metername: 'Air Compressor', deptname: 'Air Compressor', MCS: '3', installedLoad: '119' },
    { energy: 'U3_PLC_Del_ActiveEnergy',  power: 'U3_PLC_ActivePower_Total',  powerFactor: 'U3_PLC_PowerFactor_Avg',  voltage: 'U3_PLC_Voltage_Avg',  metername: 'Lighting internal', deptname: 'Mills lighting', MCS: '1', installedLoad: '60' },
    { energy: 'U4_PLC_Del_ActiveEnergy',  power: 'U4_PLC_ActivePower_Total',  powerFactor: 'U4_PLC_PowerFactor_Avg',  voltage: 'U4_PLC_Voltage_Avg',  metername: 'Lighting internal', deptname: 'Mills lighting', MCS: '1', installedLoad: '60' },
    { energy: 'U15_PLC_Del_ActiveEnergy', power: 'U15_PLC_ActivePower_Total', powerFactor: 'U15_PLC_PowerFactor_Avg', voltage: 'U15_PLC_Voltage_Avg', metername: 'Simplex', deptname: 'Simplex', MCS: '6', installedLoad: '16.5' },
    { energy: 'U1_PLC_Del_ActiveEnergy',  power: 'U1_PLC_ActivePower_Total',  powerFactor: 'U1_PLC_PowerFactor_Avg',  voltage: 'U1_PLC_Voltage_Avg',  metername: 'Transport system', deptname: 'R. Transport System', MCS: '0', installedLoad: '0' },
    { energy: 'U13_PLC_Del_ActiveEnergy', power: 'U13_PLC_ActivePower_Total', powerFactor: 'U13_PLC_PowerFactor_Avg', voltage: 'U13_PLC_Voltage_Avg', metername: 'Comber', deptname: 'Comber', MCS: '9', installedLoad: '6.2' },

];

  // 🔹 LT2 meters
  private lt2Meters = [
    { energy: 'U8_GW01_Del_ActiveEnergy', power: 'U8_GW01_ActivePower_Total', powerFactor: 'U8_GW01_PowerFactor_Avg', voltage: 'U8_GW01_Voltage_Avg', metername: 'Blow Room', deptname: 'Blow Room', MCS: '1', installedLoad: '151' },
    { energy: 'U5_GW01_Del_ActiveEnergy', power: 'U5_GW01_ActivePower_Total', powerFactor: 'U5_GW01_PowerFactor_Avg', voltage: 'U5_GW01_Voltage_Avg', metername: 'Card db 01', deptname: 'Card', MCS: '14', installedLoad: '19.0' },
    { energy: 'U9_GW01_Del_ActiveEnergy', power: 'U9_GW01_ActivePower_Total', powerFactor: 'U9_GW01_PowerFactor_Avg', voltage: 'U9_GW01_Voltage_Avg', metername: 'Card db 02', deptname: 'Card', MCS: '14', installedLoad: '19.0' },
    { energy: 'U15_GW01_Del_ActiveEnergy', power: 'U15_GW01_ActivePower_Total', powerFactor: 'U15_GW01_PowerFactor_Avg', voltage: 'U15_GW01_Voltage_Avg', metername: 'Ring db 02', deptname: 'Ring Dept', MCS: '24', installedLoad: '80.0' },
    { energy: 'U17_GW01_Del_ActiveEnergy', power: 'U17_GW01_ActivePower_Total', powerFactor: 'U17_GW01_PowerFactor_Avg', voltage: 'U17_GW01_Voltage_Avg', metername: 'Ring db 03', deptname: 'Ring Dept', MCS: '24', installedLoad: '80.0' },
    { energy: 'U16_GW01_Del_ActiveEnergy', power: 'U16_GW01_ActivePower_Total', powerFactor: 'U16_GW01_PowerFactor_Avg', voltage: 'U16_GW01_Voltage_Avg', metername: 'Ring db 04', deptname: 'Ring Dept', MCS: '24', installedLoad: '80.0' },
    { energy: 'U14_GW01_Del_ActiveEnergy', power: 'U14_GW01_ActivePower_Total', powerFactor: 'U14_GW01_PowerFactor_Avg', voltage: 'U14_GW01_Voltage_Avg', metername: 'Blow Room Card Filter', deptname: 'B/Card + comber filter', MCS: '1', installedLoad: '199.0' },
    { energy: 'U12_GW01_Del_ActiveEnergy', power: 'U12_GW01_ActivePower_Total', powerFactor: 'U12_GW01_PowerFactor_Avg', voltage: 'U12_GW01_Voltage_Avg', metername: 'Blow Room Card Filter', deptname: 'B/Card + comber filter', MCS: '1', installedLoad: '199.0' },
    { energy: 'U18_GW01_Del_ActiveEnergy', power: 'U18_GW01_ActivePower_Total', powerFactor: 'U18_GW01_PowerFactor_Avg', voltage: 'U18_GW01_Voltage_Avg', metername: 'Bale Press', deptname: 'Bailing press', MCS: '1', installedLoad: '15.0' },
    { energy: 'U4_GW01_Del_ActiveEnergy', power: 'U4_GW01_ActivePower_Total', powerFactor: 'U4_GW01_PowerFactor_Avg', voltage: 'U4_GW01_Voltage_Avg', metername: 'Mills Colony workshop', deptname: 'Residential Colony', MCS: '0', installedLoad: '30.0' },
    { energy: 'U6_GW01_Del_ActiveEnergy', power: 'U6_GW01_ActivePower_Total', powerFactor: 'U6_GW01_PowerFactor_Avg', voltage: 'U6_GW01_Voltage_Avg', metername: 'Bachelor Colony', deptname: 'Residential Colony', MCS: '0', installedLoad: '30.0' },
    { energy: 'U19_GW01_Del_ActiveEnergy', power: 'U19_GW01_ActivePower_Total', powerFactor: 'U19_GW01_PowerFactor_Avg', voltage: 'U19_GW01_Voltage_Avg', metername: 'AC Lab', deptname: 'lab + office', MCS: '0', installedLoad: '0' },
    { energy: 'U3_GW01_Del_ActiveEnergy', power: 'U3_GW01_ActivePower_Total', powerFactor: 'U3_GW01_PowerFactor_Avg', voltage: 'U3_GW01_Voltage_Avg', metername: 'Rooms, Quarter, Bundlows', deptname: 'Residential Colony', MCS: '0', installedLoad: '30.0' },
    
  ];


    private unit5Lt1Meters = [
    { energy: 'U9_GW02_Del_ActiveEnergy', power: 'U9_GW02_ActivePower_Total', powerFactor: 'U9_GW02_PowerFactor_Avg', voltage: 'U9_GW02_Voltage_Avg', metername: 'Blow Room', deptname: 'Blow Room', MCS: '1', installedLoad: '151' },
    { energy: 'U19_GW02_Del_ActiveEnergy', power: 'U19_GW02_ActivePower_Total', powerFactor: 'U19_GW02_PowerFactor_Avg', voltage: 'U19_GW02_Voltage_Avg', metername: 'Card MC1 to 7', deptname: 'Card', MCS: '14', installedLoad: '19.0' },
    { energy: 'U17_GW02_Del_ActiveEnergy', power: 'U17_GW02_ActivePower_Total', powerFactor: 'U17_GW02_PowerFactor_Avg', voltage: 'U17_GW02_Voltage_Avg', metername: 'Carding 8 to 14', deptname: 'Card', MCS: '14', installedLoad: '19.0' },
    { energy: 'U23_GW02_Del_ActiveEnergy', power: 'U23_GW02_ActivePower_Total', powerFactor: 'U23_GW02_PowerFactor_Avg', voltage: 'U23_GW02_Voltage_Avg', metername: 'Draw Frame Finisher 1 to 8', deptname: 'Drawing Finisher', MCS: '6', installedLoad: '13.6' },
    { energy: 'U21_GW02_Del_ActiveEnergy', power: 'U21_GW02_ActivePower_Total', powerFactor: 'U21_GW02_PowerFactor_Avg', voltage: 'U21_GW02_Voltage_Avg', metername: 'Simplex MC 1 to 5 PDB4', deptname: 'Simplex', MCS: '6', installedLoad: '16.5' },
    { energy: 'U10_GW02_Del_ActiveEnergy', power: 'U10_GW02_ActivePower_Total', powerFactor: 'U10_GW02_PowerFactor_Avg', voltage: 'U10_GW02_Voltage_Avg', metername: 'Ring Frame 4 to 6', deptname: 'Ring Dept', MCS: '24', installedLoad: '80.0' },
    { energy: 'U7_GW02_Del_ActiveEnergy', power: 'U7_GW02_ActivePower_Total', powerFactor: 'U7_GW02_PowerFactor_Avg', voltage: 'U7_GW02_Voltage_Avg', metername: 'Ring 1 to 3', deptname: 'Ring Dept', MCS: '24', installedLoad: '80.0' },
    { energy: 'U18_GW02_Del_ActiveEnergy', power: 'U18_GW02_ActivePower_Total', powerFactor: 'U18_GW02_PowerFactor_Avg', voltage: 'U18_GW02_Voltage_Avg', metername: 'Auto Cone 1 to 9', deptname: 'Auto Cone', MCS: '8', installedLoad: '30.0' },
    { energy: 'U10_GW02_Del_ActiveEnergy', power: 'U10_GW02_ActivePower_Total', powerFactor: 'U10_GW02_PowerFactor_Avg', voltage: 'U10_GW02_Voltage_Avg', metername: 'Auto Cone 10 to 18', deptname: 'Auto Cone', MCS: '8', installedLoad: '30.0' },
    { energy: 'U12_GW02_Del_ActiveEnergy', power: 'U12_GW02_ActivePower_Total', powerFactor: 'U12_GW02_PowerFactor_Avg', voltage: 'U12_GW02_Voltage_Avg', metername: 'B.R Card Comber Simplex Service Bay Road Lights', deptname: 'B/Card + comber filter', MCS: '0', installedLoad: '199.0' },
  ];

      private unit5Lt2Meters = [
    { energy: 'U4_GW03_Del_ActiveEnergy', power: 'U4_GW03_ActivePower_Total', powerFactor: 'U4_GW03_PowerFactor_Avg', voltage: 'U4_GW03_Voltage_Avg', metername: 'Roving Transport', deptname: 'R. Transport System', MCS: '0', installedLoad: '0' },
    { energy: 'U1_GW03_Del_ActiveEnergy', power: 'U1_GW03_ActivePower_Total', powerFactor: 'U1_GW03_PowerFactor_Avg', voltage: 'U1_GW03_Voltage_Avg', metername: 'Ring Frame 7 to 9', deptname: 'Ring Dept', MCS: '24', installedLoad: '80.0' },
    { energy: 'U5_GW03_Del_ActiveEnergy', power: 'U5_GW03_ActivePower_Total', powerFactor: 'U5_GW03_PowerFactor_Avg', voltage: 'U5_GW03_Voltage_Avg', metername: 'Ring Frame 10 to 12', deptname: 'Ring Dept', MCS: '24', installedLoad: '80.0' },
    { energy: 'U9_GW03_Del_ActiveEnergy', power: 'U9_GW03_ActivePower_Total', powerFactor: 'U9_GW03_PowerFactor_Avg', voltage: 'U9_GW03_Voltage_Avg', metername: 'Ring Frame 13 to 15', deptname: 'Ring Dept', MCS: '24', installedLoad: '80.0' },
    { energy: 'U12_GW03_Del_ActiveEnergy', power: 'U12_GW03_ActivePower_Total', powerFactor: 'U12_GW03_PowerFactor_Avg', voltage: 'U12_GW03_Voltage_Avg', metername: 'Ring Frame 16 to 18', deptname: 'Ring Dept', MCS: '24', installedLoad: '80.0' },
    { energy: 'U15_GW03_Del_ActiveEnergy', power: 'U15_GW03_ActivePower_Total', powerFactor: 'U15_GW03_PowerFactor_Avg', voltage: 'U15_GW03_Voltage_Avg', metername: 'Turbine', deptname: 'Deep Velve Turbine', MCS: '1', installedLoad: '22.0' },
    { energy: 'U11_GW03_Del_ActiveEnergy', power: 'U11_GW03_ActivePower_Total', powerFactor: 'U11_GW03_PowerFactor_Avg', voltage: 'U11_GW03_Voltage_Avg', metername: 'Bailing Press', deptname: 'Bailing Press', MCS: '1', installedLoad: '15.0' },





   

  ];

  // ✅ merged function
async calculateConsumption(
  dto: ConsumptionDto,
  line: 'LT1' | 'LT2' |'Unit5-LT1' | 'Unit5-LT2'
) {
  let metersConfig;

  switch (line) {
    case 'LT1':
      metersConfig = this.lt1Meters;
      break;
    case 'LT2':
      metersConfig = this.lt2Meters;
      break;
   
    case 'Unit5-LT1':
      metersConfig = this.unit5Lt1Meters;
      break;
    case 'Unit5-LT2':
      metersConfig = this.unit5Lt2Meters;
      break;
    default:
      throw new Error(`❌ No metersConfig found for line=${line}`);
  }

  return calculateConsumptionCore(dto, metersConfig, this.historicalModel);
}




}
