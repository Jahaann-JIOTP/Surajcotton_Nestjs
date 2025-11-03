import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigAlarmDto } from './dto/alarmsConfig.dto';
import { AlarmsTypeDto } from './dto/alarmsType.dto';
import { SnoozeDto } from './dto/snooze.dto';
import { alarmsConfiguration } from './schema/alarmsConfig.schema';
import {
  AlarmRulesSet,
  AlarmRulesSetDocument,
  ThresholdCondition,
} from './schema/alarmsTriggerConfig.schema';
import { AlarmsType } from './schema/alarmsType.schema';
import { Alarms, AlarmsDocument } from './schema/alarmsModel.schema';
import {
  AlarmOccurrence,
  AlarmsOccurrenceDocument,
} from './schema/alarmOccurences.schema';
import { UpdateAlarmDto } from './dto/update-alarm.dto';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { getTimeRange, TimeRangePayload } from 'src/helpers/generalTimeFilter';
// Local type to represent an alarm config document with populated refs
// (keeps this file lightweight rather than changing global schema types)
type AlarmConfigWithPopulate = alarmsConfiguration & {
  _id?: any;
  alarmTriggerConfig?: AlarmRulesSet | null;
  alarmTypeId?: Partial<AlarmsType> | null;
};
@Injectable()
export class AlarmsService {
  constructor(
    @InjectModel(AlarmsType.name, 'surajcotton')
    private alarmTypeModel: Model<AlarmsType>,
    @InjectModel(alarmsConfiguration.name, 'surajcotton')
    private alarmsModel: Model<alarmsConfiguration>,
    @InjectModel(AlarmRulesSet.name, 'surajcotton')
    private alarmsRulesSetModel: Model<AlarmRulesSet>,
    @InjectModel(Alarms.name, 'surajcotton')
    private alarmsEventModel: Model<AlarmsDocument>,
    @InjectModel(AlarmOccurrence.name, 'surajcotton')
    private alarmOccurrenceModel: Model<AlarmsOccurrenceDocument>,
    private readonly httpService: HttpService,
  ) {}
  /**
   * @description
   * @author (Set the text for this tag by adding docthis.authorName to your settings file.)
   * @date 09/09/2025
   * @private
   * @memberof AlarmsService
   */
  private readonly intervalsSec = [5, 15, 30, 60, 120];
  private readonly Time = [1, 2, 3, 4, 5];

  private meterSuffixMapping(): Record<string, string[]> {
    return {
      Transport: ['U1_PLC_VOLTAGE', 'TOT'],
      FM_02: ['FR', 'TOT'],
      TEMP_RTD_01: ['AI'],
      TEMP_RTD_02: ['AI'],
      PT_01: ['AI'],
      INV_01_SPD: ['AI'],
      LLS_01: ['DI'],
      LS_01: ['DI'],
      VS_FAN_01: ['DI'],
      U1_PLC: [
        'Voltage_AN_V',
        'Voltage_BN_V',
        'Voltage_CN_V',
        'Voltage_LN_V',
        'Voltage_AB_V',
        'Voltage_BC_V',
        'Voltage_CA_V',
        'Voltage_LL_V',
        'Current_AN_Amp',
        'Current_BN_Amp',
        'Current_CN_Amp',
        'Current_Total_Amp',
        'Frequency_Hz',
        'ActivePower_A_kW',
        'ActivePower_B_kW',
        'ActivePower_C_kW',
        'ActivePower_Total_kW',
        'ReactivePower_A_kVAR',
        'ReactivePower_B_kVAR',
        'ReactivePower_C_kVAR',
        'ReactivePower_Total_kVAR',
        'ApparentPower_A_kVA',
        'ApparentPower_B_kVA',
        'ApparentPower_C_kVA',
        'ApparentPower_Total_kVA',
        'ActiveEnergy_A_kWh',
        'ActiveEnergy_B_kWh',
        'ActiveEnergy_C_kWh',
        'ActiveEnergy_Total_kWh',
        'ActiveEnergy_A_Received_kWh',
        'ActiveEnergy_B_Received_kWh',
        'ActiveEnergy_C_Received_kWh',
        'ActiveEnergy_Total_Received_kWh',
        'ActiveEnergy_A_Delivered_kWh',
        'ActiveEnergy_B_Delivered_kWh',
        'ActiveEnergy_C_Delivered_kWh',
        'ActiveEnergy_Total_Delivered_kWh',
        'ApparentEnergy_A_kVAh',
        'ApparentEnergy_B_kVAh',
        'ApparentEnergy_C_kVAh',
        'ApparentEnergy_Total_kVAh',
        'ReactiveEnergy_A_kVARh',
        'ReactiveEnergy_B_kVARh',
        'ReactiveEnergy_C_kVARh',
        'ReactiveEnergy_Total_kVARh',
        'ReactiveEnergy_A_Inductive_kVARh',
        'ReactiveEnergy_B_Inductive_kVARh',
        'ReactiveEnergy_C_Inductive_kVARh',
        'ReactiveEnergy_Total_Inductive_kVARh',
        'ReactiveEnergy_A_Capacitive_kVARh',
        'ReactiveEnergy_B_Capacitive_kVARh',
        'ReactiveEnergy_C_Capacitive_kVARh',
        'ReactiveEnergy_Total_Capacitive_kVARh',
        'Harmonics_V1_THD',
        'Harmonics_V2_THD',
        'Harmonics_V3_THD',
        'Harmonics_I1_THD',
        'Harmonics_I2_THD',
        'Harmonics_I3_THD',
        'PowerFactor_A',
        'PowerFactor_B',
        'PowerFactor_C',
        'PowerFactor_Total',
      ],
      // Add more here as needed...
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async DevicesDropdownList() {
    const mapping = this.meterSuffixMapping();

    // Create dropdown-friendly format
    return Object.keys(mapping).map((meterId) => ({
      meterId,
      suffixes: mapping[meterId],
    }));
  }

  getMappedLocation(): Record<string, string[]> {
    return {
      Unit_4: ['LT1', 'LT2', 'Unit 4 HT Room'],
      'Unit_4.LT1': [
        'Transport',
        'Unit 5 Lightning',
        'Lightning Outside',
        'Lightning Inside',
        'Power House (2nd Source Gas)',
        'Turbine',
        'Main Meter',
        'Drawing Finisher 1~6+2 Breaker',
        'Winding 7~9',
        'Ring 1~4',
        'Ring 16~20',
        'Ring 21~24',
        'Comber 1-10 + Uni-Lap 1-2',
        'Compressor (119kw)',
        'Simplex 1~6',
        'Compressor (303kw)',
        'Ring AC',
        'Diesel + JGS Incoming',
        'Compressor 119kw',
        'Wapda + HFO + JMS Incoming',
        'Ring AC (Bypass)',
      ],
      //U1_PLC
      'Unit_4.LT1.Transport': [
        'U1_PLC_Voltage_AB',
        'U1_PLC_Voltage_BC',
        'U1_PLC_Voltage_CA',
        'U1_PLC_Current_A',
        'U1_PLC_Current_B',
        'U1_PLC_Current_C',
        'U1_PLC_PowerFactor_A',
        'U1_PLC_PowerFactor_B',
        'U1_PLC_PowerFactor_C',
        'U1_PLC_ActivePower_Total',
        'U1_PLC_ReactivePower_Total',
        'U1_PLC_ApparentPower_Total',
        'U1_PLC_Del_ActiveEnergy',
        'U1_PLC_Rec_Active_Energy',
        'U1_PLC_Harmonics_V1_THD',
        'U1_PLC_Harmonics_V2_THD',
        'U1_PLC_Harmonics_V3_THD',
        'U1_PLC_Harmonics_I1_THD',
        'U1_PLC_Harmonics_I2_THD',
        'U1_PLC_Harmonics_I3_THD',
        'U1_PLC_Voltage_AN',
        'U1_PLC_Voltage_BN',
        'U1_PLC_Voltage_CN',
        'U1_PLC_Voltage_LN_Avg',
        'U1_PLC_Voltage_Avg',
        'U1_PLC_Current_Avg',
        'U1_PLC_PowerFactor_Avg',
        'U1_PLC_Power_Phase_A',
        'U1_PLC_Power_Phase_B',
        'U1_PLC_Power_Phase_C',
      ],
      //U2_PLC
      'Unit_4.LT1.Unit 5 Lightning': [
        'U2_PLC_Voltage_AB',
        'U2_PLC_Voltage_BC',
        'U2_PLC_Voltage_CA',
        'U2_PLC_Current_A',
        'U2_PLC_Current_B',
        'U2_PLC_Current_C',
        'U2_PLC_PowerFactor_A',
        'U2_PLC_PowerFactor_B',
        'U2_PLC_PowerFactor_C',
        'U2_PLC_ActivePower_Total',
        'U2_PLC_ReactivePower_Total',
        'U2_PLC_ApparentPower_Total',
        'U2_PLC_Del_ActiveEnergy',
        'U2_PLC_Rec_Active_Energy',
        'U2_PLC_Harmonics_V1_THD',
        'U2_PLC_Harmonics_V2_THD',
        'U2_PLC_Harmonics_V3_THD',
        'U2_PLC_Harmonics_I1_THD',
        'U2_PLC_Harmonics_I2_THD',
        'U2_PLC_Harmonics_I3_THD',
        'U2_PLC_Voltage_AN',
        'U2_PLC_Voltage_BN',
        'U2_PLC_Voltage_CN',
        'U2_PLC_Voltage_LN_Avg',
        'U2_PLC_Voltage_Avg',
        'U2_PLC_Current_Avg',
        'U2_PLC_PowerFactor_Avg',
        'U2_PLC_Power_Phase_A',
        'U2_PLC_Power_Phase_B',
        'U2_PLC_Power_Phase_C',
      ],
      //U3_PLC
      'Unit_4.LT1.Lightning Outside': [
        'U3_PLC_Voltage_AB',
        'U3_PLC_Voltage_BC',
        'U3_PLC_Voltage_CA',
        'U3_PLC_Current_A',
        'U3_PLC_Current_B',
        'U3_PLC_Current_C',
        'U3_PLC_PowerFactor_A',
        'U3_PLC_PowerFactor_B',
        'U3_PLC_PowerFactor_C',
        'U3_PLC_ActivePower_Total',
        'U3_PLC_ReactivePower_Total',
        'U3_PLC_ApparentPower_Total',
        'U3_PLC_Del_ActiveEnergy',
        'U3_PLC_Rec_Active_Energy',
        'U3_PLC_Harmonics_V1_THD',
        'U3_PLC_Harmonics_V2_THD',
        'U3_PLC_Harmonics_V3_THD',
        'U3_PLC_Harmonics_I1_THD',
        'U3_PLC_Harmonics_I2_THD',
        'U3_PLC_Harmonics_I3_THD',
        'U3_PLC_Voltage_AN',
        'U3_PLC_Voltage_BN',
        'U3_PLC_Voltage_CN',
        'U3_PLC_Voltage_LN_Avg',
        'U3_PLC_Voltage_Avg',
        'U3_PLC_Current_Avg',
        'U3_PLC_PowerFactor_Avg',
        'U3_PLC_Power_Phase_A',
        'U3_PLC_Power_Phase_B',
        'U3_PLC_Power_Phase_C',
      ],
      //U4_PLC
      'Unit_4.LT1.Lightning Inside': [
        'U4_PLC_Voltage_AB',
        'U4_PLC_Voltage_BC',
        'U4_PLC_Voltage_CA',
        'U4_PLC_Current_A',
        'U4_PLC_Current_B',
        'U4_PLC_Current_C',
        'U4_PLC_PowerFactor_A',
        'U4_PLC_PowerFactor_B',
        'U4_PLC_PowerFactor_C',
        'U4_PLC_ActivePower_Total',
        'U4_PLC_ReactivePower_Total',
        'U4_PLC_ApparentPower_Total',
        'U4_PLC_Del_ActiveEnergy',
        'U4_PLC_Rec_Active_Energy',
        'U4_PLC_Harmonics_V1_THD',
        'U4_PLC_Harmonics_V2_THD',
        'U4_PLC_Harmonics_V3_THD',
        'U4_PLC_Harmonics_I1_THD',
        'U4_PLC_Harmonics_I2_THD',
        'U4_PLC_Harmonics_I3_THD',
        'U4_PLC_Voltage_AN',
        'U4_PLC_Voltage_BN',
        'U4_PLC_Voltage_CN',
        'U4_PLC_Voltage_LN_Avg',
        'U4_PLC_Voltage_Avg',
        'U4_PLC_Current_Avg',
        'U4_PLC_PowerFactor_Avg',
        'U4_PLC_Power_Phase_A',
        'U4_PLC_Power_Phase_B',
        'U4_PLC_Power_Phase_C',
      ],
      //U5_PLC
      'Unit_4.LT1.Power House (2nd Source Gas)': [
        'U5_PLC_Voltage_AB',
        'U5_PLC_Voltage_BC',
        'U5_PLC_Voltage_CA',
        'U5_PLC_Current_A',
        'U5_PLC_Current_B',
        'U5_PLC_Current_C',
        'U5_PLC_PowerFactor_A',
        'U5_PLC_PowerFactor_B',
        'U5_PLC_PowerFactor_C',
        'U5_PLC_ActivePower_Total',
        'U5_PLC_ReactivePower_Total',
        'U5_PLC_ApparentPower_Total',
        'U5_PLC_Del_ActiveEnergy',
        'U5_PLC_Rec_Active_Energy',
        'U5_PLC_Harmonics_V1_THD',
        'U5_PLC_Harmonics_V2_THD',
        'U5_PLC_Harmonics_V3_THD',
        'U5_PLC_Harmonics_I1_THD',
        'U5_PLC_Harmonics_I2_THD',
        'U5_PLC_Harmonics_I3_THD',
        'U5_PLC_Voltage_AN',
        'U5_PLC_Voltage_BN',
        'U5_PLC_Voltage_CN',
        'U5_PLC_Voltage_LN_Avg',
        'U5_PLC_Voltage_Avg',
        'U5_PLC_Current_Avg',
        'U5_PLC_PowerFactor_Avg',
        'U5_PLC_Power_Phase_A',
        'U5_PLC_Power_Phase_B',
        'U5_PLC_Power_Phase_C',
      ],
      //U6_PLC
      'Unit_4.LT1.Turbine': [
        'U6_PLC_Voltage_AB',
        'U6_PLC_Voltage_BC',
        'U6_PLC_Voltage_CA',
        'U6_PLC_Current_A',
        'U6_PLC_Current_B',
        'U6_PLC_Current_C',
        'U6_PLC_PowerFactor_A',
        'U6_PLC_PowerFactor_B',
        'U6_PLC_PowerFactor_C',
        'U6_PLC_ActivePower_Total',
        'U6_PLC_ReactivePower_Total',
        'U6_PLC_ApparentPower_Total',
        'U6_PLC_Del_ActiveEnergy',
        'U6_PLC_Rec_Active_Energy',
        'U6_PLC_Harmonics_V1_THD',
        'U6_PLC_Harmonics_V2_THD',
        'U6_PLC_Harmonics_V3_THD',
        'U6_PLC_Harmonics_I1_THD',
        'U6_PLC_Harmonics_I2_THD',
        'U6_PLC_Harmonics_I3_THD',
        'U6_PLC_Voltage_AN',
        'U6_PLC_Voltage_BN',
        'U6_PLC_Voltage_CN',
        'U6_PLC_Voltage_LN_Avg',
        'U6_PLC_Voltage_Avg',
        'U6_PLC_Current_Avg',
        'U6_PLC_PowerFactor_Avg',
        'U6_PLC_Power_Phase_A',
        'U6_PLC_Power_Phase_B',
        'U6_PLC_Power_Phase_C',
      ],
      //U7_PLC
      'Unit_4.LT1.Main Meter': [
        'U7_PLC_Voltage_AB',
        'U7_PLC_Voltage_BC',
        'U7_PLC_Voltage_CA',
        'U7_PLC_Current_A',
        'U7_PLC_Current_B',
        'U7_PLC_Current_C',
        'U7_PLC_PowerFactor_A',
        'U7_PLC_PowerFactor_B',
        'U7_PLC_PowerFactor_C',
        'U7_PLC_ActivePower_Total',
        'U7_PLC_ReactivePower_Total',
        'U7_PLC_ApparentPower_Total',
        'U7_PLC_Del_ActiveEnergy',
        'U7_PLC_Rec_Active_Energy',
        'U7_PLC_Harmonics_V1_THD',
        'U7_PLC_Harmonics_V2_THD',
        'U7_PLC_Harmonics_V3_THD',
        'U7_PLC_Harmonics_I1_THD',
        'U7_PLC_Harmonics_I2_THD',
        'U7_PLC_Harmonics_I3_THD',
        'U7_PLC_Voltage_AN',
        'U7_PLC_Voltage_BN',
        'U7_PLC_Voltage_CN',
        'U7_PLC_Voltage_LN_Avg',
        'U7_PLC_Voltage_Avg',
        'U7_PLC_Current_Avg',
        'U7_PLC_PowerFactor_Avg',
        'U7_PLC_Power_Phase_A',
        'U7_PLC_Power_Phase_B',
        'U7_PLC_Power_Phase_C',
      ],
      //U8_PLC
      'Unit_4.LT1.Drawing Finisher 1~6+2 Breaker': [
        'U1_PLC_Voltage_AB',
        'U8_PLC_Voltage_BC',
        'U8_PLC_Voltage_CA',
        'U8_PLC_Current_A',
        'U8_PLC_Current_B',
        'U8_PLC_Current_C',
        'U8_PLC_PowerFactor_A',
        'U8_PLC_PowerFactor_B',
        'U8_PLC_PowerFactor_C',
        'U8_PLC_ActivePower_Total',
        'U8_PLC_ReactivePower_Total',
        'U8_PLC_ApparentPower_Total',
        'U8_PLC_Del_ActiveEnergy',
        'U8_PLC_Rec_Active_Energy',
        'U8_PLC_Harmonics_V1_THD',
        'U8_PLC_Harmonics_V2_THD',
        'U8_PLC_Harmonics_V3_THD',
        'U8_PLC_Harmonics_I1_THD',
        'U8_PLC_Harmonics_I2_THD',
        'U8_PLC_Harmonics_I3_THD',
        'U8_PLC_Voltage_AN',
        'U8_PLC_Voltage_BN',
        'U8_PLC_Voltage_CN',
        'U8_PLC_Voltage_LN_Avg',
        'U8_PLC_Voltage_Avg',
        'U8_PLC_Current_Avg',
        'U8_PLC_PowerFactor_Avg',
        'U8_PLC_Power_Phase_A',
        'U8_PLC_Power_Phase_B',
        'U8_PLC_Power_Phase_C',
      ],
      //U9_PLC
      'Unit_4.LT1.Winding 7~9': [
        'U9_PLC_Voltage_AB',
        'U9_PLC_Voltage_BC',
        'U9_PLC_Voltage_CA',
        'U9_PLC_Current_A',
        'U9_PLC_Current_B',
        'U9_PLC_Current_C',
        'U9_PLC_PowerFactor_A',
        'U9_PLC_PowerFactor_B',
        'U9_PLC_PowerFactor_C',
        'U9_PLC_ActivePower_Total',
        'U9_PLC_ReactivePower_Total',
        'U9_PLC_ApparentPower_Total',
        'U9_PLC_Del_ActiveEnergy',
        'U9_PLC_Rec_Active_Energy',
        'U9_PLC_Harmonics_V1_THD',
        'U9_PLC_Harmonics_V2_THD',
        'U9_PLC_Harmonics_V3_THD',
        'U9_PLC_Harmonics_I1_THD',
        'U9_PLC_Harmonics_I2_THD',
        'U9_PLC_Harmonics_I3_THD',
        'U9_PLC_Voltage_AN',
        'U9_PLC_Voltage_BN',
        'U9_PLC_Voltage_CN',
        'U9_PLC_Voltage_LN_Avg',
        'U9_PLC_Voltage_Avg',
        'U9_PLC_Current_Avg',
        'U9_PLC_PowerFactor_Avg',
        'U9_PLC_Power_Phase_A',
        'U9_PLC_Power_Phase_B',
        'U9_PLC_Power_Phase_C',
      ],
      //U10_PLC
      'Unit_4.LT1.Ring 1~4': [
        'U10_PLC_Voltage_AB',
        'U10_PLC_Voltage_BC',
        'U10_PLC_Voltage_CA',
        'U10_PLC_Current_A',
        'U10_PLC_Current_B',
        'U10_PLC_Current_C',
        'U10_PLC_PowerFactor_A',
        'U10_PLC_PowerFactor_B',
        'U10_PLC_PowerFactor_C',
        'U10_PLC_ActivePower_Total',
        'U10_PLC_ReactivePower_Total',
        'U10_PLC_ApparentPower_Total',
        'U10_PLC_Del_ActiveEnergy',
        'U10_PLC_Rec_Active_Energy',
        'U10_PLC_Harmonics_V1_THD',
        'U10_PLC_Harmonics_V2_THD',
        'U10_PLC_Harmonics_V3_THD',
        'U10_PLC_Harmonics_I1_THD',
        'U10_PLC_Harmonics_I2_THD',
        'U10_PLC_Harmonics_I3_THD',
        'U10_PLC_Voltage_AN',
        'U10_PLC_Voltage_BN',
        'U10_PLC_Voltage_CN',
        'U10_PLC_Voltage_LN_Avg',
        'U10_PLC_Voltage_Avg',
        'U10_PLC_Current_Avg',
        'U10_PLC_PowerFactor_Avg',
        'U10_PLC_Power_Phase_A',
        'U10_PLC_Power_Phase_B',
        'U10_PLC_Power_Phase_C',
      ],
      //U11_PLC
      'Unit_4.LT1.Ring 16~20': [
        'U11_PLC_Voltage_AB',
        'U11_PLC_Voltage_BC',
        'U11_PLC_Voltage_CA',
        'U11_PLC_Current_A',
        'U11_PLC_Current_B',
        'U11_PLC_Current_C',
        'U11_PLC_PowerFactor_A',
        'U11_PLC_PowerFactor_B',
        'U11_PLC_PowerFactor_C',
        'U11_PLC_ActivePower_Total',
        'U11_PLC_ReactivePower_Total',
        'U11_PLC_ApparentPower_Total',
        'U11_PLC_Del_ActiveEnergy',
        'U11_PLC_Rec_Active_Energy',
        'U11_PLC_Harmonics_V1_THD',
        'U11_PLC_Harmonics_V2_THD',
        'U11_PLC_Harmonics_V3_THD',
        'U11_PLC_Harmonics_I1_THD',
        'U11_PLC_Harmonics_I2_THD',
        'U11_PLC_Harmonics_I3_THD',
        'U11_PLC_Voltage_AN',
        'U11_PLC_Voltage_BN',
        'U11_PLC_Voltage_CN',
        'U11_PLC_Voltage_LN_Avg',
        'U11_PLC_Voltage_Avg',
        'U11_PLC_Current_Avg',
        'U11_PLC_PowerFactor_Avg',
        'U11_PLC_Power_Phase_A',
        'U11_PLC_Power_Phase_B',
        'U11_PLC_Power_Phase_C',
      ],
      //U12_PLC
      'Unit_4.LT1.Ring 21~24': [
        'U12_PLC_Voltage_AB',
        'U12_PLC_Voltage_BC',
        'U12_PLC_Voltage_CA',
        'U12_PLC_Current_A',
        'U12_PLC_Current_B',
        'U12_PLC_Current_C',
        'U12_PLC_PowerFactor_A',
        'U12_PLC_PowerFactor_B',
        'U12_PLC_PowerFactor_C',
        'U12_PLC_ActivePower_Total',
        'U12_PLC_ReactivePower_Total',
        'U12_PLC_ApparentPower_Total',
        'U12_PLC_Del_ActiveEnergy',
        'U12_PLC_Rec_Active_Energy',
        'U12_PLC_Harmonics_V1_THD',
        'U12_PLC_Harmonics_V2_THD',
        'U12_PLC_Harmonics_V3_THD',
        'U12_PLC_Harmonics_I1_THD',
        'U12_PLC_Harmonics_I2_THD',
        'U12_PLC_Harmonics_I3_THD',
        'U12_PLC_Voltage_AN',
        'U12_PLC_Voltage_BN',
        'U12_PLC_Voltage_CN',
        'U12_PLC_Voltage_LN_Avg',
        'U12_PLC_Voltage_Avg',
        'U12_PLC_Current_Avg',
        'U12_PLC_PowerFactor_Avg',
        'U12_PLC_Power_Phase_A',
        'U12_PLC_Power_Phase_B',
        'U12_PLC_Power_Phase_C',
      ],
      //U13_PLC
      'Unit_4.LT1.Comber 1-10 + Uni-Lap 1-2': [
        'U13_PLC_Voltage_AB',
        'U13_PLC_Voltage_BC',
        'U13_PLC_Voltage_CA',
        'U13_PLC_Current_A',
        'U13_PLC_Current_B',
        'U13_PLC_Current_C',
        'U13_PLC_PowerFactor_A',
        'U13_PLC_PowerFactor_B',
        'U13_PLC_PowerFactor_C',
        'U13_PLC_ActivePower_Total',
        'U13_PLC_ReactivePower_Total',
        'U13_PLC_ApparentPower_Total',
        'U13_PLC_Del_ActiveEnergy',
        'U13_PLC_Rec_Active_Energy',
        'U13_PLC_Harmonics_V1_THD',
        'U13_PLC_Harmonics_V2_THD',
        'U13_PLC_Harmonics_V3_THD',
        'U13_PLC_Harmonics_I1_THD',
        'U13_PLC_Harmonics_I2_THD',
        'U13_PLC_Harmonics_I3_THD',
        'U13_PLC_Voltage_AN',
        'U13_PLC_Voltage_BN',
        'U13_PLC_Voltage_CN',
        'U13_PLC_Voltage_LN_Avg',
        'U13_PLC_Voltage_Avg',
        'U13_PLC_Current_Avg',
        'U13_PLC_PowerFactor_Avg',
        'U13_PLC_Power_Phase_A',
        'U13_PLC_Power_Phase_B',
        'U13_PLC_Power_Phase_C',
      ],
      //U14_PLC
      'Unit_4.LT1.Compressor (119kw)': [
        'U14_PLC_Voltage_AB',
        'U14_PLC_Voltage_BC',
        'U14_PLC_Voltage_CA',
        'U14_PLC_Current_A',
        'U14_PLC_Current_B',
        'U14_PLC_Current_C',
        'U14_PLC_PowerFactor_A',
        'U14_PLC_PowerFactor_B',
        'U14_PLC_PowerFactor_C',
        'U14_PLC_ActivePower_Total',
        'U14_PLC_ReactivePower_Total',
        'U14_PLC_ApparentPower_Total',
        'U14_PLC_Del_ActiveEnergy',
        'U14_PLC_Rec_Active_Energy',
        'U14_PLC_Harmonics_V1_THD',
        'U14_PLC_Harmonics_V2_THD',
        'U14_PLC_Harmonics_V3_THD',
        'U14_PLC_Harmonics_I1_THD',
        'U14_PLC_Harmonics_I2_THD',
        'U14_PLC_Harmonics_I3_THD',
        'U14_PLC_Voltage_AN',
        'U14_PLC_Voltage_BN',
        'U14_PLC_Voltage_CN',
        'U14_PLC_Voltage_LN_Avg',
        'U14_PLC_Voltage_Avg',
        'U14_PLC_Current_Avg',
        'U14_PLC_PowerFactor_Avg',
        'U14_PLC_Power_Phase_A',
        'U14_PLC_Power_Phase_B',
        'U14_PLC_Power_Phase_C',
      ],
      //U15_PLC
      'Unit_4.LT1.Simplex 1~6': [
        'U15_PLC_Voltage_AB',
        'U15_PLC_Voltage_BC',
        'U15_PLC_Voltage_CA',
        'U15_PLC_Current_A',
        'U15_PLC_Current_B',
        'U15_PLC_Current_C',
        'U15_PLC_PowerFactor_A',
        'U15_PLC_PowerFactor_B',
        'U15_PLC_PowerFactor_C',
        'U15_PLC_ActivePower_Total',
        'U15_PLC_ReactivePower_Total',
        'U15_PLC_ApparentPower_Total',
        'U15_PLC_Del_ActiveEnergy',
        'U15_PLC_Rec_Active_Energy',
        'U15_PLC_Harmonics_V1_THD',
        'U15_PLC_Harmonics_V2_THD',
        'U15_PLC_Harmonics_V3_THD',
        'U15_PLC_Harmonics_I1_THD',
        'U15_PLC_Harmonics_I2_THD',
        'U15_PLC_Harmonics_I3_THD',
        'U15_PLC_Voltage_AN',
        'U15_PLC_Voltage_BN',
        'U15_PLC_Voltage_CN',
        'U15_PLC_Voltage_LN_Avg',
        'U15_PLC_Voltage_Avg',
        'U15_PLC_Current_Avg',
        'U15_PLC_PowerFactor_Avg',
        'U15_PLC_Power_Phase_A',
        'U15_PLC_Power_Phase_B',
        'U15_PLC_Power_Phase_C',
      ],
      //U16_PLC
      'Unit_4.LT1.Compressor (303kw)': [
        'U16_PLC_Voltage_AB',
        'U16_PLC_Voltage_BC',
        'U16_PLC_Voltage_CA',
        'U16_PLC_Current_A',
        'U16_PLC_Current_B',
        'U16_PLC_Current_C',
        'U16_PLC_PowerFactor_A',
        'U16_PLC_PowerFactor_B',
        'U16_PLC_PowerFactor_C',
        'U16_PLC_ActivePower_Total',
        'U16_PLC_ReactivePower_Total',
        'U16_PLC_ApparentPower_Total',
        'U16_PLC_Del_ActiveEnergy',
        'U16_PLC_Rec_Active_Energy',
        'U16_PLC_Harmonics_V1_THD',
        'U16_PLC_Harmonics_V2_THD',
        'U16_PLC_Harmonics_V3_THD',
        'U16_PLC_Harmonics_I1_THD',
        'U16_PLC_Harmonics_I2_THD',
        'U16_PLC_Harmonics_I3_THD',
        'U16_PLC_Voltage_AN',
        'U16_PLC_Voltage_BN',
        'U16_PLC_Voltage_CN',
        'U16_PLC_Voltage_LN_Avg',
        'U16_PLC_Voltage_Avg',
        'U16_PLC_Current_Avg',
        'U16_PLC_PowerFactor_Avg',
        'U16_PLC_Power_Phase_A',
        'U16_PLC_Power_Phase_B',
        'U16_PLC_Power_Phase_C',
      ],
      //U17_PLC
      'Unit_4.LT1.Ring AC': [
        'U17_PLC_Voltage_AB',
        'U17_PLC_Voltage_BC',
        'U17_PLC_Voltage_CA',
        'U17_PLC_Current_A',
        'U17_PLC_Current_B',
        'U17_PLC_Current_C',
        'U17_PLC_PowerFactor_A',
        'U17_PLC_PowerFactor_B',
        'U17_PLC_PowerFactor_C',
        'U17_PLC_ActivePower_Total',
        'U17_PLC_ReactivePower_Total',
        'U17_PLC_ApparentPower_Total',
        'U17_PLC_Del_ActiveEnergy',
        'U17_PLC_Rec_Active_Energy',
        'U17_PLC_Harmonics_V1_THD',
        'U17_PLC_Harmonics_V2_THD',
        'U17_PLC_Harmonics_V3_THD',
        'U17_PLC_Harmonics_I1_THD',
        'U17_PLC_Harmonics_I2_THD',
        'U17_PLC_Harmonics_I3_THD',
        'U17_PLC_Voltage_AN',
        'U17_PLC_Voltage_BN',
        'U17_PLC_Voltage_CN',
        'U17_PLC_Voltage_LN_Avg',
        'U17_PLC_Voltage_Avg',
        'U17_PLC_Current_Avg',
        'U17_PLC_PowerFactor_Avg',
        'U17_PLC_Power_Phase_A',
        'U17_PLC_Power_Phase_B',
        'U17_PLC_Power_Phase_C',
      ],
       //U18_PLC
      'Unit_4.LT1.Ring AC (Bypass)': [
        'U18_PLC_Voltage_AB',
        'U18_PLC_Voltage_BC',
        'U18_PLC_Voltage_CA',
        'U18_PLC_Current_A',
        'U18_PLC_Current_B',
        'U18_PLC_Current_C',
        'U18_PLC_PowerFactor_A',
        'U18_PLC_PowerFactor_B',
        'U18_PLC_PowerFactor_C',
        'U18_PLC_ActivePower_Total',
        'U18_PLC_ReactivePower_Total',
        'U18_PLC_ApparentPower_Total',
        'U18_PLC_Del_ActiveEnergy',
        'U18_PLC_Rec_Active_Energy',
        'U18_PLC_Harmonics_V1_THD',
        'U18_PLC_Harmonics_V2_THD',
        'U18_PLC_Harmonics_V3_THD',
        'U18_PLC_Harmonics_I1_THD',
        'U18_PLC_Harmonics_I2_THD',
        'U18_PLC_Harmonics_I3_THD',
        'U18_PLC_Voltage_AN',
        'U18_PLC_Voltage_BN',
        'U18_PLC_Voltage_CN',
        'U18_PLC_Voltage_LN_Avg',
        'U18_PLC_Voltage_Avg',
        'U18_PLC_Current_Avg',
        'U18_PLC_PowerFactor_Avg',
        'U18_PLC_Power_Phase_A',
        'U18_PLC_Power_Phase_B',
        'U18_PLC_Power_Phase_C',
      ],
      //U19_PLC
      'Unit_4.LT1.Diesel + JGS Incoming': [
        'U19_PLC_Voltage_AB',
        'U19_PLC_Voltage_BC',
        'U19_PLC_Voltage_CA',
        'U19_PLC_Current_A',
        'U19_PLC_Current_B',
        'U19_PLC_Current_C',
        'U19_PLC_PowerFactor_A',
        'U19_PLC_PowerFactor_B',
        'U19_PLC_PowerFactor_C',
        'U19_PLC_ActivePower_Total',
        'U19_PLC_ReactivePower_Total',
        'U19_PLC_ApparentPower_Total',
        'U19_PLC_Del_ActiveEnergy',
        'U19_PLC_Rec_Active_Energy',
        'U19_PLC_Harmonics_V1_THD',
        'U19_PLC_Harmonics_V2_THD',
        'U19_PLC_Harmonics_V3_THD',
        'U19_PLC_Harmonics_I1_THD',
        'U19_PLC_Harmonics_I2_THD',
        'U19_PLC_Harmonics_I3_THD',
        'U19_PLC_Voltage_AN',
        'U19_PLC_Voltage_BN',
        'U19_PLC_Voltage_CN',
        'U19_PLC_Voltage_LN_Avg',
        'U19_PLC_Voltage_Avg',
        'U19_PLC_Current_Avg',
        'U19_PLC_PowerFactor_Avg',
        'U19_PLC_Power_Phase_A',
        'U19_PLC_Power_Phase_B',
        'U19_PLC_Power_Phase_C',
      ],
      //U20_PLC
      'Unit_4.LT1.Compressor 119kw': [
        'U20_PLC_Voltage_AB',
        'U20_PLC_Voltage_BC',
        'U20_PLC_Voltage_CA',
        'U20_PLC_Current_A',
        'U20_PLC_Current_B',
        'U20_PLC_Current_C',
        'U20_PLC_PowerFactor_A',
        'U20_PLC_PowerFactor_B',
        'U20_PLC_PowerFactor_C',
        'U20_PLC_ActivePower_Total',
        'U20_PLC_ReactivePower_Total',
        'U20_PLC_ApparentPower_Total',
        'U20_PLC_Del_ActiveEnergy',
        'U20_PLC_Rec_Active_Energy',
        'U20_PLC_Harmonics_V1_THD',
        'U20_PLC_Harmonics_V2_THD',
        'U20_PLC_Harmonics_V3_THD',
        'U20_PLC_Harmonics_I1_THD',
        'U20_PLC_Harmonics_I2_THD',
        'U20_PLC_Harmonics_I3_THD',
        'U20_PLC_Voltage_AN',
        'U20_PLC_Voltage_BN',
        'U20_PLC_Voltage_CN',
        'U20_PLC_Voltage_LN_Avg',
        'U20_PLC_Voltage_Avg',
        'U20_PLC_Current_Avg',
        'U20_PLC_PowerFactor_Avg',
        'U20_PLC_Power_Phase_A',
        'U20_PLC_Power_Phase_B',
        'U20_PLC_Power_Phase_C',
      ],
      //U21_PLC
      'Unit_4.LT1.Wapda + HFO + JMS Incoming': [
        'U21_PLC_Voltage_AB',
        'U21_PLC_Voltage_BC',
        'U21_PLC_Voltage_CA',
        'U21_PLC_Current_A',
        'U21_PLC_Current_B',
        'U21_PLC_Current_C',
        'U21_PLC_PowerFactor_A',
        'U21_PLC_PowerFactor_B',
        'U21_PLC_PowerFactor_C',
        'U21_PLC_ActivePower_Total',
        'U21_PLC_ReactivePower_Total',
        'U21_PLC_ApparentPower_Total',
        'U21_PLC_Del_ActiveEnergy',
        'U21_PLC_Rec_Active_Energy',
        'U21_PLC_Harmonics_V1_THD',
        'U21_PLC_Harmonics_V2_THD',
        'U21_PLC_Harmonics_V3_THD',
        'U21_PLC_Harmonics_I1_THD',
        'U21_PLC_Harmonics_I2_THD',
        'U21_PLC_Harmonics_I3_THD',
        'U21_PLC_Voltage_AN',
        'U21_PLC_Voltage_BN',
        'U21_PLC_Voltage_CN',
        'U21_PLC_Voltage_LN_Avg',
        'U21_PLC_Voltage_Avg',
        'U21_PLC_Current_Avg',
        'U21_PLC_PowerFactor_Avg',
        'U21_PLC_Power_Phase_A',
        'U21_PLC_Power_Phase_B',
        'U21_PLC_Power_Phase_C',
      ],
      'Unit_4.LT2': [
        'Solar 352.50 kW',
        'Solar 52.17 kW',
        'A/C Back Process',
        'Weikel Cond',
        'Winding AC',
        'Mills RES-CLNY& Workshop',
        'Card (1-4) (9-12)',
        'Colony',
        'Diesel + JGS Incoming',
        'Blow Room',
        'Card (5-8) (13-14)',
        'Winding 1-6',
        'Power House 2nd Source (HFO)',
        'Card Filter (Bypass)',
        'Wapda + HFO + JMS Incoming',
        'B/R Card Filter',
        'Ring 5-8',
        'Ring 13-16',
        'Ring 9-12',
        'Bale Press',
        'AC Lab',
        'Spare',
        'Spare 2',
      ],
      'Unit_4.LT2.Solar 352.50 kW': [
        'U24_GW01_Voltage_AB',
        'U24_GW01_Voltage_BC',
        'U24_GW01_Voltage_CA',
        'U24_GW01_Current_A',
        'U24_GW01_Current_B',
        'U24_GW01_Current_C',
        'U24_GW01_PowerFactor_A',
        'U24_GW01_PowerFactor_B',
        'U24_GW01_PowerFactor_C',
        'U24_GW01_ActivePower_Total',
        'U24_GW01_ReactivePower_Total',
        'U24_GW01_ApparentPower_Total',
        'U24_GW01_Del_ActiveEnergy',
        'U24_GW01_Rec_Active_Energy',
        'U24_GW01_Harmonics_V1_THD',
        'U24_GW01_Harmonics_V2_THD',
        'U24_GW01_Harmonics_V3_THD',
        'U24_GW01_Harmonics_I1_THD',
        'U24_GW01_Harmonics_I2_THD',
        'U24_GW01_Harmonics_I3_THD',
        'U24_GW01_Voltage_AN',
        'U24_GW01_Voltage_BN',
        'U24_GW01_Voltage_CN',
        'U24_GW01_Voltage_LN_Avg',
        'U24_GW01_Voltage_Avg',
        'U24_GW01_Current_Avg',
        'U24_GW01_PowerFactor_Avg',
        'U24_GW01_Power_Phase_A',
        'U24_GW01_Power_Phase_B',
        'U24_GW01_Power_Phase_C',
      ],
      'Unit_4.LT2.Solar 52.17 kW': [
        'U28_PLC_Voltage_AB',
        'U28_PLC_Voltage_BC',
        'U28_PLC_Voltage_CA',
        'U28_PLC_Current_A',
        'U28_PLC_Current_B',
        'U28_PLC_Current_C',
        'U28_PLC_PowerFactor_A',
        'U28_PLC_PowerFactor_B',
        'U28_PLC_PowerFactor_C',
        'U28_PLC_ActivePower_Total',
        'U28_PLC_ReactivePower_Total',
        'U28_PLC_ApparentPower_Total',
        'U28_PLC_Del_ActiveEnergy',
        'U28_PLC_Rec_Active_Energy',
        'U28_PLC_Harmonics_V1_THD',
        'U28_PLC_Harmonics_V2_THD',
        'U28_PLC_Harmonics_V3_THD',
        'U28_PLC_Harmonics_I1_THD',
        'U28_PLC_Harmonics_I2_THD',
        'U28_PLC_Harmonics_I3_THD',
        'U28_PLC_Voltage_AN',
        'U28_PLC_Voltage_BN',
        'U28_PLC_Voltage_CN',
        'U28_PLC_Voltage_LN_Avg',
        'U28_PLC_Voltage_Avg',
        'U28_PLC_Current_Avg',
        'U28_PLC_PowerFactor_Avg',
        'U28_PLC_Power_Phase_A',
        'U28_PLC_Power_Phase_B',
        'U28_PLC_Power_Phase_C',
      ],
      //U1_GW01
      'Unit_4.LT2.A/C Back Process': [
        'U1_GW01_Voltage_AB',
        'U1_GW01_Voltage_BC',
        'U1_GW01_Voltage_CA',
        'U1_GW01_Current_A',
        'U1_GW01_Current_B',
        'U1_GW01_Current_C',
        'U1_GW01_PowerFactor_A',
        'U1_GW01_PowerFactor_B',
        'U1_GW01_PowerFactor_C',
        'U1_GW01_ActivePower_Total',
        'U1_GW01_ReactivePower_Total',
        'U1_GW01_ApparentPower_Total',
        'U1_GW01_Del_ActiveEnergy',
        'U1_GW01_Rec_Active_Energy',
        'U1_GW01_Harmonics_V1_THD',
        'U1_GW01_Harmonics_V2_THD',
        'U1_GW01_Harmonics_V3_THD',
        'U1_GW01_Harmonics_I1_THD',
        'U1_GW01_Harmonics_I2_THD',
        'U1_GW01_Harmonics_I3_THD',
        'U1_GW01_Voltage_AN',
        'U1_GW01_Voltage_BN',
        'U1_GW01_Voltage_CN',
        'U1_GW01_Voltage_LN_Avg',
        'U1_GW01_Voltage_Avg',
        'U1_GW01_Current_Avg',
        'U1_GW01_PowerFactor_Avg',
        'U1_GW01_Power_Phase_A',
        'U1_GW01_Power_Phase_B',
        'U1_GW01_Power_Phase_C',
      ],
      //U2_GW01
      'Unit_4.LT2.Weikel Cond': [
        'U2_GW01_Voltage_AB',
        'U2_GW01_Voltage_BC',
        'U2_GW01_Voltage_CA',
        'U2_GW01_Current_A',
        'U2_GW01_Current_B',
        'U2_GW01_Current_C',
        'U2_GW01_PowerFactor_A',
        'U2_GW01_PowerFactor_B',
        'U2_GW01_PowerFactor_C',
        'U2_GW01_ActivePower_Total',
        'U2_GW01_ReactivePower_Total',
        'U2_GW01_ApparentPower_Total',
        'U2_GW01_Del_ActiveEnergy',
        'U2_GW01_Rec_Active_Energy',
        'U2_GW01_Harmonics_V1_THD',
        'U2_GW01_Harmonics_V2_THD',
        'U2_GW01_Harmonics_V3_THD',
        'U2_GW01_Harmonics_I1_THD',
        'U2_GW01_Harmonics_I2_THD',
        'U2_GW01_Harmonics_I3_THD',
        'U2_GW01_Voltage_AN',
        'U2_GW01_Voltage_BN',
        'U2_GW01_Voltage_CN',
        'U2_GW01_Voltage_LN_Avg',
        'U2_GW01_Voltage_Avg',
        'U2_GW01_Current_Avg',
        'U2_GW01_PowerFactor_Avg',
        'U2_GW01_Power_Phase_A',
        'U2_GW01_Power_Phase_B',
        'U2_GW01_Power_Phase_C',
      ],
      //U3_GW01
      'Unit_4.LT2.Winding AC': [
        'U3_GW01_Voltage_AB',
        'U3_GW01_Voltage_BC',
        'U3_GW01_Voltage_CA',
        'U3_GW01_Current_A',
        'U3_GW01_Current_B',
        'U3_GW01_Current_C',
        'U3_GW01_PowerFactor_A',
        'U3_GW01_PowerFactor_B',
        'U3_GW01_PowerFactor_C',
        'U3_GW01_ActivePower_Total',
        'U3_GW01_ReactivePower_Total',
        'U3_GW01_ApparentPower_Total',
        'U3_GW01_Del_ActiveEnergy',
        'U3_GW01_Rec_Active_Energy',
        'U3_GW01_Harmonics_V1_THD',
        'U3_GW01_Harmonics_V2_THD',
        'U3_GW01_Harmonics_V3_THD',
        'U3_GW01_Harmonics_I1_THD',
        'U3_GW01_Harmonics_I2_THD',
        'U3_GW01_Harmonics_I3_THD',
        'U3_GW01_Voltage_AN',
        'U3_GW01_Voltage_BN',
        'U3_GW01_Voltage_CN',
        'U3_GW01_Voltage_LN_Avg',
        'U3_GW01_Voltage_Avg',
        'U3_GW01_Current_Avg',
        'U3_GW01_PowerFactor_Avg',
        'U3_GW01_Power_Phase_A',
        'U3_GW01_Power_Phase_B',
        'U3_GW01_Power_Phase_C',
      ],
      //U4_GW01
      'Unit_4.LT2.Mills RES-CLNY& Workshop': [
        'U4_GW01_Voltage_AB',
        'U4_GW01_Voltage_BC',
        'U4_GW01_Voltage_CA',
        'U4_GW01_Current_A',
        'U4_GW01_Current_B',
        'U4_GW01_Current_C',
        'U4_GW01_PowerFactor_A',
        'U4_GW01_PowerFactor_B',
        'U4_GW01_PowerFactor_C',
        'U4_GW01_ActivePower_Total',
        'U4_GW01_ReactivePower_Total',
        'U4_GW01_ApparentPower_Total',
        'U4_GW01_Del_ActiveEnergy',
        'U4_GW01_Rec_Active_Energy',
        'U4_GW01_Harmonics_V1_THD',
        'U4_GW01_Harmonics_V2_THD',
        'U4_GW01_Harmonics_V3_THD',
        'U4_GW01_Harmonics_I1_THD',
        'U4_GW01_Harmonics_I2_THD',
        'U4_GW01_Harmonics_I3_THD',
        'U4_GW01_Voltage_AN',
        'U4_GW01_Voltage_BN',
        'U4_GW01_Voltage_CN',
        'U4_GW01_Voltage_LN_Avg',
        'U4_GW01_Voltage_Avg',
        'U4_GW01_Current_Avg',
        'U4_GW01_PowerFactor_Avg',
        'U4_GW01_Power_Phase_A',
        'U4_GW01_Power_Phase_B',
        'U4_GW01_Power_Phase_C',
      ],
      //U5_GW01
      'Unit_4.LT2.Card (1-4) (9-12)': [
        'U5_GW01_Voltage_AB',
        'U5_GW01_Voltage_BC',
        'U5_GW01_Voltage_CA',
        'U5_GW01_Current_A',
        'U5_GW01_Current_B',
        'U5_GW01_Current_C',
        'U5_GW01_PowerFactor_A',
        'U5_GW01_PowerFactor_B',
        'U5_GW01_PowerFactor_C',
        'U5_GW01_ActivePower_Total',
        'U5_GW01_ReactivePower_Total',
        'U5_GW01_ApparentPower_Total',
        'U5_GW01_Del_ActiveEnergy',
        'U5_GW01_Rec_Active_Energy',
        'U5_GW01_Harmonics_V1_THD',
        'U5_GW01_Harmonics_V2_THD',
        'U5_GW01_Harmonics_V3_THD',
        'U5_GW01_Harmonics_I1_THD',
        'U5_GW01_Harmonics_I2_THD',
        'U5_GW01_Harmonics_I3_THD',
        'U5_GW01_Voltage_AN',
        'U5_GW01_Voltage_BN',
        'U5_GW01_Voltage_CN',
        'U5_GW01_Voltage_LN_Avg',
        'U5_GW01_Voltage_Avg',
        'U5_GW01_Current_Avg',
        'U5_GW01_PowerFactor_Avg',
        'U5_GW01_Power_Phase_A',
        'U5_GW01_Power_Phase_B',
        'U5_GW01_Power_Phase_C',
      ],
      //U6_GW01 => 18
      'Unit_4.LT2.Colony': [
        'U18_GW01_Voltage_AB',
        'U18_GW01_Voltage_BC',
        'U18_GW01_Voltage_CA',
        'U18_GW01_Current_A',
        'U18_GW01_Current_B',
        'U18_GW01_Current_C',
        'U18_GW01_PowerFactor_A',
        'U18_GW01_PowerFactor_B',
        'U18_GW01_PowerFactor_C',
        'U18_GW01_ActivePower_Total',
        'U18_GW01_ReactivePower_Total',
        'U18_GW01_ApparentPower_Total',
        'U18_GW01_Del_ActiveEnergy',
        'U18_GW01_Rec_Active_Energy',
        'U18_GW01_Harmonics_V1_THD',
        'U18_GW01_Harmonics_V2_THD',
        'U18_GW01_Harmonics_V3_THD',
        'U18_GW01_Harmonics_I1_THD',
        'U18_GW01_Harmonics_I2_THD',
        'U18_GW01_Harmonics_I3_THD',
        'U18_GW01_Voltage_AN',
        'U18_GW01_Voltage_BN',
        'U18_GW01_Voltage_CN',
        'U18_GW01_Voltage_LN_Avg',
        'U18_GW01_Voltage_Avg',
        'U18_GW01_Current_Avg',
        'U18_GW01_PowerFactor_Avg',
        'U18_GW01_Power_Phase_A',
        'U18_GW01_Power_Phase_B',
        'U18_GW01_Power_Phase_C',
      ],
      //U7_GW01
      'Unit_4.LT2.Diesel + JGS Incoming': [
        'U7_GW01_Voltage_AB',
        'U7_GW01_Voltage_BC',
        'U7_GW01_Voltage_CA',
        'U7_GW01_Current_A',
        'U7_GW01_Current_B',
        'U7_GW01_Current_C',
        'U7_GW01_PowerFactor_A',
        'U7_GW01_PowerFactor_B',
        'U7_GW01_PowerFactor_C',
        'U7_GW01_ActivePower_Total',
        'U7_GW01_ReactivePower_Total',
        'U7_GW01_ApparentPower_Total',
        'U7_GW01_Del_ActiveEnergy',
        'U7_GW01_Rec_Active_Energy',
        'U7_GW01_Harmonics_V1_THD',
        'U7_GW01_Harmonics_V2_THD',
        'U7_GW01_Harmonics_V3_THD',
        'U7_GW01_Harmonics_I1_THD',
        'U7_GW01_Harmonics_I2_THD',
        'U7_GW01_Harmonics_I3_THD',
        'U7_GW01_Voltage_AN',
        'U7_GW01_Voltage_BN',
        'U7_GW01_Voltage_CN',
        'U7_GW01_Voltage_LN_Avg',
        'U7_GW01_Voltage_Avg',
        'U7_GW01_Current_Avg',
        'U7_GW01_PowerFactor_Avg',
        'U7_GW01_Power_Phase_A',
        'U7_GW01_Power_Phase_B',
        'U7_GW01_Power_Phase_C',
      ],
      //U8_GW01
      'Unit_4.LT2.Blow Room': [
        'U8_GW01_Voltage_AB',
        'U8_GW01_Voltage_BC',
        'U8_GW01_Voltage_CA',
        'U8_GW01_Current_A',
        'U8_GW01_Current_B',
        'U8_GW01_Current_C',
        'U8_GW01_PowerFactor_A',
        'U8_GW01_PowerFactor_B',
        'U8_GW01_PowerFactor_C',
        'U8_GW01_ActivePower_Total',
        'U8_GW01_ReactivePower_Total',
        'U8_GW01_ApparentPower_Total',
        'U8_GW01_Del_ActiveEnergy',
        'U8_GW01_Rec_Active_Energy',
        'U8_GW01_Harmonics_V1_THD',
        'U8_GW01_Harmonics_V2_THD',
        'U8_GW01_Harmonics_V3_THD',
        'U8_GW01_Harmonics_I1_THD',
        'U8_GW01_Harmonics_I2_THD',
        'U8_GW01_Harmonics_I3_THD',
        'U8_GW01_Voltage_AN',
        'U8_GW01_Voltage_BN',
        'U8_GW01_Voltage_CN',
        'U8_GW01_Voltage_LN_Avg',
        'U8_GW01_Voltage_Avg',
        'U8_GW01_Current_Avg',
        'U8_GW01_PowerFactor_Avg',
        'U8_GW01_Power_Phase_A',
        'U8_GW01_Power_Phase_B',
        'U8_GW01_Power_Phase_C',
      ],
      //U9_GW01
      'Unit_4.LT2.Card (5-8) (13-14)': [
        'U9_GW01_Voltage_AB',
        'U9_GW01_Voltage_BC',
        'U9_GW01_Voltage_CA',
        'U9_GW01_Current_A',
        'U9_GW01_Current_B',
        'U9_GW01_Current_C',
        'U9_GW01_PowerFactor_A',
        'U9_GW01_PowerFactor_B',
        'U9_GW01_PowerFactor_C',
        'U9_GW01_ActivePower_Total',
        'U9_GW01_ReactivePower_Total',
        'U9_GW01_ApparentPower_Total',
        'U9_GW01_Del_ActiveEnergy',
        'U9_GW01_Rec_Active_Energy',
        'U9_GW01_Harmonics_V1_THD',
        'U9_GW01_Harmonics_V2_THD',
        'U9_GW01_Harmonics_V3_THD',
        'U9_GW01_Harmonics_I1_THD',
        'U9_GW01_Harmonics_I2_THD',
        'U9_GW01_Harmonics_I3_THD',
        'U9_GW01_Voltage_AN',
        'U9_GW01_Voltage_BN',
        'U9_GW01_Voltage_CN',
        'U9_GW01_Voltage_LN_Avg',
        'U9_GW01_Voltage_Avg',
        'U9_GW01_Current_Avg',
        'U9_GW01_PowerFactor_Avg',
        'U9_GW01_Power_Phase_A',
        'U9_GW01_Power_Phase_B',
        'U9_GW01_Power_Phase_C',
      ],
      //U10_GW01
      'Unit_4.LT2.Winding 1-6': [
        'U10_GW01_Voltage_AB',
        'U10_GW01_Voltage_BC',
        'U10_GW01_Voltage_CA',
        'U10_GW01_Current_A',
        'U10_GW01_Current_B',
        'U10_GW01_Current_C',
        'U10_GW01_PowerFactor_A',
        'U10_GW01_PowerFactor_B',
        'U10_GW01_PowerFactor_C',
        'U10_GW01_ActivePower_Total',
        'U10_GW01_ReactivePower_Total',
        'U10_GW01_ApparentPower_Total',
        'U10_GW01_Del_ActiveEnergy',
        'U10_GW01_Rec_Active_Energy',
        'U10_GW01_Harmonics_V1_THD',
        'U10_GW01_Harmonics_V2_THD',
        'U10_GW01_Harmonics_V3_THD',
        'U10_GW01_Harmonics_I1_THD',
        'U10_GW01_Harmonics_I2_THD',
        'U10_GW01_Harmonics_I3_THD',
        'U10_GW01_Voltage_AN',
        'U10_GW01_Voltage_BN',
        'U10_GW01_Voltage_CN',
        'U10_GW01_Voltage_LN_Avg',
        'U10_GW01_Voltage_Avg',
        'U10_GW01_Current_Avg',
        'U10_GW01_PowerFactor_Avg',
        'U10_GW01_Power_Phase_A',
        'U10_GW01_Power_Phase_B',
        'U10_GW01_Power_Phase_C',
      ],
      //U11_GW01
      'Unit_4.LT2.Power House 2nd Source (HFO)': [
        'U11_GW01_Voltage_AB',
        'U11_GW01_Voltage_BC',
        'U11_GW01_Voltage_CA',
        'U11_GW01_Current_A',
        'U11_GW01_Current_B',
        'U11_GW01_Current_C',
        'U11_GW01_PowerFactor_A',
        'U11_GW01_PowerFactor_B',
        'U11_GW01_PowerFactor_C',
        'U11_GW01_ActivePower_Total',
        'U11_GW01_ReactivePower_Total',
        'U11_GW01_ApparentPower_Total',
        'U11_GW01_Del_ActiveEnergy',
        'U11_GW01_Rec_Active_Energy',
        'U11_GW01_Harmonics_V1_THD',
        'U11_GW01_Harmonics_V2_THD',
        'U11_GW01_Harmonics_V3_THD',
        'U11_GW01_Harmonics_I1_THD',
        'U11_GW01_Harmonics_I2_THD',
        'U11_GW01_Harmonics_I3_THD',
        'U11_GW01_Voltage_AN',
        'U11_GW01_Voltage_BN',
        'U11_GW01_Voltage_CN',
        'U11_GW01_Voltage_LN_Avg',
        'U11_GW01_Voltage_Avg',
        'U11_GW01_Current_Avg',
        'U11_GW01_PowerFactor_Avg',
        'U11_GW01_Power_Phase_A',
        'U11_GW01_Power_Phase_B',
        'U11_GW01_Power_Phase_C',
      ],
      //U12_GW01
      'Unit_4.LT2.Card Filter (Bypass)': [
        'U12_GW01_Voltage_AB',
        'U12_GW01_Voltage_BC',
        'U12_GW01_Voltage_CA',
        'U12_GW01_Current_A',
        'U12_GW01_Current_B',
        'U12_GW01_Current_C',
        'U12_GW01_PowerFactor_A',
        'U12_GW01_PowerFactor_B',
        'U12_GW01_PowerFactor_C',
        'U12_GW01_ActivePower_Total',
        'U12_GW01_ReactivePower_Total',
        'U12_GW01_ApparentPower_Total',
        'U12_GW01_Del_ActiveEnergy',
        'U12_GW01_Rec_Active_Energy',
        'U12_GW01_Harmonics_V1_THD',
        'U12_GW01_Harmonics_V2_THD',
        'U12_GW01_Harmonics_V3_THD',
        'U12_GW01_Harmonics_I1_THD',
        'U12_GW01_Harmonics_I2_THD',
        'U12_GW01_Harmonics_I3_THD',
        'U12_GW01_Voltage_AN',
        'U12_GW01_Voltage_BN',
        'U12_GW01_Voltage_CN',
        'U12_GW01_Voltage_LN_Avg',
        'U12_GW01_Voltage_Avg',
        'U12_GW01_Current_Avg',
        'U12_GW01_PowerFactor_Avg',
        'U12_GW01_Power_Phase_A',
        'U12_GW01_Power_Phase_B',
        'U12_GW01_Power_Phase_C',
      ],
      //U13_GW01
      'Unit_4.LT2.Wapda + HFO + JMS Incoming': [
        'U13_GW01_Voltage_AB',
        'U13_GW01_Voltage_BC',
        'U13_GW01_Voltage_CA',
        'U13_GW01_Current_A',
        'U13_GW01_Current_B',
        'U13_GW01_Current_C',
        'U13_GW01_PowerFactor_A',
        'U13_GW01_PowerFactor_B',
        'U13_GW01_PowerFactor_C',
        'U13_GW01_ActivePower_Total',
        'U13_GW01_ReactivePower_Total',
        'U13_GW01_ApparentPower_Total',
        'U13_GW01_Del_ActiveEnergy',
        'U13_GW01_Rec_Active_Energy',
        'U13_GW01_Harmonics_V1_THD',
        'U13_GW01_Harmonics_V2_THD',
        'U13_GW01_Harmonics_V3_THD',
        'U13_GW01_Harmonics_I1_THD',
        'U13_GW01_Harmonics_I2_THD',
        'U13_GW01_Harmonics_I3_THD',
        'U13_GW01_Voltage_AN',
        'U13_GW01_Voltage_BN',
        'U13_GW01_Voltage_CN',
        'U13_GW01_Voltage_LN_Avg',
        'U13_GW01_Voltage_Avg',
        'U13_GW01_Current_Avg',
        'U13_GW01_PowerFactor_Avg',
        'U13_GW01_Power_Phase_A',
        'U13_GW01_Power_Phase_B',
        'U13_GW01_Power_Phase_C',
      ],
      //U14_GW01
      'Unit_4.LT2.B/R Card Filter': [
        'U14_GW01_Voltage_AB',
        'U14_GW01_Voltage_BC',
        'U14_GW01_Voltage_CA',
        'U14_GW01_Current_A',
        'U14_GW01_Current_B',
        'U14_GW01_Current_C',
        'U14_GW01_PowerFactor_A',
        'U14_GW01_PowerFactor_B',
        'U14_GW01_PowerFactor_C',
        'U14_GW01_ActivePower_Total',
        'U14_GW01_ReactivePower_Total',
        'U14_GW01_ApparentPower_Total',
        'U14_GW01_Del_ActiveEnergy',
        'U14_GW01_Rec_Active_Energy',
        'U14_GW01_Harmonics_V1_THD',
        'U14_GW01_Harmonics_V2_THD',
        'U14_GW01_Harmonics_V3_THD',
        'U14_GW01_Harmonics_I1_THD',
        'U14_GW01_Harmonics_I2_THD',
        'U14_GW01_Harmonics_I3_THD',
        'U14_GW01_Voltage_AN',
        'U14_GW01_Voltage_BN',
        'U14_GW01_Voltage_CN',
        'U14_GW01_Voltage_LN_Avg',
        'U14_GW01_Voltage_Avg',
        'U14_GW01_Current_Avg',
        'U14_GW01_PowerFactor_Avg',
        'U14_GW01_Power_Phase_A',
        'U14_GW01_Power_Phase_B',
        'U14_GW01_Power_Phase_C',
      ],
      //U15_GW01
      'Unit_4.LT2.Ring 5-8': [
        'U15_GW01_Voltage_AB',
        'U15_GW01_Voltage_BC',
        'U15_GW01_Voltage_CA',
        'U15_GW01_Current_A',
        'U15_GW01_Current_B',
        'U15_GW01_Current_C',
        'U15_GW01_PowerFactor_A',
        'U15_GW01_PowerFactor_B',
        'U15_GW01_PowerFactor_C',
        'U15_GW01_ActivePower_Total',
        'U15_GW01_ReactivePower_Total',
        'U15_GW01_ApparentPower_Total',
        'U15_GW01_Del_ActiveEnergy',
        'U15_GW01_Rec_Active_Energy',
        'U15_GW01_Harmonics_V1_THD',
        'U15_GW01_Harmonics_V2_THD',
        'U15_GW01_Harmonics_V3_THD',
        'U15_GW01_Harmonics_I1_THD',
        'U15_GW01_Harmonics_I2_THD',
        'U15_GW01_Harmonics_I3_THD',
        'U15_GW01_Voltage_AN',
        'U15_GW01_Voltage_BN',
        'U15_GW01_Voltage_CN',
        'U15_GW01_Voltage_LN_Avg',
        'U15_GW01_Voltage_Avg',
        'U15_GW01_Current_Avg',
        'U15_GW01_PowerFactor_Avg',
        'U15_GW01_Power_Phase_A',
        'U15_GW01_Power_Phase_B',
        'U15_GW01_Power_Phase_C',
      ],
      //U16_GW01
      'Unit_4.LT2.Ring 13-16': [
        'U16_GW01_Voltage_AB',
        'U16_GW01_Voltage_BC',
        'U16_GW01_Voltage_CA',
        'U16_GW01_Current_A',
        'U16_GW01_Current_B',
        'U16_GW01_Current_C',
        'U16_GW01_PowerFactor_A',
        'U16_GW01_PowerFactor_B',
        'U16_GW01_PowerFactor_C',
        'U16_GW01_ActivePower_Total',
        'U16_GW01_ReactivePower_Total',
        'U16_GW01_ApparentPower_Total',
        'U16_GW01_Del_ActiveEnergy',
        'U16_GW01_Rec_Active_Energy',
        'U16_GW01_Harmonics_V1_THD',
        'U16_GW01_Harmonics_V2_THD',
        'U16_GW01_Harmonics_V3_THD',
        'U16_GW01_Harmonics_I1_THD',
        'U16_GW01_Harmonics_I2_THD',
        'U16_GW01_Harmonics_I3_THD',
        'U16_GW01_Voltage_AN',
        'U16_GW01_Voltage_BN',
        'U16_GW01_Voltage_CN',
        'U16_GW01_Voltage_LN_Avg',
        'U16_GW01_Voltage_Avg',
        'U16_GW01_Current_Avg',
        'U16_GW01_PowerFactor_Avg',
        'U16_GW01_Power_Phase_A',
        'U16_GW01_Power_Phase_B',
        'U16_GW01_Power_Phase_C',
      ],
      //U17_GW01
      'Unit_4.LT2.Ring 9-12': [
        'U17_GW01_Voltage_AB',
        'U17_GW01_Voltage_BC',
        'U17_GW01_Voltage_CA',
        'U17_GW01_Current_A',
        'U17_GW01_Current_B',
        'U17_GW01_Current_C',
        'U17_GW01_PowerFactor_A',
        'U17_GW01_PowerFactor_B',
        'U17_GW01_PowerFactor_C',
        'U17_GW01_ActivePower_Total',
        'U17_GW01_ReactivePower_Total',
        'U17_GW01_ApparentPower_Total',
        'U17_GW01_Del_ActiveEnergy',
        'U17_GW01_Rec_Active_Energy',
        'U17_GW01_Harmonics_V1_THD',
        'U17_GW01_Harmonics_V2_THD',
        'U17_GW01_Harmonics_V3_THD',
        'U17_GW01_Harmonics_I1_THD',
        'U17_GW01_Harmonics_I2_THD',
        'U17_GW01_Harmonics_I3_THD',
        'U17_GW01_Voltage_AN',
        'U17_GW01_Voltage_BN',
        'U17_GW01_Voltage_CN',
        'U17_GW01_Voltage_LN_Avg',
        'U17_GW01_Voltage_Avg',
        'U17_GW01_Current_Avg',
        'U17_GW01_PowerFactor_Avg',
        'U17_GW01_Power_Phase_A',
        'U17_GW01_Power_Phase_B',
        'U17_GW01_Power_Phase_C',
      ],
      //U18_GW01 => U6
      'Unit_4.LT2.Bale Press': [
        'U6_GW01_Voltage_AB',
        'U6_GW01_Voltage_BC',
        'U6_GW01_Voltage_CA',
        'U6_GW01_Current_A',
        'U6_GW01_Current_B',
        'U6_GW01_Current_C',
        'U6_GW01_PowerFactor_A',
        'U6_GW01_PowerFactor_B',
        'U6_GW01_PowerFactor_C',
        'U6_GW01_ActivePower_Total',
        'U6_GW01_ReactivePower_Total',
        'U6_GW01_ApparentPower_Total',
        'U6_GW01_Del_ActiveEnergy',
        'U6_GW01_Rec_Active_Energy',
        'U6_GW01_Harmonics_V1_THD',
        'U6_GW01_Harmonics_V2_THD',
        'U6_GW01_Harmonics_V3_THD',
        'U6_GW01_Harmonics_I1_THD',
        'U6_GW01_Harmonics_I2_THD',
        'U6_GW01_Harmonics_I3_THD',
        'U6_GW01_Voltage_AN',
        'U6_GW01_Voltage_BN',
        'U6_GW01_Voltage_CN',
        'U6_GW01_Voltage_LN_Avg',
        'U6_GW01_Voltage_Avg',
        'U6_GW01_Current_Avg',
        'U6_GW01_PowerFactor_Avg',
        'U6_GW01_Power_Phase_A',
        'U6_GW01_Power_Phase_B',
        'U6_GW01_Power_Phase_C',
      ],
      //U19_GW01
      'Unit_4.LT2.AC Lab': [
        'U19_GW01_Voltage_AB',
        'U19_GW01_Voltage_BC',
        'U19_GW01_Voltage_CA',
        'U19_GW01_Current_A',
        'U19_GW01_Current_B',
        'U19_GW01_Current_C',
        'U19_GW01_PowerFactor_A',
        'U19_GW01_PowerFactor_B',
        'U19_GW01_PowerFactor_C',
        'U19_GW01_ActivePower_Total',
        'U19_GW01_ReactivePower_Total',
        'U19_GW01_ApparentPower_Total',
        'U19_GW01_Del_ActiveEnergy',
        'U19_GW01_Rec_Active_Energy',
        'U19_GW01_Harmonics_V1_THD',
        'U19_GW01_Harmonics_V2_THD',
        'U19_GW01_Harmonics_V3_THD',
        'U19_GW01_Harmonics_I1_THD',
        'U19_GW01_Harmonics_I2_THD',
        'U19_GW01_Harmonics_I3_THD',
        'U19_GW01_Voltage_AN',
        'U19_GW01_Voltage_BN',
        'U19_GW01_Voltage_CN',
        'U19_GW01_Voltage_LN_Avg',
        'U19_GW01_Voltage_Avg',
        'U19_GW01_Current_Avg',
        'U19_GW01_PowerFactor_Avg',
        'U19_GW01_Power_Phase_A',
        'U19_GW01_Power_Phase_B',
        'U19_GW01_Power_Phase_C',
      ],
      //U20_GW01
      'Unit_4.LT2.Spare': [
        'U20_GW01_Voltage_AB',
        'U20_GW01_Voltage_BC',
        'U20_GW01_Voltage_CA',
        'U20_GW01_Current_A',
        'U20_GW01_Current_B',
        'U20_GW01_Current_C',
        'U20_GW01_PowerFactor_A',
        'U20_GW01_PowerFactor_B',
        'U20_GW01_PowerFactor_C',
        'U20_GW01_ActivePower_Total',
        'U20_GW01_ReactivePower_Total',
        'U20_GW01_ApparentPower_Total',
        'U20_GW01_Del_ActiveEnergy',
        'U20_GW01_Rec_Active_Energy',
        'U20_GW01_Harmonics_V1_THD',
        'U20_GW01_Harmonics_V2_THD',
        'U20_GW01_Harmonics_V3_THD',
        'U20_GW01_Harmonics_I1_THD',
        'U20_GW01_Harmonics_I2_THD',
        'U20_GW01_Harmonics_I3_THD',
        'U20_GW01_Voltage_AN',
        'U20_GW01_Voltage_BN',
        'U20_GW01_Voltage_CN',
        'U20_GW01_Voltage_LN_Avg',
        'U20_GW01_Voltage_Avg',
        'U20_GW01_Current_Avg',
        'U20_GW01_PowerFactor_Avg',
        'U20_GW01_Power_Phase_A',
        'U20_GW01_Power_Phase_B',
        'U20_GW01_Power_Phase_C',
      ],
      //U21_GW01
      'Unit_4.LT2.Spare 2': [
        'U21_GW01_Voltage_AB',
        'U21_GW01_Voltage_BC',
        'U21_GW01_Voltage_CA',
        'U21_GW01_Current_A',
        'U21_GW01_Current_B',
        'U21_GW01_Current_C',
        'U21_GW01_PowerFactor_A',
        'U21_GW01_PowerFactor_B',
        'U21_GW01_PowerFactor_C',
        'U21_GW01_ActivePower_Total',
        'U21_GW01_ReactivePower_Total',
        'U21_GW01_ApparentPower_Total',
        'U21_GW01_Del_ActiveEnergy',
        'U21_GW01_Rec_Active_Energy',
        'U21_GW01_Harmonics_V1_THD',
        'U21_GW01_Harmonics_V2_THD',
        'U21_GW01_Harmonics_V3_THD',
        'U21_GW01_Harmonics_I1_THD',
        'U21_GW01_Harmonics_I2_THD',
        'U21_GW01_Harmonics_I3_THD',
        'U21_GW01_Voltage_AN',
        'U21_GW01_Voltage_BN',
        'U21_GW01_Voltage_CN',
        'U21_GW01_Voltage_LN_Avg',
        'U21_GW01_Voltage_Avg',
        'U21_GW01_Current_Avg',
        'U21_GW01_PowerFactor_Avg',
        'U21_GW01_Power_Phase_A',
        'U21_GW01_Power_Phase_B',
        'U21_GW01_Power_Phase_C',
      ],
      'Unit_4.Unit 4 HT Room': ['P/H IC', 'WAPDA IC'],
      'Unit_4.Unit 4 HT Room.P/H IC': [
        'U22_GW01_Voltage_AB',
        'U22_GW01_Voltage_BC',
        'U22_GW01_Voltage_CA',
        'U22_GW01_Current_A',
        'U22_GW01_Current_B',
        'U22_GW01_Current_C',
        'U22_GW01_PowerFactor_A',
        'U22_GW01_PowerFactor_B',
        'U22_GW01_PowerFactor_C',
        'U22_GW01_ActivePower_Total',
        'U22_GW01_ReactivePower_Total',
        'U22_GW01_ApparentPower_Total',
        'U22_GW01_Del_ActiveEnergy',
        'U22_GW01_Rec_Active_Energy',
        'U22_GW01_Harmonics_V1_THD',
        'U22_GW01_Harmonics_V2_THD',
        'U22_GW01_Harmonics_V3_THD',
        'U22_GW01_Harmonics_I1_THD',
        'U22_GW01_Harmonics_I2_THD',
        'U22_GW01_Harmonics_I3_THD',
        'U22_GW01_Voltage_AN',
        'U22_GW01_Voltage_BN',
        'U22_GW01_Voltage_CN',
        'U22_GW01_Voltage_LN_Avg',
        'U22_GW01_Voltage_Avg',
        'U22_GW01_Current_Avg',
        'U22_GW01_PowerFactor_Avg',
        'U22_GW01_Power_Phase_A',
        'U22_GW01_Power_Phase_B',
        'U22_GW01_Power_Phase_C',
      ],
      'Unit_4.Unit 4 HT Room.WAPDA IC': [
        'U23_GW01_Voltage_AB',
        'U23_GW01_Voltage_BC',
        'U23_GW01_Voltage_CA',
        'U23_GW01_Current_A',
        'U23_GW01_Current_B',
        'U23_GW01_Current_C',
        'U23_GW01_PowerFactor_A',
        'U23_GW01_PowerFactor_B',
        'U23_GW01_PowerFactor_C',
        'U23_GW01_ActivePower_Total',
        'U23_GW01_ReactivePower_Total',
        'U23_GW01_ApparentPower_Total',
        'U23_GW01_Del_ActiveEnergy',
        'U23_GW01_Rec_Active_Energy',
        'U23_GW01_Harmonics_V1_THD',
        'U23_GW01_Harmonics_V2_THD',
        'U23_GW01_Harmonics_V3_THD',
        'U23_GW01_Harmonics_I1_THD',
        'U23_GW01_Harmonics_I2_THD',
        'U23_GW01_Harmonics_I3_THD',
        'U23_GW01_Voltage_AN',
        'U23_GW01_Voltage_BN',
        'U23_GW01_Voltage_CN',
        'U23_GW01_Voltage_LN_Avg',
        'U23_GW01_Voltage_Avg',
        'U23_GW01_Current_Avg',
        'U23_GW01_PowerFactor_Avg',
        'U23_GW01_Power_Phase_A',
        'U23_GW01_Power_Phase_B',
        'U23_GW01_Power_Phase_C',
      ],
      Unit_5: ['LT1', 'LT2', 'Unit 5 HT Room'],
      'Unit_5.LT1': [
        'PDB1 CD1',
        'PDB2 CD2',
        'Card PDB 01',
        'PDB 08',
        'PF Panel',
        'Solar 1184.55 Kw',
        'Ring 1-3',
        'AC Supply Fan',
        'Blow Room L1',
        'Ring Frames 4-6',
        'A/C Plant Blowing',
        'MLDB1 Blower Room Card',
        'TF #1',
        'Comber MCS 1-14',
        'AC Return Fan',
        'Water Chiller',
        'Card M/C 8-14',
        'Auto Con 1-9',
        'Card M/C 1-7',
        'AC Plant Winding',
        'Simplex M/C 1~6 + 1~5 Breaker Machines',
        'Spare 2',
        'Draw Frame Finish 1~8',
      ],
      //U1_GW02
      'Unit_5.LT1.PDB1 CD1': [
        'U1_GW02_Voltage_AB',
        'U1_GW02_Voltage_BC',
        'U1_GW02_Voltage_CA',
        'U1_GW02_Current_A',
        'U1_GW02_Current_B',
        'U1_GW02_Current_C',
        'U1_GW02_PowerFactor_A',
        'U1_GW02_PowerFactor_B',
        'U1_GW02_PowerFactor_C',
        'U1_GW02_ActivePower_Total',
        'U1_GW02_ReactivePower_Total',
        'U1_GW02_ApparentPower_Total',
        'U1_GW02_Del_ActiveEnergy',
        'U1_GW02_Rec_Active_Energy',
        'U1_GW02_Harmonics_V1_THD',
        'U1_GW02_Harmonics_V2_THD',
        'U1_GW02_Harmonics_V3_THD',
        'U1_GW02_Harmonics_I1_THD',
        'U1_GW02_Harmonics_I2_THD',
        'U1_GW02_Harmonics_I3_THD',
        'U1_GW02_Voltage_AN',
        'U1_GW02_Voltage_BN',
        'U1_GW02_Voltage_CN',
        'U1_GW02_Voltage_LN_Avg',
        'U1_GW02_Voltage_Avg',
        'U1_GW02_Current_Avg',
        'U1_GW02_PowerFactor_Avg',
        'U1_GW02_Power_Phase_A',
        'U1_GW02_Power_Phase_B',
        'U1_GW02_Power_Phase_C',
      ],
      //U2_GW02
      'Unit_5.LT1.PDB2 CD2': [
        'U2_GW02_Voltage_AB',
        'U2_GW02_Voltage_BC',
        'U2_GW02_Voltage_CA',
        'U2_GW02_Current_A',
        'U2_GW02_Current_B',
        'U2_GW02_Current_C',
        'U2_GW02_PowerFactor_A',
        'U2_GW02_PowerFactor_B',
        'U2_GW02_PowerFactor_C',
        'U2_GW02_ActivePower_Total',
        'U2_GW02_ReactivePower_Total',
        'U2_GW02_ApparentPower_Total',
        'U2_GW02_Del_ActiveEnergy',
        'U2_GW02_Rec_Active_Energy',
        'U2_GW02_Harmonics_V1_THD',
        'U2_GW02_Harmonics_V2_THD',
        'U2_GW02_Harmonics_V3_THD',
        'U2_GW02_Harmonics_I1_THD',
        'U2_GW02_Harmonics_I2_THD',
        'U2_GW02_Harmonics_I3_THD',
        'U2_GW02_Voltage_AN',
        'U2_GW02_Voltage_BN',
        'U2_GW02_Voltage_CN',
        'U2_GW02_Voltage_LN_Avg',
        'U2_GW02_Voltage_Avg',
        'U2_GW02_Current_Avg',
        'U2_GW02_PowerFactor_Avg',
        'U2_GW02_Power_Phase_A',
        'U2_GW02_Power_Phase_B',
        'U2_GW02_Power_Phase_C',
      ],
      //U3_GW02
      'Unit_5.LT1.Card PDB 01': [
        'U3_GW02_Voltage_AB',
        'U3_GW02_Voltage_BC',
        'U3_GW02_Voltage_CA',
        'U3_GW02_Current_A',
        'U3_GW02_Current_B',
        'U3_GW02_Current_C',
        'U3_GW02_PowerFactor_A',
        'U3_GW02_PowerFactor_B',
        'U3_GW02_PowerFactor_C',
        'U3_GW02_ActivePower_Total',
        'U3_GW02_ReactivePower_Total',
        'U3_GW02_ApparentPower_Total',
        'U3_GW02_Del_ActiveEnergy',
        'U3_GW02_Rec_Active_Energy',
        'U3_GW02_Harmonics_V1_THD',
        'U3_GW02_Harmonics_V2_THD',
        'U3_GW02_Harmonics_V3_THD',
        'U3_GW02_Harmonics_I1_THD',
        'U3_GW02_Harmonics_I2_THD',
        'U3_GW02_Harmonics_I3_THD',
        'U3_GW02_Voltage_AN',
        'U3_GW02_Voltage_BN',
        'U3_GW02_Voltage_CN',
        'U3_GW02_Voltage_LN_Avg',
        'U3_GW02_Voltage_Avg',
        'U3_GW02_Current_Avg',
        'U3_GW02_PowerFactor_Avg',
        'U3_GW02_Power_Phase_A',
        'U3_GW02_Power_Phase_B',
        'U3_GW02_Power_Phase_C',
      ],
      //U4_GW02
      'Unit_5.LT1.PDB 08': [
        'U4_GW02_Voltage_AB',
        'U4_GW02_Voltage_BC',
        'U4_GW02_Voltage_CA',
        'U4_GW02_Current_A',
        'U4_GW02_Current_B',
        'U4_GW02_Current_C',
        'U4_GW02_PowerFactor_A',
        'U4_GW02_PowerFactor_B',
        'U4_GW02_PowerFactor_C',
        'U4_GW02_ActivePower_Total',
        'U4_GW02_ReactivePower_Total',
        'U4_GW02_ApparentPower_Total',
        'U4_GW02_Del_ActiveEnergy',
        'U4_GW02_Rec_Active_Energy',
        'U4_GW02_Harmonics_V1_THD',
        'U4_GW02_Harmonics_V2_THD',
        'U4_GW02_Harmonics_V3_THD',
        'U4_GW02_Harmonics_I1_THD',
        'U4_GW02_Harmonics_I2_THD',
        'U4_GW02_Harmonics_I3_THD',
        'U4_GW02_Voltage_AN',
        'U4_GW02_Voltage_BN',
        'U4_GW02_Voltage_CN',
        'U4_GW02_Voltage_LN_Avg',
        'U4_GW02_Voltage_Avg',
        'U4_GW02_Current_Avg',
        'U4_GW02_PowerFactor_Avg',
        'U4_GW02_Power_Phase_A',
        'U4_GW02_Power_Phase_B',
        'U4_GW02_Power_Phase_C',
      ],
      //U5_GW02
      'Unit_5.LT1.PF Panel': [
        'U5_GW02_Voltage_AB',
        'U5_GW02_Voltage_BC',
        'U5_GW02_Voltage_CA',
        'U5_GW02_Current_A',
        'U5_GW02_Current_B',
        'U5_GW02_Current_C',
        'U5_GW02_PowerFactor_A',
        'U5_GW02_PowerFactor_B',
        'U5_GW02_PowerFactor_C',
        'U5_GW02_ActivePower_Total',
        'U5_GW02_ReactivePower_Total',
        'U5_GW02_ApparentPower_Total',
        'U5_GW02_Del_ActiveEnergy',
        'U5_GW02_Rec_Active_Energy',
        'U5_GW02_Harmonics_V1_THD',
        'U5_GW02_Harmonics_V2_THD',
        'U5_GW02_Harmonics_V3_THD',
        'U5_GW02_Harmonics_I1_THD',
        'U5_GW02_Harmonics_I2_THD',
        'U5_GW02_Harmonics_I3_THD',
        'U5_GW02_Voltage_AN',
        'U5_GW02_Voltage_BN',
        'U5_GW02_Voltage_CN',
        'U5_GW02_Voltage_LN_Avg',
        'U5_GW02_Voltage_Avg',
        'U5_GW02_Current_Avg',
        'U5_GW02_PowerFactor_Avg',
        'U5_GW02_Power_Phase_A',
        'U5_GW02_Power_Phase_B',
        'U5_GW02_Power_Phase_C',
      ],
      //U6_GW02
      'Unit_5.LT1.Solar 1184.55 Kw': [
        'U6_GW02_Voltage_AB',
        'U6_GW02_Voltage_BC',
        'U6_GW02_Voltage_CA',
        'U6_GW02_Current_A',
        'U6_GW02_Current_B',
        'U6_GW02_Current_C',
        'U6_GW02_PowerFactor_A',
        'U6_GW02_PowerFactor_B',
        'U6_GW02_PowerFactor_C',
        'U6_GW02_ActivePower_Total',
        'U6_GW02_ReactivePower_Total',
        'U6_GW02_ApparentPower_Total',
        'U6_GW02_Del_ActiveEnergy',
        'U6_GW02_Rec_Active_Energy',
        'U6_GW02_Harmonics_V1_THD',
        'U6_GW02_Harmonics_V2_THD',
        'U6_GW02_Harmonics_V3_THD',
        'U6_GW02_Harmonics_I1_THD',
        'U6_GW02_Harmonics_I2_THD',
        'U6_GW02_Harmonics_I3_THD',
        'U6_GW02_Voltage_AN',
        'U6_GW02_Voltage_BN',
        'U6_GW02_Voltage_CN',
        'U6_GW02_Voltage_LN_Avg',
        'U6_GW02_Voltage_Avg',
        'U6_GW02_Current_Avg',
        'U6_GW02_PowerFactor_Avg',
        'U6_GW02_Power_Phase_A',
        'U6_GW02_Power_Phase_B',
        'U6_GW02_Power_Phase_C',
      ],
      //U7_GW02
      'Unit_5.LT1.Ring 1-3': [
        'U7_GW02_Voltage_AB',
        'U7_GW02_Voltage_BC',
        'U7_GW02_Voltage_CA',
        'U7_GW02_Current_A',
        'U7_GW02_Current_B',
        'U7_GW02_Current_C',
        'U7_GW02_PowerFactor_A',
        'U7_GW02_PowerFactor_B',
        'U7_GW02_PowerFactor_C',
        'U7_GW02_ActivePower_Total',
        'U7_GW02_ReactivePower_Total',
        'U7_GW02_ApparentPower_Total',
        'U7_GW02_Del_ActiveEnergy',
        'U7_GW02_Rec_Active_Energy',
        'U7_GW02_Harmonics_V1_THD',
        'U7_GW02_Harmonics_V2_THD',
        'U7_GW02_Harmonics_V3_THD',
        'U7_GW02_Harmonics_I1_THD',
        'U7_GW02_Harmonics_I2_THD',
        'U7_GW02_Harmonics_I3_THD',
        'U7_GW02_Voltage_AN',
        'U7_GW02_Voltage_BN',
        'U7_GW02_Voltage_CN',
        'U7_GW02_Voltage_LN_Avg',
        'U7_GW02_Voltage_Avg',
        'U7_GW02_Current_Avg',
        'U7_GW02_PowerFactor_Avg',
        'U7_GW02_Power_Phase_A',
        'U7_GW02_Power_Phase_B',
        'U7_GW02_Power_Phase_C',
      ],
      //U8_GW02
      'Unit_5.LT1.AC Supply Fan': [
        'U8_GW02_Voltage_AB',
        'U8_GW02_Voltage_BC',
        'U8_GW02_Voltage_CA',
        'U8_GW02_Current_A',
        'U8_GW02_Current_B',
        'U8_GW02_Current_C',
        'U8_GW02_PowerFactor_A',
        'U8_GW02_PowerFactor_B',
        'U8_GW02_PowerFactor_C',
        'U8_GW02_ActivePower_Total',
        'U8_GW02_ReactivePower_Total',
        'U8_GW02_ApparentPower_Total',
        'U8_GW02_Del_ActiveEnergy',
        'U8_GW02_Rec_Active_Energy',
        'U8_GW02_Harmonics_V1_THD',
        'U8_GW02_Harmonics_V2_THD',
        'U8_GW02_Harmonics_V3_THD',
        'U8_GW02_Harmonics_I1_THD',
        'U8_GW02_Harmonics_I2_THD',
        'U8_GW02_Harmonics_I3_THD',
        'U8_GW02_Voltage_AN',
        'U8_GW02_Voltage_BN',
        'U8_GW02_Voltage_CN',
        'U8_GW02_Voltage_LN_Avg',
        'U8_GW02_Voltage_Avg',
        'U8_GW02_Current_Avg',
        'U8_GW02_PowerFactor_Avg',
        'U8_GW02_Power_Phase_A',
        'U8_GW02_Power_Phase_B',
        'U8_GW02_Power_Phase_C',
      ],
      //U9_GW02
      'Unit_5.LT1.Blow Room L1': [
        'U9_GW02_Voltage_AB',
        'U9_GW02_Voltage_BC',
        'U9_GW02_Voltage_CA',
        'U9_GW02_Current_A',
        'U9_GW02_Current_B',
        'U9_GW02_Current_C',
        'U9_GW02_PowerFactor_A',
        'U9_GW02_PowerFactor_B',
        'U9_GW02_PowerFactor_C',
        'U9_GW02_ActivePower_Total',
        'U9_GW02_ReactivePower_Total',
        'U9_GW02_ApparentPower_Total',
        'U9_GW02_Del_ActiveEnergy',
        'U9_GW02_Rec_Active_Energy',
        'U9_GW02_Harmonics_V1_THD',
        'U9_GW02_Harmonics_V2_THD',
        'U9_GW02_Harmonics_V3_THD',
        'U9_GW02_Harmonics_I1_THD',
        'U9_GW02_Harmonics_I2_THD',
        'U9_GW02_Harmonics_I3_THD',
        'U9_GW02_Voltage_AN',
        'U9_GW02_Voltage_BN',
        'U9_GW02_Voltage_CN',
        'U9_GW02_Voltage_LN_Avg',
        'U9_GW02_Voltage_Avg',
        'U9_GW02_Current_Avg',
        'U9_GW02_PowerFactor_Avg',
        'U9_GW02_Power_Phase_A',
        'U9_GW02_Power_Phase_B',
        'U9_GW02_Power_Phase_C',
      ],
      //U10_GW02
      'Unit_5.LT1.Ring Frames 4-6': [
        'U10_GW02_Voltage_AB',
        'U10_GW02_Voltage_BC',
        'U10_GW02_Voltage_CA',
        'U10_GW02_Current_A',
        'U10_GW02_Current_B',
        'U10_GW02_Current_C',
        'U10_GW02_PowerFactor_A',
        'U10_GW02_PowerFactor_B',
        'U10_GW02_PowerFactor_C',
        'U10_GW02_ActivePower_Total',
        'U10_GW02_ReactivePower_Total',
        'U10_GW02_ApparentPower_Total',
        'U10_GW02_Del_ActiveEnergy',
        'U10_GW02_Rec_Active_Energy',
        'U10_GW02_Harmonics_V1_THD',
        'U10_GW02_Harmonics_V2_THD',
        'U10_GW02_Harmonics_V3_THD',
        'U10_GW02_Harmonics_I1_THD',
        'U10_GW02_Harmonics_I2_THD',
        'U10_GW02_Harmonics_I3_THD',
        'U10_GW02_Voltage_AN',
        'U10_GW02_Voltage_BN',
        'U10_GW02_Voltage_CN',
        'U10_GW02_Voltage_LN_Avg',
        'U10_GW02_Voltage_Avg',
        'U10_GW02_Current_Avg',
        'U10_GW02_PowerFactor_Avg',
        'U10_GW02_Power_Phase_A',
        'U10_GW02_Power_Phase_B',
        'U10_GW02_Power_Phase_C',
      ],
      //U11_GW02
      'Unit_5.LT1.A/C Plant Blowing': [
        'U11_GW02_Voltage_AB',
        'U11_GW02_Voltage_BC',
        'U11_GW02_Voltage_CA',
        'U11_GW02_Current_A',
        'U11_GW02_Current_B',
        'U11_GW02_Current_C',
        'U11_GW02_PowerFactor_A',
        'U11_GW02_PowerFactor_B',
        'U11_GW02_PowerFactor_C',
        'U11_GW02_ActivePower_Total',
        'U11_GW02_ReactivePower_Total',
        'U11_GW02_ApparentPower_Total',
        'U11_GW02_Del_ActiveEnergy',
        'U11_GW02_Rec_Active_Energy',
        'U11_GW02_Harmonics_V1_THD',
        'U11_GW02_Harmonics_V2_THD',
        'U11_GW02_Harmonics_V3_THD',
        'U11_GW02_Harmonics_I1_THD',
        'U11_GW02_Harmonics_I2_THD',
        'U11_GW02_Harmonics_I3_THD',
        'U11_GW02_Voltage_AN',
        'U11_GW02_Voltage_BN',
        'U11_GW02_Voltage_CN',
        'U11_GW02_Voltage_LN_Avg',
        'U11_GW02_Voltage_Avg',
        'U11_GW02_Current_Avg',
        'U11_GW02_PowerFactor_Avg',
        'U11_GW02_Power_Phase_A',
        'U11_GW02_Power_Phase_B',
        'U11_GW02_Power_Phase_C',
      ],
      //U12_GW02
      'Unit_5.LT1.MLDB1 Blower Room Card': [
        'U12_GW02_Voltage_AB',
        'U12_GW02_Voltage_BC',
        'U12_GW02_Voltage_CA',
        'U12_GW02_Current_A',
        'U12_GW02_Current_B',
        'U12_GW02_Current_C',
        'U12_GW02_PowerFactor_A',
        'U12_GW02_PowerFactor_B',
        'U12_GW02_PowerFactor_C',
        'U12_GW02_ActivePower_Total',
        'U12_GW02_ReactivePower_Total',
        'U12_GW02_ApparentPower_Total',
        'U12_GW02_Del_ActiveEnergy',
        'U12_GW02_Rec_Active_Energy',
        'U12_GW02_Harmonics_V1_THD',
        'U12_GW02_Harmonics_V2_THD',
        'U12_GW02_Harmonics_V3_THD',
        'U12_GW02_Harmonics_I1_THD',
        'U12_GW02_Harmonics_I2_THD',
        'U12_GW02_Harmonics_I3_THD',
        'U12_GW02_Voltage_AN',
        'U12_GW02_Voltage_BN',
        'U12_GW02_Voltage_CN',
        'U12_GW02_Voltage_LN_Avg',
        'U12_GW02_Voltage_Avg',
        'U12_GW02_Current_Avg',
        'U12_GW02_PowerFactor_Avg',
        'U12_GW02_Power_Phase_A',
        'U12_GW02_Power_Phase_B',
        'U12_GW02_Power_Phase_C',
      ],
      //U13_GW02
      'Unit_5.LT1.TF #1': [
        'U13_GW02_Voltage_AB',
        'U13_GW02_Voltage_BC',
        'U13_GW02_Voltage_CA',
        'U13_GW02_Current_A',
        'U13_GW02_Current_B',
        'U13_GW02_Current_C',
        'U13_GW02_PowerFactor_A',
        'U13_GW02_PowerFactor_B',
        'U13_GW02_PowerFactor_C',
        'U13_GW02_ActivePower_Total',
        'U13_GW02_ReactivePower_Total',
        'U13_GW02_ApparentPower_Total',
        'U13_GW02_Del_ActiveEnergy',
        'U13_GW02_Rec_Active_Energy',
        'U13_GW02_Harmonics_V1_THD',
        'U13_GW02_Harmonics_V2_THD',
        'U13_GW02_Harmonics_V3_THD',
        'U13_GW02_Harmonics_I1_THD',
        'U13_GW02_Harmonics_I2_THD',
        'U13_GW02_Harmonics_I3_THD',
        'U13_GW02_Voltage_AN',
        'U13_GW02_Voltage_BN',
        'U13_GW02_Voltage_CN',
        'U13_GW02_Voltage_LN_Avg',
        'U13_GW02_Voltage_Avg',
        'U13_GW02_Current_Avg',
        'U13_GW02_PowerFactor_Avg',
        'U13_GW02_Power_Phase_A',
        'U13_GW02_Power_Phase_B',
        'U13_GW02_Power_Phase_C',
      ],
      //U14_GW02
      'Unit_5.LT1.Comber MCS 1-14': [
        'U14_GW02_Voltage_AB',
        'U14_GW02_Voltage_BC',
        'U14_GW02_Voltage_CA',
        'U14_GW02_Current_A',
        'U14_GW02_Current_B',
        'U14_GW02_Current_C',
        'U14_GW02_PowerFactor_A',
        'U14_GW02_PowerFactor_B',
        'U14_GW02_PowerFactor_C',
        'U14_GW02_ActivePower_Total',
        'U14_GW02_ReactivePower_Total',
        'U14_GW02_ApparentPower_Total',
        'U14_GW02_Del_ActiveEnergy',
        'U14_GW02_Rec_Active_Energy',
        'U14_GW02_Harmonics_V1_THD',
        'U14_GW02_Harmonics_V2_THD',
        'U14_GW02_Harmonics_V3_THD',
        'U14_GW02_Harmonics_I1_THD',
        'U14_GW02_Harmonics_I2_THD',
        'U14_GW02_Harmonics_I3_THD',
        'U14_GW02_Voltage_AN',
        'U14_GW02_Voltage_BN',
        'U14_GW02_Voltage_CN',
        'U14_GW02_Voltage_LN_Avg',
        'U14_GW02_Voltage_Avg',
        'U14_GW02_Current_Avg',
        'U14_GW02_PowerFactor_Avg',
        'U14_GW02_Power_Phase_A',
        'U14_GW02_Power_Phase_B',
        'U14_GW02_Power_Phase_C',
      ],
      //U15_GW02
      'Unit_5.LT1.AC Return Fan': [
        'U15_GW02_Voltage_AB',
        'U15_GW02_Voltage_BC',
        'U15_GW02_Voltage_CA',
        'U15_GW02_Current_A',
        'U15_GW02_Current_B',
        'U15_GW02_Current_C',
        'U15_GW02_PowerFactor_A',
        'U15_GW02_PowerFactor_B',
        'U15_GW02_PowerFactor_C',
        'U15_GW02_ActivePower_Total',
        'U15_GW02_ReactivePower_Total',
        'U15_GW02_ApparentPower_Total',
        'U15_GW02_Del_ActiveEnergy',
        'U15_GW02_Rec_Active_Energy',
        'U15_GW02_Harmonics_V1_THD',
        'U15_GW02_Harmonics_V2_THD',
        'U15_GW02_Harmonics_V3_THD',
        'U15_GW02_Harmonics_I1_THD',
        'U15_GW02_Harmonics_I2_THD',
        'U15_GW02_Harmonics_I3_THD',
        'U15_GW02_Voltage_AN',
        'U15_GW02_Voltage_BN',
        'U15_GW02_Voltage_CN',
        'U15_GW02_Voltage_LN_Avg',
        'U15_GW02_Voltage_Avg',
        'U15_GW02_Current_Avg',
        'U15_GW02_PowerFactor_Avg',
        'U15_GW02_Power_Phase_A',
        'U15_GW02_Power_Phase_B',
        'U15_GW02_Power_Phase_C',
      ],
      //U16_GW02
      'Unit_5.LT1.Water Chiller': [
        'U16_GW02_Voltage_AB',
        'U16_GW02_Voltage_BC',
        'U16_GW02_Voltage_CA',
        'U16_GW02_Current_A',
        'U16_GW02_Current_B',
        'U16_GW02_Current_C',
        'U16_GW02_PowerFactor_A',
        'U16_GW02_PowerFactor_B',
        'U16_GW02_PowerFactor_C',
        'U16_GW02_ActivePower_Total',
        'U16_GW02_ReactivePower_Total',
        'U16_GW02_ApparentPower_Total',
        'U16_GW02_Del_ActiveEnergy',
        'U16_GW02_Rec_Active_Energy',
        'U16_GW02_Harmonics_V1_THD',
        'U16_GW02_Harmonics_V2_THD',
        'U16_GW02_Harmonics_V3_THD',
        'U16_GW02_Harmonics_I1_THD',
        'U16_GW02_Harmonics_I2_THD',
        'U16_GW02_Harmonics_I3_THD',
        'U16_GW02_Voltage_AN',
        'U16_GW02_Voltage_BN',
        'U16_GW02_Voltage_CN',
        'U16_GW02_Voltage_LN_Avg',
        'U16_GW02_Voltage_Avg',
        'U16_GW02_Current_Avg',
        'U16_GW02_PowerFactor_Avg',
        'U16_GW02_Power_Phase_A',
        'U16_GW02_Power_Phase_B',
        'U16_GW02_Power_Phase_C',
      ],
      //U17_GW02
      'Unit_5.LT1.Card M/C 8-14': [
        'U17_GW02_Voltage_AB',
        'U17_GW02_Voltage_BC',
        'U17_GW02_Voltage_CA',
        'U17_GW02_Current_A',
        'U17_GW02_Current_B',
        'U17_GW02_Current_C',
        'U17_GW02_PowerFactor_A',
        'U17_GW02_PowerFactor_B',
        'U17_GW02_PowerFactor_C',
        'U17_GW02_ActivePower_Total',
        'U17_GW02_ReactivePower_Total',
        'U17_GW02_ApparentPower_Total',
        'U17_GW02_Del_ActiveEnergy',
        'U17_GW02_Rec_Active_Energy',
        'U17_GW02_Harmonics_V1_THD',
        'U17_GW02_Harmonics_V2_THD',
        'U17_GW02_Harmonics_V3_THD',
        'U17_GW02_Harmonics_I1_THD',
        'U17_GW02_Harmonics_I2_THD',
        'U17_GW02_Harmonics_I3_THD',
        'U17_GW02_Voltage_AN',
        'U17_GW02_Voltage_BN',
        'U17_GW02_Voltage_CN',
        'U17_GW02_Voltage_LN_Avg',
        'U17_GW02_Voltage_Avg',
        'U17_GW02_Current_Avg',
        'U17_GW02_PowerFactor_Avg',
        'U17_GW02_Power_Phase_A',
        'U17_GW02_Power_Phase_B',
        'U17_GW02_Power_Phase_C',
      ],
      //U18_GW02
      'Unit_5.LT1.Auto Con 1-9': [
        'U18_GW02_Voltage_AB',
        'U18_GW02_Voltage_BC',
        'U18_GW02_Voltage_CA',
        'U18_GW02_Current_A',
        'U18_GW02_Current_B',
        'U18_GW02_Current_C',
        'U18_GW02_PowerFactor_A',
        'U18_GW02_PowerFactor_B',
        'U18_GW02_PowerFactor_C',
        'U18_GW02_ActivePower_Total',
        'U18_GW02_ReactivePower_Total',
        'U18_GW02_ApparentPower_Total',
        'U18_GW02_Del_ActiveEnergy',
        'U18_GW02_Rec_Active_Energy',
        'U18_GW02_Harmonics_V1_THD',
        'U18_GW02_Harmonics_V2_THD',
        'U18_GW02_Harmonics_V3_THD',
        'U18_GW02_Harmonics_I1_THD',
        'U18_GW02_Harmonics_I2_THD',
        'U18_GW02_Harmonics_I3_THD',
        'U18_GW02_Voltage_AN',
        'U18_GW02_Voltage_BN',
        'U18_GW02_Voltage_CN',
        'U18_GW02_Voltage_LN_Avg',
        'U18_GW02_Voltage_Avg',
        'U18_GW02_Current_Avg',
        'U18_GW02_PowerFactor_Avg',
        'U18_GW02_Power_Phase_A',
        'U18_GW02_Power_Phase_B',
        'U18_GW02_Power_Phase_C',
      ],
      //U19_GW02
      'Unit_5.LT1.Card M/C 1-7': [
        'U19_GW02_Voltage_AB',
        'U19_GW02_Voltage_BC',
        'U19_GW02_Voltage_CA',
        'U19_GW02_Current_A',
        'U19_GW02_Current_B',
        'U19_GW02_Current_C',
        'U19_GW02_PowerFactor_A',
        'U19_GW02_PowerFactor_B',
        'U19_GW02_PowerFactor_C',
        'U19_GW02_ActivePower_Total',
        'U19_GW02_ReactivePower_Total',
        'U19_GW02_ApparentPower_Total',
        'U19_GW02_Del_ActiveEnergy',
        'U19_GW02_Rec_Active_Energy',
        'U19_GW02_Harmonics_V1_THD',
        'U19_GW02_Harmonics_V2_THD',
        'U19_GW02_Harmonics_V3_THD',
        'U19_GW02_Harmonics_I1_THD',
        'U19_GW02_Harmonics_I2_THD',
        'U19_GW02_Harmonics_I3_THD',
        'U19_GW02_Voltage_AN',
        'U19_GW02_Voltage_BN',
        'U19_GW02_Voltage_CN',
        'U19_GW02_Voltage_LN_Avg',
        'U19_GW02_Voltage_Avg',
        'U19_GW02_Current_Avg',
        'U19_GW02_PowerFactor_Avg',
        'U19_GW02_Power_Phase_A',
        'U19_GW02_Power_Phase_B',
        'U19_GW02_Power_Phase_C',
      ],
      //U20_GW02
      'Unit_5.LT1.AC Plant Winding': [
        'U20_GW02_Voltage_AB',
        'U20_GW02_Voltage_BC',
        'U20_GW02_Voltage_CA',
        'U20_GW02_Current_A',
        'U20_GW02_Current_B',
        'U20_GW02_Current_C',
        'U20_GW02_PowerFactor_A',
        'U20_GW02_PowerFactor_B',
        'U20_GW02_PowerFactor_C',
        'U20_GW02_ActivePower_Total',
        'U20_GW02_ReactivePower_Total',
        'U20_GW02_ApparentPower_Total',
        'U20_GW02_Del_ActiveEnergy',
        'U20_GW02_Rec_Active_Energy',
        'U20_GW02_Harmonics_V1_THD',
        'U20_GW02_Harmonics_V2_THD',
        'U20_GW02_Harmonics_V3_THD',
        'U20_GW02_Harmonics_I1_THD',
        'U20_GW02_Harmonics_I2_THD',
        'U20_GW02_Harmonics_I3_THD',
        'U20_GW02_Voltage_AN',
        'U20_GW02_Voltage_BN',
        'U20_GW02_Voltage_CN',
        'U20_GW02_Voltage_LN_Avg',
        'U20_GW02_Voltage_Avg',
        'U20_GW02_Current_Avg',
        'U20_GW02_PowerFactor_Avg',
        'U20_GW02_Power_Phase_A',
        'U20_GW02_Power_Phase_B',
        'U20_GW02_Power_Phase_C',
      ],
      //U21_GW02
      'Unit_5.LT1.Simplex M/C 1~6 + 1~5 Breaker Machines': [
        'U21_GW02_Voltage_AB',
        'U21_GW02_Voltage_BC',
        'U21_GW02_Voltage_CA',
        'U21_GW02_Current_A',
        'U21_GW02_Current_B',
        'U21_GW02_Current_C',
        'U21_GW02_PowerFactor_A',
        'U21_GW02_PowerFactor_B',
        'U21_GW02_PowerFactor_C',
        'U21_GW02_ActivePower_Total',
        'U21_GW02_ReactivePower_Total',
        'U21_GW02_ApparentPower_Total',
        'U21_GW02_Del_ActiveEnergy',
        'U21_GW02_Rec_Active_Energy',
        'U21_GW02_Harmonics_V1_THD',
        'U21_GW02_Harmonics_V2_THD',
        'U21_GW02_Harmonics_V3_THD',
        'U21_GW02_Harmonics_I1_THD',
        'U21_GW02_Harmonics_I2_THD',
        'U21_GW02_Harmonics_I3_THD',
        'U21_GW02_Voltage_AN',
        'U21_GW02_Voltage_BN',
        'U21_GW02_Voltage_CN',
        'U21_GW02_Voltage_LN_Avg',
        'U21_GW02_Voltage_Avg',
        'U21_GW02_Current_Avg',
        'U21_GW02_PowerFactor_Avg',
        'U21_GW02_Power_Phase_A',
        'U21_GW02_Power_Phase_B',
        'U21_GW02_Power_Phase_C',
      ],
      //U22_GW02
      'Unit_5.LT1.Spare 2': [
        'U22_GW02_Voltage_AB',
        'U22_GW02_Voltage_BC',
        'U22_GW02_Voltage_CA',
        'U22_GW02_Current_A',
        'U22_GW02_Current_B',
        'U22_GW02_Current_C',
        'U22_GW02_PowerFactor_A',
        'U22_GW02_PowerFactor_B',
        'U22_GW02_PowerFactor_C',
        'U22_GW02_ActivePower_Total',
        'U22_GW02_ReactivePower_Total',
        'U22_GW02_ApparentPower_Total',
        'U22_GW02_Del_ActiveEnergy',
        'U22_GW02_Rec_Active_Energy',
        'U22_GW02_Harmonics_V1_THD',
        'U22_GW02_Harmonics_V2_THD',
        'U22_GW02_Harmonics_V3_THD',
        'U22_GW02_Harmonics_I1_THD',
        'U22_GW02_Harmonics_I2_THD',
        'U22_GW02_Harmonics_I3_THD',
        'U22_GW02_Voltage_AN',
        'U22_GW02_Voltage_BN',
        'U22_GW02_Voltage_CN',
        'U22_GW02_Voltage_LN_Avg',
        'U22_GW02_Voltage_Avg',
        'U22_GW02_Current_Avg',
        'U22_GW02_PowerFactor_Avg',
        'U22_GW02_Power_Phase_A',
        'U22_GW02_Power_Phase_B',
        'U22_GW02_Power_Phase_C',
      ],
      //U23_GW02
      'Unit_5.LT1.Draw Frame Finish 1~8': [
        'U23_GW02_Voltage_AB',
        'U23_GW02_Voltage_BC',
        'U23_GW02_Voltage_CA',
        'U23_GW02_Current_A',
        'U23_GW02_Current_B',
        'U23_GW02_Current_C',
        'U23_GW02_PowerFactor_A',
        'U23_GW02_PowerFactor_B',
        'U23_GW02_PowerFactor_C',
        'U23_GW02_ActivePower_Total',
        'U23_GW02_ReactivePower_Total',
        'U23_GW02_ApparentPower_Total',
        'U23_GW02_Del_ActiveEnergy',
        'U23_GW02_Rec_Active_Energy',
        'U23_GW02_Harmonics_V1_THD',
        'U23_GW02_Harmonics_V2_THD',
        'U23_GW02_Harmonics_V3_THD',
        'U23_GW02_Harmonics_I1_THD',
        'U23_GW02_Harmonics_I2_THD',
        'U23_GW02_Harmonics_I3_THD',
        'U23_GW02_Voltage_AN',
        'U23_GW02_Voltage_BN',
        'U23_GW02_Voltage_CN',
        'U23_GW02_Voltage_LN_Avg',
        'U23_GW02_Voltage_Avg',
        'U23_GW02_Current_Avg',
        'U23_GW02_PowerFactor_Avg',
        'U23_GW02_Power_Phase_A',
        'U23_GW02_Power_Phase_B',
        'U23_GW02_Power_Phase_C',
      ],
      'Unit_5.LT2': [
        'Ring Frame 7-9',
        'Yarn Conditioning M/C',
        'MLDB3 Single room quarter',
        'Roving transport system',
        'Ring Frame 10-12',
        'Spare 3',
        'Spare 1',
        'Spare 2',
        'Ring Frame 13-15',
        'Auto Con 10-18',
        'Baling Press',
        'Ring Frame 16-18',
        'Fiber Deposit Plant',
        'MLDB2 Ring Con (Lighting)',
        'Deep Valve Turbine',
        'TF #2',
        'Solar 1066.985 kW',
        'PF Panel',
        'PDB 07',
        'PDB 10',
      ],
      //U1_GW03
      'Unit_5.LT2.Ring Frame 7-9': [
        'U1_GW03_Voltage_AB',
        'U1_GW03_Voltage_BC',
        'U1_GW03_Voltage_CA',
        'U1_GW03_Current_A',
        'U1_GW03_Current_B',
        'U1_GW03_Current_C',
        'U1_GW03_PowerFactor_A',
        'U1_GW03_PowerFactor_B',
        'U1_GW03_PowerFactor_C',
        'U1_GW03_ActivePower_Total',
        'U1_GW03_ReactivePower_Total',
        'U1_GW03_ApparentPower_Total',
        'U1_GW03_Del_ActiveEnergy',
        'U1_GW03_Rec_Active_Energy',
        'U1_GW03_Harmonics_V1_THD',
        'U1_GW03_Harmonics_V2_THD',
        'U1_GW03_Harmonics_V3_THD',
        'U1_GW03_Harmonics_I1_THD',
        'U1_GW03_Harmonics_I2_THD',
        'U1_GW03_Harmonics_I3_THD',
        'U1_GW03_Voltage_AN',
        'U1_GW03_Voltage_BN',
        'U1_GW03_Voltage_CN',
        'U1_GW03_Voltage_LN_Avg',
        'U1_GW03_Voltage_Avg',
        'U1_GW03_Current_Avg',
        'U1_GW03_PowerFactor_Avg',
        'U1_GW03_Power_Phase_A',
        'U1_GW03_Power_Phase_B',
        'U1_GW03_Power_Phase_C',
      ],
      //U2_GW03
      'Unit_5.LT2.Yarn Conditioning M/C': [
        'U2_GW03_Voltage_AB',
        'U2_GW03_Voltage_BC',
        'U2_GW03_Voltage_CA',
        'U2_GW03_Current_A',
        'U2_GW03_Current_B',
        'U2_GW03_Current_C',
        'U2_GW03_PowerFactor_A',
        'U2_GW03_PowerFactor_B',
        'U2_GW03_PowerFactor_C',
        'U2_GW03_ActivePower_Total',
        'U2_GW03_ReactivePower_Total',
        'U2_GW03_ApparentPower_Total',
        'U2_GW03_Del_ActiveEnergy',
        'U2_GW03_Rec_Active_Energy',
        'U2_GW03_Harmonics_V1_THD',
        'U2_GW03_Harmonics_V2_THD',
        'U2_GW03_Harmonics_V3_THD',
        'U2_GW03_Harmonics_I1_THD',
        'U2_GW03_Harmonics_I2_THD',
        'U2_GW03_Harmonics_I3_THD',
        'U2_GW03_Voltage_AN',
        'U2_GW03_Voltage_BN',
        'U2_GW03_Voltage_CN',
        'U2_GW03_Voltage_LN_Avg',
        'U2_GW03_Voltage_Avg',
        'U2_GW03_Current_Avg',
        'U2_GW03_PowerFactor_Avg',
        'U2_GW03_Power_Phase_A',
        'U2_GW03_Power_Phase_B',
        'U2_GW03_Power_Phase_C',
      ],
      //U3_GW03
      'Unit_5.LT2.MLDB3 Single room quarter': [
        'U3_GW03_Voltage_AB',
        'U3_GW03_Voltage_BC',
        'U3_GW03_Voltage_CA',
        'U3_GW03_Current_A',
        'U3_GW03_Current_B',
        'U3_GW03_Current_C',
        'U3_GW03_PowerFactor_A',
        'U3_GW03_PowerFactor_B',
        'U3_GW03_PowerFactor_C',
        'U3_GW03_ActivePower_Total',
        'U3_GW03_ReactivePower_Total',
        'U3_GW03_ApparentPower_Total',
        'U3_GW03_Del_ActiveEnergy',
        'U3_GW03_Rec_Active_Energy',
        'U3_GW03_Harmonics_V1_THD',
        'U3_GW03_Harmonics_V2_THD',
        'U3_GW03_Harmonics_V3_THD',
        'U3_GW03_Harmonics_I1_THD',
        'U3_GW03_Harmonics_I2_THD',
        'U3_GW03_Harmonics_I3_THD',
        'U3_GW03_Voltage_AN',
        'U3_GW03_Voltage_BN',
        'U3_GW03_Voltage_CN',
        'U3_GW03_Voltage_LN_Avg',
        'U3_GW03_Voltage_Avg',
        'U3_GW03_Current_Avg',
        'U3_GW03_PowerFactor_Avg',
        'U3_GW03_Power_Phase_A',
        'U3_GW03_Power_Phase_B',
        'U3_GW03_Power_Phase_C',
      ],
      //U4_GW03
      'Unit_5.LT2.Roving transport system': [
        'U4_GW03_Voltage_AB',
        'U4_GW03_Voltage_BC',
        'U4_GW03_Voltage_CA',
        'U4_GW03_Current_A',
        'U4_GW03_Current_B',
        'U4_GW03_Current_C',
        'U4_GW03_PowerFactor_A',
        'U4_GW03_PowerFactor_B',
        'U4_GW03_PowerFactor_C',
        'U4_GW03_ActivePower_Total',
        'U4_GW03_ReactivePower_Total',
        'U4_GW03_ApparentPower_Total',
        'U4_GW03_Del_ActiveEnergy',
        'U4_GW03_Rec_Active_Energy',
        'U4_GW03_Harmonics_V1_THD',
        'U4_GW03_Harmonics_V2_THD',
        'U4_GW03_Harmonics_V3_THD',
        'U4_GW03_Harmonics_I1_THD',
        'U4_GW03_Harmonics_I2_THD',
        'U4_GW03_Harmonics_I3_THD',
        'U4_GW03_Voltage_AN',
        'U4_GW03_Voltage_BN',
        'U4_GW03_Voltage_CN',
        'U4_GW03_Voltage_LN_Avg',
        'U4_GW03_Voltage_Avg',
        'U4_GW03_Current_Avg',
        'U4_GW03_PowerFactor_Avg',
        'U4_GW03_Power_Phase_A',
        'U4_GW03_Power_Phase_B',
        'U4_GW03_Power_Phase_C',
      ],
      //U5_GW03
      'Unit_5.LT2.Ring Frame 10-12': [
        'U5_GW03_Voltage_AB',
        'U5_GW03_Voltage_BC',
        'U5_GW03_Voltage_CA',
        'U5_GW03_Current_A',
        'U5_GW03_Current_B',
        'U5_GW03_Current_C',
        'U5_GW03_PowerFactor_A',
        'U5_GW03_PowerFactor_B',
        'U5_GW03_PowerFactor_C',
        'U5_GW03_ActivePower_Total',
        'U5_GW03_ReactivePower_Total',
        'U5_GW03_ApparentPower_Total',
        'U5_GW03_Del_ActiveEnergy',
        'U5_GW03_Rec_Active_Energy',
        'U5_GW03_Harmonics_V1_THD',
        'U5_GW03_Harmonics_V2_THD',
        'U5_GW03_Harmonics_V3_THD',
        'U5_GW03_Harmonics_I1_THD',
        'U5_GW03_Harmonics_I2_THD',
        'U5_GW03_Harmonics_I3_THD',
        'U5_GW03_Voltage_AN',
        'U5_GW03_Voltage_BN',
        'U5_GW03_Voltage_CN',
        'U5_GW03_Voltage_LN_Avg',
        'U5_GW03_Voltage_Avg',
        'U5_GW03_Current_Avg',
        'U5_GW03_PowerFactor_Avg',
        'U5_GW03_Power_Phase_A',
        'U5_GW03_Power_Phase_B',
        'U5_GW03_Power_Phase_C',
      ],
      //U6_GW03
      'Unit_5.LT2.Spare 3': [
        'U6_GW03_Voltage_AB',
        'U6_GW03_Voltage_BC',
        'U6_GW03_Voltage_CA',
        'U6_GW03_Current_A',
        'U6_GW03_Current_B',
        'U6_GW03_Current_C',
        'U6_GW03_PowerFactor_A',
        'U6_GW03_PowerFactor_B',
        'U6_GW03_PowerFactor_C',
        'U6_GW03_ActivePower_Total',
        'U6_GW03_ReactivePower_Total',
        'U6_GW03_ApparentPower_Total',
        'U6_GW03_Del_ActiveEnergy',
        'U6_GW03_Rec_Active_Energy',
        'U6_GW03_Harmonics_V1_THD',
        'U6_GW03_Harmonics_V2_THD',
        'U6_GW03_Harmonics_V3_THD',
        'U6_GW03_Harmonics_I1_THD',
        'U6_GW03_Harmonics_I2_THD',
        'U6_GW03_Harmonics_I3_THD',
        'U6_GW03_Voltage_AN',
        'U6_GW03_Voltage_BN',
        'U6_GW03_Voltage_CN',
        'U6_GW03_Voltage_LN_Avg',
        'U6_GW03_Voltage_Avg',
        'U6_GW03_Current_Avg',
        'U6_GW03_PowerFactor_Avg',
        'U6_GW03_Power_Phase_A',
        'U6_GW03_Power_Phase_B',
        'U6_GW03_Power_Phase_C',
      ],
      //U7_GW03
      'Unit_5.LT2.Spare 1': [
        'U7_GW03_Voltage_AB',
        'U7_GW03_Voltage_BC',
        'U7_GW03_Voltage_CA',
        'U7_GW03_Current_A',
        'U7_GW03_Current_B',
        'U7_GW03_Current_C',
        'U7_GW03_PowerFactor_A',
        'U7_GW03_PowerFactor_B',
        'U7_GW03_PowerFactor_C',
        'U7_GW03_ActivePower_Total',
        'U7_GW03_ReactivePower_Total',
        'U7_GW03_ApparentPower_Total',
        'U7_GW03_Del_ActiveEnergy',
        'U7_GW03_Rec_Active_Energy',
        'U7_GW03_Harmonics_V1_THD',
        'U7_GW03_Harmonics_V2_THD',
        'U7_GW03_Harmonics_V3_THD',
        'U7_GW03_Harmonics_I1_THD',
        'U7_GW03_Harmonics_I2_THD',
        'U7_GW03_Harmonics_I3_THD',
        'U7_GW03_Voltage_AN',
        'U7_GW03_Voltage_BN',
        'U7_GW03_Voltage_CN',
        'U7_GW03_Voltage_LN_Avg',
        'U7_GW03_Voltage_Avg',
        'U7_GW03_Current_Avg',
        'U7_GW03_PowerFactor_Avg',
        'U7_GW03_Power_Phase_A',
        'U7_GW03_Power_Phase_B',
        'U7_GW03_Power_Phase_C',
      ],
      //U8_GW04
      'Unit_5.LT2.Spare 2': [
        'U8_GW03_Voltage_AB',
        'U8_GW03_Voltage_BC',
        'U8_GW03_Voltage_CA',
        'U8_GW03_Current_A',
        'U8_GW03_Current_B',
        'U8_GW03_Current_C',
        'U8_GW03_PowerFactor_A',
        'U8_GW03_PowerFactor_B',
        'U8_GW03_PowerFactor_C',
        'U8_GW03_ActivePower_Total',
        'U8_GW03_ReactivePower_Total',
        'U8_GW03_ApparentPower_Total',
        'U8_GW03_Del_ActiveEnergy',
        'U8_GW03_Rec_Active_Energy',
        'U8_GW03_Harmonics_V1_THD',
        'U8_GW03_Harmonics_V2_THD',
        'U8_GW03_Harmonics_V3_THD',
        'U8_GW03_Harmonics_I1_THD',
        'U8_GW03_Harmonics_I2_THD',
        'U8_GW03_Harmonics_I3_THD',
        'U8_GW03_Voltage_AN',
        'U8_GW03_Voltage_BN',
        'U8_GW03_Voltage_CN',
        'U8_GW03_Voltage_LN_Avg',
        'U8_GW03_Voltage_Avg',
        'U8_GW03_Current_Avg',
        'U8_GW03_PowerFactor_Avg',
        'U8_GW03_Power_Phase_A',
        'U8_GW03_Power_Phase_B',
        'U8_GW03_Power_Phase_C',
      ],
      //U9_GW03
      'Unit_5.LT2.Ring Frame 13-15': [
        'U9_GW03_Voltage_AB',
        'U9_GW03_Voltage_BC',
        'U9_GW03_Voltage_CA',
        'U9_GW03_Current_A',
        'U9_GW03_Current_B',
        'U9_GW03_Current_C',
        'U9_GW03_PowerFactor_A',
        'U9_GW03_PowerFactor_B',
        'U9_GW03_PowerFactor_C',
        'U9_GW03_ActivePower_Total',
        'U9_GW03_ReactivePower_Total',
        'U9_GW03_ApparentPower_Total',
        'U9_GW03_Del_ActiveEnergy',
        'U9_GW03_Rec_Active_Energy',
        'U9_GW03_Harmonics_V1_THD',
        'U9_GW03_Harmonics_V2_THD',
        'U9_GW03_Harmonics_V3_THD',
        'U9_GW03_Harmonics_I1_THD',
        'U9_GW03_Harmonics_I2_THD',
        'U9_GW03_Harmonics_I3_THD',
        'U9_GW03_Voltage_AN',
        'U9_GW03_Voltage_BN',
        'U9_GW03_Voltage_CN',
        'U9_GW03_Voltage_LN_Avg',
        'U9_GW03_Voltage_Avg',
        'U9_GW03_Current_Avg',
        'U9_GW03_PowerFactor_Avg',
        'U9_GW03_Power_Phase_A',
        'U9_GW03_Power_Phase_B',
        'U9_GW03_Power_Phase_C',
      ],
      //U10_GW03
      'Unit_5.LT2.Auto Con 10-18': [
        'U10_GW03_Voltage_AB',
        'U10_GW03_Voltage_BC',
        'U10_GW03_Voltage_CA',
        'U10_GW03_Current_A',
        'U10_GW03_Current_B',
        'U10_GW03_Current_C',
        'U10_GW03_PowerFactor_A',
        'U10_GW03_PowerFactor_B',
        'U10_GW03_PowerFactor_C',
        'U10_GW03_ActivePower_Total',
        'U10_GW03_ReactivePower_Total',
        'U10_GW03_ApparentPower_Total',
        'U10_GW03_Del_ActiveEnergy',
        'U10_GW03_Rec_Active_Energy',
        'U10_GW03_Harmonics_V1_THD',
        'U10_GW03_Harmonics_V2_THD',
        'U10_GW03_Harmonics_V3_THD',
        'U10_GW03_Harmonics_I1_THD',
        'U10_GW03_Harmonics_I2_THD',
        'U10_GW03_Harmonics_I3_THD',
        'U10_GW03_Voltage_AN',
        'U10_GW03_Voltage_BN',
        'U10_GW03_Voltage_CN',
        'U10_GW03_Voltage_LN_Avg',
        'U10_GW03_Voltage_Avg',
        'U10_GW03_Current_Avg',
        'U10_GW03_PowerFactor_Avg',
        'U10_GW03_Power_Phase_A',
        'U10_GW03_Power_Phase_B',
        'U10_GW03_Power_Phase_C',
      ],
      //U11_GW03
      'Unit_5.LT2.Baling Press': [
        'U11_GW03_Voltage_AB',
        'U11_GW03_Voltage_BC',
        'U11_GW03_Voltage_CA',
        'U11_GW03_Current_A',
        'U11_GW03_Current_B',
        'U11_GW03_Current_C',
        'U11_GW03_PowerFactor_A',
        'U11_GW03_PowerFactor_B',
        'U11_GW03_PowerFactor_C',
        'U11_GW03_ActivePower_Total',
        'U11_GW03_ReactivePower_Total',
        'U11_GW03_ApparentPower_Total',
        'U11_GW03_Del_ActiveEnergy',
        'U11_GW03_Rec_Active_Energy',
        'U11_GW03_Harmonics_V1_THD',
        'U11_GW03_Harmonics_V2_THD',
        'U11_GW03_Harmonics_V3_THD',
        'U11_GW03_Harmonics_I1_THD',
        'U11_GW03_Harmonics_I2_THD',
        'U11_GW03_Harmonics_I3_THD',
        'U11_GW03_Voltage_AN',
        'U11_GW03_Voltage_BN',
        'U11_GW03_Voltage_CN',
        'U11_GW03_Voltage_LN_Avg',
        'U11_GW03_Voltage_Avg',
        'U11_GW03_Current_Avg',
        'U11_GW03_PowerFactor_Avg',
        'U11_GW03_Power_Phase_A',
        'U11_GW03_Power_Phase_B',
        'U11_GW03_Power_Phase_C',
      ],
      //U12_GW03
      'Unit_5.LT2.Ring Frame 16-18': [
        'U12_GW03_Voltage_AB',
        'U12_GW03_Voltage_BC',
        'U12_GW03_Voltage_CA',
        'U12_GW03_Current_A',
        'U12_GW03_Current_B',
        'U12_GW03_Current_C',
        'U12_GW03_PowerFactor_A',
        'U12_GW03_PowerFactor_B',
        'U12_GW03_PowerFactor_C',
        'U12_GW03_ActivePower_Total',
        'U12_GW03_ReactivePower_Total',
        'U12_GW03_ApparentPower_Total',
        'U12_GW03_Del_ActiveEnergy',
        'U12_GW03_Rec_Active_Energy',
        'U12_GW03_Harmonics_V1_THD',
        'U12_GW03_Harmonics_V2_THD',
        'U12_GW03_Harmonics_V3_THD',
        'U12_GW03_Harmonics_I1_THD',
        'U12_GW03_Harmonics_I2_THD',
        'U12_GW03_Harmonics_I3_THD',
        'U12_GW03_Voltage_AN',
        'U12_GW03_Voltage_BN',
        'U12_GW03_Voltage_CN',
        'U12_GW03_Voltage_LN_Avg',
        'U12_GW03_Voltage_Avg',
        'U12_GW03_Current_Avg',
        'U12_GW03_PowerFactor_Avg',
        'U12_GW03_Power_Phase_A',
        'U12_GW03_Power_Phase_B',
        'U12_GW03_Power_Phase_C',
      ],
      //U13_GW03
      'Unit_5.LT2.Fiber Deposit Plant': [
        'U13_GW03_Voltage_AB',
        'U13_GW03_Voltage_BC',
        'U13_GW03_Voltage_CA',
        'U13_GW03_Current_A',
        'U13_GW03_Current_B',
        'U13_GW03_Current_C',
        'U13_GW03_PowerFactor_A',
        'U13_GW03_PowerFactor_B',
        'U13_GW03_PowerFactor_C',
        'U13_GW03_ActivePower_Total',
        'U13_GW03_ReactivePower_Total',
        'U13_GW03_ApparentPower_Total',
        'U13_GW03_Del_ActiveEnergy',
        'U13_GW03_Rec_Active_Energy',
        'U13_GW03_Harmonics_V1_THD',
        'U13_GW03_Harmonics_V2_THD',
        'U13_GW03_Harmonics_V3_THD',
        'U13_GW03_Harmonics_I1_THD',
        'U13_GW03_Harmonics_I2_THD',
        'U13_GW03_Harmonics_I3_THD',
        'U13_GW03_Voltage_AN',
        'U13_GW03_Voltage_BN',
        'U13_GW03_Voltage_CN',
        'U13_GW03_Voltage_LN_Avg',
        'U13_GW03_Voltage_Avg',
        'U13_GW03_Current_Avg',
        'U13_GW03_PowerFactor_Avg',
        'U13_GW03_Power_Phase_A',
        'U13_GW03_Power_Phase_B',
        'U13_GW03_Power_Phase_C',
      ],
      //U14_GW03
      'Unit_5.LT2.MLDB2 Ring Con (Lighting)': [
        'U14_GW03_Voltage_AB',
        'U14_GW03_Voltage_BC',
        'U14_GW03_Voltage_CA',
        'U14_GW03_Current_A',
        'U14_GW03_Current_B',
        'U14_GW03_Current_C',
        'U14_GW03_PowerFactor_A',
        'U14_GW03_PowerFactor_B',
        'U14_GW03_PowerFactor_C',
        'U14_GW03_ActivePower_Total',
        'U14_GW03_ReactivePower_Total',
        'U14_GW03_ApparentPower_Total',
        'U14_GW03_Del_ActiveEnergy',
        'U14_GW03_Rec_Active_Energy',
        'U14_GW03_Harmonics_V1_THD',
        'U14_GW03_Harmonics_V2_THD',
        'U14_GW03_Harmonics_V3_THD',
        'U14_GW03_Harmonics_I1_THD',
        'U14_GW03_Harmonics_I2_THD',
        'U14_GW03_Harmonics_I3_THD',
        'U14_GW03_Voltage_AN',
        'U14_GW03_Voltage_BN',
        'U14_GW03_Voltage_CN',
        'U14_GW03_Voltage_LN_Avg',
        'U14_GW03_Voltage_Avg',
        'U14_GW03_Current_Avg',
        'U14_GW03_PowerFactor_Avg',
        'U14_GW03_Power_Phase_A',
        'U14_GW03_Power_Phase_B',
        'U14_GW03_Power_Phase_C',
      ],
      //U15_GW03
      'Unit_5.LT2.Deep Valve Turbine': [
        'U15_GW03_Voltage_AB',
        'U15_GW03_Voltage_BC',
        'U15_GW03_Voltage_CA',
        'U15_GW03_Current_A',
        'U15_GW03_Current_B',
        'U15_GW03_Current_C',
        'U15_GW03_PowerFactor_A',
        'U15_GW03_PowerFactor_B',
        'U15_GW03_PowerFactor_C',
        'U15_GW03_ActivePower_Total',
        'U15_GW03_ReactivePower_Total',
        'U15_GW03_ApparentPower_Total',
        'U15_GW03_Del_ActiveEnergy',
        'U15_GW03_Rec_Active_Energy',
        'U15_GW03_Harmonics_V1_THD',
        'U15_GW03_Harmonics_V2_THD',
        'U15_GW03_Harmonics_V3_THD',
        'U15_GW03_Harmonics_I1_THD',
        'U15_GW03_Harmonics_I2_THD',
        'U15_GW03_Harmonics_I3_THD',
        'U15_GW03_Voltage_AN',
        'U15_GW03_Voltage_BN',
        'U15_GW03_Voltage_CN',
        'U15_GW03_Voltage_LN_Avg',
        'U15_GW03_Voltage_Avg',
        'U15_GW03_Current_Avg',
        'U15_GW03_PowerFactor_Avg',
        'U15_GW03_Power_Phase_A',
        'U15_GW03_Power_Phase_B',
        'U15_GW03_Power_Phase_C',
      ],
      //U16_GW03
      'Unit_5.LT2.TF #2': [
        'U16_GW03_Voltage_AB',
        'U16_GW03_Voltage_BC',
        'U16_GW03_Voltage_CA',
        'U16_GW03_Current_A',
        'U16_GW03_Current_B',
        'U16_GW03_Current_C',
        'U16_GW03_PowerFactor_A',
        'U16_GW03_PowerFactor_B',
        'U16_GW03_PowerFactor_C',
        'U16_GW03_ActivePower_Total',
        'U16_GW03_ReactivePower_Total',
        'U16_GW03_ApparentPower_Total',
        'U16_GW03_Del_ActiveEnergy',
        'U16_GW03_Rec_Active_Energy',
        'U16_GW03_Harmonics_V1_THD',
        'U16_GW03_Harmonics_V2_THD',
        'U16_GW03_Harmonics_V3_THD',
        'U16_GW03_Harmonics_I1_THD',
        'U16_GW03_Harmonics_I2_THD',
        'U16_GW03_Harmonics_I3_THD',
        'U16_GW03_Voltage_AN',
        'U16_GW03_Voltage_BN',
        'U16_GW03_Voltage_CN',
        'U16_GW03_Voltage_LN_Avg',
        'U16_GW03_Voltage_Avg',
        'U16_GW03_Current_Avg',
        'U16_GW03_PowerFactor_Avg',
        'U16_GW03_Power_Phase_A',
        'U16_GW03_Power_Phase_B',
        'U16_GW03_Power_Phase_C',
      ],
      //U17_GW03
      'Unit_5.LT2.Solar 1066.985 kW': [
        'U17_GW03_Voltage_AB',
        'U17_GW03_Voltage_BC',
        'U17_GW03_Voltage_CA',
        'U17_GW03_Current_A',
        'U17_GW03_Current_B',
        'U17_GW03_Current_C',
        'U17_GW03_PowerFactor_A',
        'U17_GW03_PowerFactor_B',
        'U17_GW03_PowerFactor_C',
        'U17_GW03_ActivePower_Total',
        'U17_GW03_ReactivePower_Total',
        'U17_GW03_ApparentPower_Total',
        'U17_GW03_Del_ActiveEnergy',
        'U17_GW03_Rec_Active_Energy',
        'U17_GW03_Harmonics_V1_THD',
        'U17_GW03_Harmonics_V2_THD',
        'U17_GW03_Harmonics_V3_THD',
        'U17_GW03_Harmonics_I1_THD',
        'U17_GW03_Harmonics_I2_THD',
        'U17_GW03_Harmonics_I3_THD',
        'U17_GW03_Voltage_AN',
        'U17_GW03_Voltage_BN',
        'U17_GW03_Voltage_CN',
        'U17_GW03_Voltage_LN_Avg',
        'U17_GW03_Voltage_Avg',
        'U17_GW03_Current_Avg',
        'U17_GW03_PowerFactor_Avg',
        'U17_GW03_Power_Phase_A',
        'U17_GW03_Power_Phase_B',
        'U17_GW03_Power_Phase_C',
      ],
      //U18_GW03
      'Unit_5.LT2.PF Panel': [
        'U18_GW03_Voltage_AB',
        'U18_GW03_Voltage_BC',
        'U18_GW03_Voltage_CA',
        'U18_GW03_Current_A',
        'U18_GW03_Current_B',
        'U18_GW03_Current_C',
        'U18_GW03_PowerFactor_A',
        'U18_GW03_PowerFactor_B',
        'U18_GW03_PowerFactor_C',
        'U18_GW03_ActivePower_Total',
        'U18_GW03_ReactivePower_Total',
        'U18_GW03_ApparentPower_Total',
        'U18_GW03_Del_ActiveEnergy',
        'U18_GW03_Rec_Active_Energy',
        'U18_GW03_Harmonics_V1_THD',
        'U18_GW03_Harmonics_V2_THD',
        'U18_GW03_Harmonics_V3_THD',
        'U18_GW03_Harmonics_I1_THD',
        'U18_GW03_Harmonics_I2_THD',
        'U18_GW03_Harmonics_I3_THD',
        'U18_GW03_Voltage_AN',
        'U18_GW03_Voltage_BN',
        'U18_GW03_Voltage_CN',
        'U18_GW03_Voltage_LN_Avg',
        'U18_GW03_Voltage_Avg',
        'U18_GW03_Current_Avg',
        'U18_GW03_PowerFactor_Avg',
        'U18_GW03_Power_Phase_A',
        'U18_GW03_Power_Phase_B',
        'U18_GW03_Power_Phase_C',
      ],
      'Unit_5.LT2.PDB 07': [
        'U22_GW03_Voltage_AB',
        'U22_GW03_Voltage_BC',
        'U22_GW03_Voltage_CA',
        'U22_GW03_Current_A',
        'U22_GW03_Current_B',
        'U22_GW03_Current_C',
        'U22_GW03_PowerFactor_A',
        'U22_GW03_PowerFactor_B',
        'U22_GW03_PowerFactor_C',
        'U22_GW03_ActivePower_Total',
        'U22_GW03_ReactivePower_Total',
        'U22_GW03_ApparentPower_Total',
        'U22_GW03_Del_ActiveEnergy',
        'U22_GW03_Rec_Active_Energy',
        'U22_GW03_Harmonics_V1_THD',
        'U22_GW03_Harmonics_V2_THD',
        'U22_GW03_Harmonics_V3_THD',
        'U22_GW03_Harmonics_I1_THD',
        'U22_GW03_Harmonics_I2_THD',
        'U22_GW03_Harmonics_I3_THD',
        'U22_GW03_Voltage_AN',
        'U22_GW03_Voltage_BN',
        'U22_GW03_Voltage_CN',
        'U22_GW03_Voltage_LN_Avg',
        'U22_GW03_Voltage_Avg',
        'U22_GW03_Current_Avg',
        'U22_GW03_PowerFactor_Avg',
        'U22_GW03_Power_Phase_A',
        'U22_GW03_Power_Phase_B',
        'U22_GW03_Power_Phase_C',
      ],
      'Unit_5.LT2.PDB 10': [
        'U23_GW03_Voltage_AB',
        'U23_GW03_Voltage_BC',
        'U23_GW03_Voltage_CA',
        'U23_GW03_Current_A',
        'U23_GW03_Current_B',
        'U23_GW03_Current_C',
        'U23_GW03_PowerFactor_A',
        'U23_GW03_PowerFactor_B',
        'U23_GW03_PowerFactor_C',
        'U23_GW03_ActivePower_Total',
        'U23_GW03_ReactivePower_Total',
        'U23_GW03_ApparentPower_Total',
        'U23_GW03_Del_ActiveEnergy',
        'U23_GW03_Rec_Active_Energy',
        'U23_GW03_Harmonics_V1_THD',
        'U23_GW03_Harmonics_V2_THD',
        'U23_GW03_Harmonics_V3_THD',
        'U23_GW03_Harmonics_I1_THD',
        'U23_GW03_Harmonics_I2_THD',
        'U23_GW03_Harmonics_I3_THD',
        'U23_GW03_Voltage_AN',
        'U23_GW03_Voltage_BN',
        'U23_GW03_Voltage_CN',
        'U23_GW03_Voltage_LN_Avg',
        'U23_GW03_Voltage_Avg',
        'U23_GW03_Current_Avg',
        'U23_GW03_PowerFactor_Avg',
        'U23_GW03_Power_Phase_A',
        'U23_GW03_Power_Phase_B',
        'U23_GW03_Power_Phase_C',
      ],
      'Unit_5.Unit 5 HT Room': ['T/F 2', 'T/F 1', 'Main Incoming (Unit 5)'],
      'Unit_5.Unit 5 HT Room.T/F 2': [
        'U19_GW03_Voltage_AB',
        'U19_GW03_Voltage_BC',
        'U19_GW03_Voltage_CA',
        'U19_GW03_Current_A',
        'U19_GW03_Current_B',
        'U19_GW03_Current_C',
        'U19_GW03_PowerFactor_A',
        'U19_GW03_PowerFactor_B',
        'U19_GW03_PowerFactor_C',
        'U19_GW03_ActivePower_Total',
        'U19_GW03_ReactivePower_Total',
        'U19_GW03_ApparentPower_Total',
        'U19_GW03_Del_ActiveEnergy',
        'U19_GW03_Rec_Active_Energy',
        'U19_GW03_Harmonics_V1_THD',
        'U19_GW03_Harmonics_V2_THD',
        'U19_GW03_Harmonics_V3_THD',
        'U19_GW03_Harmonics_I1_THD',
        'U19_GW03_Harmonics_I2_THD',
        'U19_GW03_Harmonics_I3_THD',
        'U19_GW03_Voltage_AN',
        'U19_GW03_Voltage_BN',
        'U19_GW03_Voltage_CN',
        'U19_GW03_Voltage_LN_Avg',
        'U19_GW03_Voltage_Avg',
        'U19_GW03_Current_Avg',
        'U19_GW03_PowerFactor_Avg',
        'U19_GW03_Power_Phase_A',
        'U19_GW03_Power_Phase_B',
        'U19_GW03_Power_Phase_C',
      ],
      'Unit_5.Unit 5 HT Room.T/F 1': [
        'U20_GW03_Voltage_AB',
        'U20_GW03_Voltage_BC',
        'U20_GW03_Voltage_CA',
        'U20_GW03_Current_A',
        'U20_GW03_Current_B',
        'U20_GW03_Current_C',
        'U20_GW03_PowerFactor_A',
        'U20_GW03_PowerFactor_B',
        'U20_GW03_PowerFactor_C',
        'U20_GW03_ActivePower_Total',
        'U20_GW03_ReactivePower_Total',
        'U20_GW03_ApparentPower_Total',
        'U20_GW03_Del_ActiveEnergy',
        'U20_GW03_Rec_Active_Energy',
        'U20_GW03_Harmonics_V1_THD',
        'U20_GW03_Harmonics_V2_THD',
        'U20_GW03_Harmonics_V3_THD',
        'U20_GW03_Harmonics_I1_THD',
        'U20_GW03_Harmonics_I2_THD',
        'U20_GW03_Harmonics_I3_THD',
        'U20_GW03_Voltage_AN',
        'U20_GW03_Voltage_BN',
        'U20_GW03_Voltage_CN',
        'U20_GW03_Voltage_LN_Avg',
        'U20_GW03_Voltage_Avg',
        'U20_GW03_Current_Avg',
        'U20_GW03_PowerFactor_Avg',
        'U20_GW03_Power_Phase_A',
        'U20_GW03_Power_Phase_B',
        'U20_GW03_Power_Phase_C',
      ],
      'Unit_5.Unit 5 HT Room.Main Incoming (Unit 5)': [
        'U21_GW03_Voltage_AB',
        'U21_GW03_Voltage_BC',
        'U21_GW03_Voltage_CA',
        'U21_GW03_Current_A',
        'U21_GW03_Current_B',
        'U21_GW03_Current_C',
        'U21_GW03_PowerFactor_A',
        'U21_GW03_PowerFactor_B',
        'U21_GW03_PowerFactor_C',
        'U21_GW03_ActivePower_Total',
        'U21_GW03_ReactivePower_Total',
        'U21_GW03_ApparentPower_Total',
        'U21_GW03_Del_ActiveEnergy',
        'U21_GW03_Rec_Active_Energy',
        'U21_GW03_Harmonics_V1_THD',
        'U21_GW03_Harmonics_V2_THD',
        'U21_GW03_Harmonics_V3_THD',
        'U21_GW03_Harmonics_I1_THD',
        'U21_GW03_Harmonics_I2_THD',
        'U21_GW03_Harmonics_I3_THD',
        'U21_GW03_Voltage_AN',
        'U21_GW03_Voltage_BN',
        'U21_GW03_Voltage_CN',
        'U21_GW03_Voltage_LN_Avg',
        'U21_GW03_Voltage_Avg',
        'U21_GW03_Current_Avg',
        'U21_GW03_PowerFactor_Avg',
        'U21_GW03_Power_Phase_A',
        'U21_GW03_Power_Phase_B',
        'U21_GW03_Power_Phase_C',
      ],
      HFO: ['HFO'],
      'HFO.HFO': ['HFO1', 'O/G 2 (Unit 5)', 'O/G 1 (Unit 4)', 'HFO AUX', 'I-GG', 'WAPDA 2'],
      'HFO.HFO.HFO1': [
        'U22_PLC_Voltage_AB',
        'U22_PLC_Voltage_BC',
        'U22_PLC_Voltage_CA',
        'U22_PLC_Current_A',
        'U22_PLC_Current_B',
        'U22_PLC_Current_C',
        'U22_PLC_PowerFactor_A',
        'U22_PLC_PowerFactor_B',
        'U22_PLC_PowerFactor_C',
        'U22_PLC_ActivePower_Total',
        'U22_PLC_ReactivePower_Total',
        'U22_PLC_ApparentPower_Total',
        'U22_PLC_Del_ActiveEnergy',
        'U22_PLC_ActiveEnergy_Exp_kWh',
        'U22_PLC_ActiveEnergy_Imp_kWh',
        'U22_PLC_Frequency_Hz',
        'U22_PLC_Harmonics_V1_THD',
        'U22_PLC_Harmonics_V2_THD',
        'U22_PLC_Harmonics_V3_THD',
        'U22_PLC_Harmonics_I1_THD',
        'U22_PLC_Harmonics_I2_THD',
        'U22_PLC_Harmonics_I3_THD',
        'U22_PLC_Voltage_AN',
        'U22_PLC_Voltage_BN',
        'U22_PLC_Voltage_CN',
        'U22_PLC_Voltage_LN_Avg',
        'U22_PLC_Voltage_Avg',
        'U22_PLC_Current_Avg',
        'U22_PLC_PowerFactor_Avg',
        'U22_PLC_Power_Phase_A',
        'U22_PLC_Power_Phase_B',
        'U22_PLC_Power_Phase_C',
      ],
      'HFO.HFO.O/G 2 (Unit 5)': [
        'U23_PLC_Voltage_AB',
        'U23_PLC_Voltage_BC',
        'U23_PLC_Voltage_CA',
        'U23_PLC_Current_A',
        'U23_PLC_Current_B',
        'U23_PLC_Current_C',
        'U23_PLC_PowerFactor_A',
        'U23_PLC_PowerFactor_B',
        'U23_PLC_PowerFactor_C',
        'U23_PLC_ActivePower_Total',
        'U23_PLC_ReactivePower_Total',
        'U23_PLC_ApparentPower_Total',
        'U23_PLC_Del_ActiveEnergy',
        'U23_PLC_ActiveEnergy_Exp_kWh',
        'U23_PLC_ActiveEnergy_Imp_kWh',
        'U23_PLC_Frequency_Hz',
        'U23_PLC_Harmonics_V1_THD',
        'U23_PLC_Harmonics_V2_THD',
        'U23_PLC_Harmonics_V3_THD',
        'U23_PLC_Harmonics_I1_THD',
        'U23_PLC_Harmonics_I2_THD',
        'U23_PLC_Harmonics_I3_THD',
        'U23_PLC_Voltage_AN',
        'U23_PLC_Voltage_BN',
        'U23_PLC_Voltage_CN',
        'U23_PLC_Voltage_LN_Avg',
        'U23_PLC_Voltage_Avg',
        'U23_PLC_Current_Avg',
        'U23_PLC_PowerFactor_Avg',
        'U23_PLC_Power_Phase_A',
        'U23_PLC_Power_Phase_B',
        'U23_PLC_Power_Phase_C',
      ],
      'HFO.HFO.O/G 1 (Unit 4)': [
        'U24_PLC_Voltage_AB',
        'U24_PLC_Voltage_BC',
        'U24_PLC_Voltage_CA',
        'U24_PLC_Current_A',
        'U24_PLC_Current_B',
        'U24_PLC_Current_C',
        'U24_PLC_PowerFactor_A',
        'U24_PLC_PowerFactor_B',
        'U24_PLC_PowerFactor_C',
        'U24_PLC_ActivePower_Total',
        'U24_PLC_ReactivePower_Total',
        'U24_PLC_ApparentPower_Total',
        'U24_PLC_Del_ActiveEnergy',
        'U24_PLC_ActiveEnergy_Exp_kWh',
        'U24_PLC_ActiveEnergy_Imp_kWh',
        'U24_PLC_Frequency_Hz',
        'U24_PLC_Harmonics_V1_THD',
        'U24_PLC_Harmonics_V2_THD',
        'U24_PLC_Harmonics_V3_THD',
        'U24_PLC_Harmonics_I1_THD',
        'U24_PLC_Harmonics_I2_THD',
        'U24_PLC_Harmonics_I3_THD',
        'U24_PLC_Voltage_AN',
        'U24_PLC_Voltage_BN',
        'U24_PLC_Voltage_CN',
        'U24_PLC_Voltage_LN_Avg',
        'U24_PLC_Voltage_Avg',
        'U24_PLC_Current_Avg',
        'U24_PLC_PowerFactor_Avg',
        'U24_PLC_Power_Phase_A',
        'U24_PLC_Power_Phase_B',
        'U24_PLC_Power_Phase_C',
      ],
      'HFO.HFO.HFO AUX': [
        'U25_PLC_Voltage_AB',
        'U25_PLC_Voltage_BC',
        'U25_PLC_Voltage_CA',
        'U25_PLC_Current_A',
        'U25_PLC_Current_B',
        'U25_PLC_Current_C',
        'U25_PLC_PowerFactor_A',
        'U25_PLC_PowerFactor_B',
        'U25_PLC_PowerFactor_C',
        'U25_PLC_ActivePower_Total',
        'U25_PLC_ReactivePower_Total',
        'U25_PLC_ApparentPower_Total',
        'U25_PLC_Del_ActiveEnergy',
        'U25_PLC_ActiveEnergy_Exp_kWh',
        'U25_PLC_ActiveEnergy_Imp_kWh',
        'U25_PLC_Frequency_Hz',
        'U25_PLC_Harmonics_V1_THD',
        'U25_PLC_Harmonics_V2_THD',
        'U25_PLC_Harmonics_V3_THD',
        'U25_PLC_Harmonics_I1_THD',
        'U25_PLC_Harmonics_I2_THD',
        'U25_PLC_Harmonics_I3_THD',
        'U25_PLC_Voltage_AN',
        'U25_PLC_Voltage_BN',
        'U25_PLC_Voltage_CN',
        'U25_PLC_Voltage_LN_Avg',
        'U25_PLC_Voltage_Avg',
        'U25_PLC_Current_Avg',
        'U25_PLC_PowerFactor_Avg',
        'U25_PLC_Power_Phase_A',
        'U25_PLC_Power_Phase_B',
        'U25_PLC_Power_Phase_C',
      ],
      'HFO.HFO.I-GG': [
        'U26_PLC_Voltage_AB',
        'U26_PLC_Voltage_BC',
        'U26_PLC_Voltage_CA',
        'U26_PLC_Current_A',
        'U26_PLC_Current_B',
        'U26_PLC_Current_C',
        'U26_PLC_PowerFactor_A',
        'U26_PLC_PowerFactor_B',
        'U26_PLC_PowerFactor_C',
        'U26_PLC_ActivePower_Total',
        'U26_PLC_ReactivePower_Total',
        'U26_PLC_ApparentPower_Total',
        'U26_PLC_Del_ActiveEnergy',
        'U26_PLC_ActiveEnergy_Exp_kWh',
        'U26_PLC_ActiveEnergy_Imp_kWh',
        'U26_PLC_Frequency_Hz',
        'U26_PLC_Harmonics_V1_THD',
        'U26_PLC_Harmonics_V2_THD',
        'U26_PLC_Harmonics_V3_THD',
        'U26_PLC_Harmonics_I1_THD',
        'U26_PLC_Harmonics_I2_THD',
        'U26_PLC_Harmonics_I3_THD',
        'U26_PLC_Voltage_AN',
        'U26_PLC_Voltage_BN',
        'U26_PLC_Voltage_CN',
        'U26_PLC_Voltage_LN_Avg',
        'U26_PLC_Voltage_Avg',
        'U26_PLC_Current_Avg',
        'U26_PLC_PowerFactor_Avg',
        'U26_PLC_Power_Phase_A',
        'U26_PLC_Power_Phase_B',
        'U26_PLC_Power_Phase_C',
      ],
      'HFO.HFO.WAPDA 2': [
        'U27_PLC_Voltage_AB',
        'U27_PLC_Voltage_BC',
        'U27_PLC_Voltage_CA',
        'U27_PLC_Current_A',
        'U27_PLC_Current_B',
        'U27_PLC_Current_C',
        'U27_PLC_PowerFactor_A',
        'U27_PLC_PowerFactor_B',
        'U27_PLC_PowerFactor_C',
        'U27_PLC_ActivePower_Total',
        'U27_PLC_ReactivePower_Total',
        'U27_PLC_ApparentPower_Total',
        'U27_PLC_Del_ActiveEnergy',
        'U27_PLC_ActiveEnergy_Exp_kWh',
        'U27_PLC_ActiveEnergy_Imp_kWh',
        'U27_PLC_Frequency_Hz',
        'U27_PLC_Harmonics_V1_THD',
        'U27_PLC_Harmonics_V2_THD',
        'U27_PLC_Harmonics_V3_THD',
        'U27_PLC_Harmonics_I1_THD',
        'U27_PLC_Harmonics_I2_THD',
        'U27_PLC_Harmonics_I3_THD',
        'U27_PLC_Voltage_AN',
        'U27_PLC_Voltage_BN',
        'U27_PLC_Voltage_CN',
        'U27_PLC_Voltage_LN_Avg',
        'U27_PLC_Voltage_Avg',
        'U27_PLC_Current_Avg',
        'U27_PLC_PowerFactor_Avg',
        'U27_PLC_Power_Phase_A',
        'U27_PLC_Power_Phase_B',
        'U27_PLC_Power_Phase_C',
      ],
    };
  }

  async getAlarmsTypeName(): Promise<string[]> {
    const alarmsType = await this.alarmTypeModel
      .find({}, { type: 1, _id: 0 })
      .exec();
    return alarmsType.map((alarm) => alarm.type);
  }

  getIntervals(): number[] {
    return this.intervalsSec;
  }

  getTime(): number[] {
    return this.Time;
  }

  /**
   * Get the list of sub-locations.
   * @returns Array of sub-location strings.
   */

  /**
   * Add a new alarm type.
   * @param dto The data transfer object containing alarm type details.
   * @returns The created alarm type.
   */
  async addAlarmType(dto: AlarmsTypeDto) {
    // 🔹 Force uppercase on name (or whatever field you mean)
    if (dto.type) {
      dto.type = dto.type.toUpperCase();
    }

    const alarmType = new this.alarmTypeModel(dto);
    await alarmType.save();

    return {
      message: 'Alarm Type added successfully',
      data: alarmType,
    };
  }

  /**
   * Get all alarm types.
   * @returns Array of alarm types.
   */
  async getAllAlarmTypes() {
    return this.alarmTypeModel.find().exec();
  }

  /**
   * Update an existing alarm type.
   * @param id The ID of the alarm type to update.
   * @param dto The data transfer object containing updated alarm type details.
   * @returns The updated alarm type.
   */
  async updateAlarmType(id: string, dto: AlarmsTypeDto) {
    if (dto.type) {
      dto.type = dto.type.toUpperCase();
    }

    const updated = await this.alarmTypeModel.findByIdAndUpdate(id, dto, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      throw new NotFoundException(`Alarm Type with ID ${id} not found`);
    }

    return {
      message: 'Alarm Type updated successfully',
      data: updated,
    };
  }

  /**
   * Update an existing alarm.
   * @param dto The data transfer object containing updated alarm details.
   * @returns The updated alarm.
   */

  async updateAlarm(dto: UpdateAlarmDto) {
    const {
      alarmConfigId,
      alarmTriggerConfig,
      alarmTypeId,
      ...restUpdateData
    } = dto;

    // 1️⃣ Validate alarmConfigId
    if (!Types.ObjectId.isValid(alarmConfigId)) {
      throw new BadRequestException('Invalid alarmConfigId');
    }

    // 2️⃣ Fetch existing alarm
    const existingAlarm = await this.alarmsModel.findById(alarmConfigId);
    if (!existingAlarm) {
      throw new NotFoundException(`Alarm with ID ${alarmConfigId} not found`);
    }

    const updateData: any = { ...restUpdateData };

    // 3️⃣ Handle alarmTypeId
    if (alarmTypeId) {
      if (!Types.ObjectId.isValid(alarmTypeId)) {
        throw new BadRequestException('Invalid alarmTypeId');
      }
      updateData.alarmTypeId = new Types.ObjectId(alarmTypeId);
    }

    // 4️⃣ Handle alarmTriggerConfig (update existing instead of creating new)
    if (alarmTriggerConfig) {
      if (typeof alarmTriggerConfig === 'object') {
        // Pick _id from DTO or fallback to existing alarm's ruleset
        const rulesetId =
          alarmTriggerConfig._id?.toString() ??
          existingAlarm.alarmTriggerConfig?.toString();

        if (rulesetId && Types.ObjectId.isValid(rulesetId)) {
          const { thresholds, ...restRuleset } = alarmTriggerConfig;

          // Build update object
          const rulesetUpdate: any = { ...restRuleset };
          if (Array.isArray(thresholds)) {
            // overwrite thresholds instead of merging
            rulesetUpdate.thresholds = thresholds;
          }

          // Update existing ruleset
          await this.alarmsRulesSetModel.findByIdAndUpdate(
            rulesetId,
            { $set: rulesetUpdate },
            { new: true },
          );

          updateData.alarmTriggerConfig = new Types.ObjectId(rulesetId);
        } else {
          throw new BadRequestException(
            'No valid ruleset found for this alarmConfig',
          );
        }
      } else if (Types.ObjectId.isValid(alarmTriggerConfig)) {
        updateData.alarmTriggerConfig = new Types.ObjectId(alarmTriggerConfig);
      } else {
        throw new BadRequestException('Invalid alarmTriggerConfig');
      }
    }

    // 5️⃣ Perform update
    const updated = await this.alarmsModel
      .findByIdAndUpdate(alarmConfigId, { $set: updateData }, { new: true })
      .populate('alarmTypeId')
      .populate('alarmTriggerConfig')
      .lean();

    if (!updated) {
      throw new NotFoundException(
        `Alarm with ID ${alarmConfigId} could not be updated`,
      );
    }

    // 6️⃣ Ensure previous values are preserved in response if missing
    if (!updated.alarmTypeId) {
      updated.alarmTypeId = existingAlarm.alarmTypeId;
    }
    if (!updated.alarmTriggerConfig) {
      updated.alarmTriggerConfig = existingAlarm.alarmTriggerConfig;
    }

    return {
      message: 'Alarm updated successfully',
      data: updated,
    };
  }

  /**
   * Delete an existing alarm.
   * @param alarmConfigId The ID of the alarm to delete.
   * @returns A message indicating the result of the deletion.
   */

  async deleteAlarmByConfigId(alarmConfigId: string) {
    if (!Types.ObjectId.isValid(alarmConfigId)) {
      throw new BadRequestException('Invalid AlarmConfigId');
    }

    const objectId = new Types.ObjectId(alarmConfigId);

    // 🔎 First check if any event/occurrence exists for this config
    const existingEvent = await this.alarmsEventModel
      .findOne({ alarmConfigId: objectId })
      .populate('alarmOccurrences')
      .lean();

    if (existingEvent && existingEvent.alarmOccurrences?.length > 0) {
      throw new BadRequestException(
        `Cannot delete: AlarmConfig has ${existingEvent.alarmOccurrences.length} related occurrences`,
      );
    }

    const deleted = await this.alarmsModel.findByIdAndDelete(objectId).lean();

    if (!deleted) {
      throw new NotFoundException(`Alarm with ID ${alarmConfigId} not found`);
    }

    return {
      message: 'Alarm Configuration deleted successfully',
      data: deleted,
    };
  }

  /**
   * Delete an existing alarm type.
   * @param id The ID of the alarm type to delete.
   * @returns A message indicating the result of the deletion.
   */
  async deleteAlarmType(id: string) {
    const objectId = new Types.ObjectId(id);
    const relatedAlarms = await this.alarmsModel
      .find({ alarmTypeId: objectId })
      .select('alarmName')
      .lean();

    if (relatedAlarms.length > 0) {
      throw new BadRequestException({
        message: `Cannot delete AlarmType. It is used in ${relatedAlarms.length} alarms.`,
        count: relatedAlarms.length,
        alarms: relatedAlarms.map((a) => a.alarmName),
      });
    }
    // console.log('alarms with type');
    // 2. Check if any alarms reference this alarmType
    const alarmsWithType = await this.alarmsModel.findOne({ alarmTypeId: id });
    if (alarmsWithType) {
      return {
        error: 404,
        message: `Cannot delete: alarms exist with this alarm type.`,
        data: null,
      };
    }

    // 3. Delete if safe
    const deleted = await this.alarmTypeModel.findByIdAndDelete(id);

    return {
      message: 'Alarm Type deleted successfully',
      data: deleted,
    };
  }

  /**
   * Add a new alarm.
   * @param dto The data transfer object containing alarm details.
   * @returns The created alarm.
   */
  async addAlarm(dto: ConfigAlarmDto) {
    // console.log(dto);
    // 1️⃣ Save ruleset separately
    const ruleset = new this.alarmsRulesSetModel(dto.alarmTriggerConfig);
    await ruleset.save();

    // 2️⃣ Create alarm with correct ObjectIds
    const alarm = new this.alarmsModel({
      ...dto,
      alarmTypeId: new Types.ObjectId(dto.alarmTypeId), // ✅ force ObjectId
      alarmTriggerConfig: ruleset._id, // ✅ ObjectId from saved ruleset
    });
    // console.log(alarm);
    await alarm.save();

    return {
      message: 'Alarm added successfully',
      data: alarm,
    };
  }

  /**
   * Get alarms by type.
   * @param alarmTypeId The ID of the alarm type to retrieve alarms for.
   * @returns An object containing a message and the array of alarms.
   */
  async getAlarmsByType(alarmTypeId: string): Promise<{
    message: string;
    data: (alarmsConfiguration & {
      alarmTypeId: AlarmsType;
      alarmTriggerConfig: AlarmRulesSet;
    })[];
  }> {
    const alarms = await this.alarmsModel
      .find({ alarmTypeId: new Types.ObjectId(alarmTypeId) })
      .populate<{ alarmTypeId: AlarmsType }>('alarmTypeId')
      .populate<{ alarmTriggerConfig: AlarmRulesSet }>('alarmTriggerConfig')
      .lean()
      .exec();

    if (!alarms || alarms.length === 0) {
      throw new NotFoundException(`No alarms found for typeId ${alarmTypeId}`);
    }

    return {
      message: 'Alarms fetched successfully',
      data: alarms as unknown as (alarmsConfiguration & {
        alarmTypeId: AlarmsType;
        alarmTriggerConfig: AlarmRulesSet;
      })[],
    };
  }

  /**
   * Get the alarm type associated with a specific alarm.
   * @param alarmId The ID of the alarm to retrieve the type for.
   * @returns An object containing a message and the alarm type.
   */
  async getAlarmTypeByAlarmId(
    alarmId: string,
  ): Promise<{ message: string; data: AlarmsType }> {
    const alarm = await this.alarmsModel
      .findById(alarmId)
      .populate<{ alarmTypeId: AlarmsType }>('alarmTypeId')
      .lean()
      .exec();

    if (!alarm) {
      throw new NotFoundException(`Alarm with ID ${alarmId} not found`);
    }

    if (!alarm.alarmTypeId) {
      throw new NotFoundException(`AlarmType not found for alarmId ${alarmId}`);
    }

    return {
      message: 'AlarmType fetched successfully',
      data: alarm.alarmTypeId as AlarmsType,
    };
  }

  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number,
  ): boolean {
    switch (operator) {
      case '>':
        return value > threshold;
      case '<':
        return value < threshold;
      case '>=':
        return value >= threshold;
      case '<=':
        return value <= threshold;
      case '==':
        return value === threshold;
      case '!=':
        return value !== threshold;
      default:
        return false;
    }
  }

  private evaluateRules(value: number, rules: AlarmRulesSet): boolean {
    if (!rules || !Array.isArray(rules.thresholds) || !rules.thresholds.length)
      return false;

    const results = rules.thresholds.map((rule) =>
      this.evaluateCondition(value, rule.operator, rule.value),
    );

    if (rules.conditionType === '&&') return results.every(Boolean);
    if (rules.conditionType === '||') return results.some(Boolean);
    return results[0] ?? false;
  }

  /**
   * Return the first threshold subdocument that matches the value (or undefined).
   */
  private getTriggeredThreshold(
    value: number,
    rules: AlarmRulesSet,
  ): ThresholdCondition | null {
    if (!rules || !rules.thresholds) return null;
    return (
      rules.thresholds.find((t) => {
        switch (t.operator) {
          case '>':
            return value > t.value;
          case '<':
            return value < t.value;
          case '>=':
            return value >= t.value;
          case '<=':
            return value <= t.value;
          case '==':
            return value === t.value;
          case '!=':
            return value !== t.value;
          default:
            return false;
        }
      }) ?? null
    );
  }

  private async generateCustomAlarmId(): Promise<string | null> {
    // Get last occurrence sorted by alarmID
    const last = await this.alarmOccurrenceModel
      .findOne({}, { alarmID: 1 })
      .sort({ createdAt: -1 })
      .lean();

    if (!last || !last.alarmID) {
      return 'ALM01-001'; // First ever alarm
    }

    const match = last.alarmID.match(/ALM(\d+)-(\d+)/);

    if (!match) {
      // agar purane format wali ID milti hai (ALM_configId_timestamp)
      // to phir se naya sequence shuru karo
      return 'ALM01-001';
    }

    const [, majorStr, minorStr] = match;
    let major = parseInt(majorStr, 10);
    let minor = parseInt(minorStr, 10);

    minor++;

    if (minor > 999) {
      minor = 1;
      major++;
    }

    if (major > 99) {
      return null; // 🚫 limit reached, no more alarms allowed
    }

    const newMajor = major.toString().padStart(2, '0');
    const newMinor = minor.toString().padStart(3, '0');

    return `ALM${newMajor}-${newMinor}`;
  }

  /**
   * Upsert an active alarm event for the given alarm configuration.
   * If an active event exists it will be updated (count, lastOccurrence, recentOccurrences).
   * Otherwise a new alarm event document will be created.
   */
  private async upsertTriggeredAlarm(
    alarmConfig: AlarmConfigWithPopulate,
    rules: AlarmRulesSet,
    value: number,
  ): Promise<{ event: any; occurrence: AlarmsOccurrenceDocument } | null> {
    const now = new Date();
    const configId = alarmConfig._id;

    const triggered = this.getTriggeredThreshold(value, rules);
    if (!triggered) return null;

    // Step 0: Check if there's an active occurrence
    let occurrence = await this.alarmOccurrenceModel.findOne({
      alarmConfigId: configId,
      alarmStatus: true, // only active occurrences
    });

    let isNewOccurrence = false;

    if (!occurrence) {
      // Step 1: Create a new occurrence
      const customId = await this.generateCustomAlarmId();
      if (!customId) throw new Error('Alarm ID limit reached (ALM99-999)');

      occurrence = await this.alarmOccurrenceModel.create({
        alarmID: customId,
        date: now,
        alarmConfigId: configId,
        alarmRulesetId: rules._id,
        alarmTypeId: alarmConfig.alarmTypeId?._id,
        alarmAcknowledgeStatus: 'Unacknowledged',
        alarmAcknowledgmentAction: '',
        alarmAcknowledgedBy: null,
        alarmAcknowledgedDelay: 0,
        alarmAge: 0,
        alarmDuration: 0,
        alarmAcknowledgmentType: alarmConfig.alarmTypeId?.acknowledgeType,
        alarmSnooze: false,
        snoozeAt: null,
        snoozeDuration: null,
        alarmPresentValue: value,
        alarmThresholdValue: triggered.value,
        alarmThresholdOperator: triggered.operator,
        alarmStatus: true,
        createdAt: now,
        updatedAt: now,
      });

      isNewOccurrence = true;
    } else {
      // Step 2: Update existing occurrence
      occurrence.alarmPresentValue = value;
      occurrence.alarmThresholdValue = triggered.value;
      occurrence.alarmThresholdOperator = triggered.operator;

      // Update duration if needed
      occurrence.alarmDuration = now.getTime() - occurrence.date.getTime();
      occurrence.updatedAt = now;

      await occurrence.save();
    }

    // Step 3: Update / upsert the event
    const eventUpdate: any = {
      $set: { alarmLastOccurrence: now },
      $setOnInsert: { alarmFirstOccurrence: now },
      $addToSet: { alarmOccurrences: occurrence._id },
    };

    if (isNewOccurrence) {
      eventUpdate.$inc = { alarmOccurrenceCount: 1 };
    }

    const event = await this.alarmsEventModel.findOneAndUpdate(
      { alarmConfigId: configId },
      eventUpdate,
      { new: true, upsert: true },
    );

    return { event, occurrence };
  }

  /**
   * Deactivate any currently active alarm events whose config IDs are not in the provided set.
   */
  async deactivateResolvedAlarms(activeConfigIds: Set<string>) {
    const now = new Date();

    const activeEvents = await this.alarmsEventModel
      .find({}) // no alarmStatus here
      .populate({
        path: 'alarmOccurrences',
        model: AlarmOccurrence.name,
        match: { alarmStatus: true }, // ✅ only pull active ones
      })
      .exec();

    for (const ev of activeEvents) {
      const cfgId = ev.alarmConfigId?.toString?.() ?? '';

      if (!activeConfigIds.has(cfgId)) {
        ev.alarmLastOccurrence = now;

        if (ev.alarmFirstOccurrence) {
          const durationSec = Math.floor(
            (now.getTime() - new Date(ev.alarmFirstOccurrence).getTime()) /
              1000,
          );

          if (ev.alarmOccurrences?.length) {
            const lastOccurrence =
              ev.alarmOccurrences[ev.alarmOccurrences.length - 1];
            const lastOccurrenceId = lastOccurrence._id ?? lastOccurrence; // handle both populated and non-populated cases

            try {
              await this.alarmOccurrenceModel.findByIdAndUpdate(
                lastOccurrenceId,
                {
                  alarmStatus: false,
                  alarmDuration: durationSec,
                },
              );
            } catch (err) {
              console.error(
                '⚠ Failed to update occurrence duration:',
                err?.message ?? err,
              );
            }
          }
        }

        await ev.save();
      }
    }
  }

  /**
   * Process active alarms by fetching real-time data and evaluating alarm conditions.
   * @returns An array of triggered alarm events.
   */
  async processActiveAlarms() {
    // console.log('Processing active alarms...');
    const resp = await firstValueFrom(
      this.httpService.get('http://43.204.118.114:6881/surajcotton'),
    );
    const payload = resp.data as Record<string, unknown>;
    // console.log(payload);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('No data from Node-RED');
    }

    const alarms = (await this.alarmsModel
      .find()
      .populate<{ alarmTriggerConfig: AlarmRulesSet }>('alarmTriggerConfig')
      .populate<{ alarmTypeId: AlarmsType }>('alarmTypeId')
      .exec()) as unknown as AlarmConfigWithPopulate[];

    const triggeredAlarms: Array<any> = [];
    const activeConfigIds = new Set<string>();

    for (const alarm of alarms) {
      const key = Object.keys(payload).find((k) => {
        // console.log('Checking key:', k);
        const parts = k.toLowerCase();
        // console.log('Parts:', parts);
        return (
          parts === alarm.alarmParameter.toLowerCase() // exact parameter match
        );
      });

      if (!key) continue;

      const value = Number(payload[key]);
      // console.log(`Alarm check for ${key}: value=${value}`);
      const rules = alarm.alarmTriggerConfig;
      if (!rules || !rules.thresholds?.length) continue;

      const triggered = this.getTriggeredThreshold(value, rules);

      // inside processActiveAlarms loop, when !triggered:
      if (!triggered) {
        const now = new Date();
        // fetch the active occurrence to get its start time
        const activeOccurrence = await this.alarmOccurrenceModel
          .findOne({ alarmConfigId: alarm._id, alarmStatus: true })
          .sort({ date: -1 }); // in case you ever have more than one

        if (activeOccurrence) {
          const durationSec = Math.floor(
            (now.getTime() - new Date(activeOccurrence.date).getTime()) / 1000,
          );

          await this.alarmOccurrenceModel.updateOne(
            { _id: activeOccurrence._id },
            {
              $set: {
                alarmStatus: false,
                alarmDuration: durationSec,
                updatedAt: now,
              },
            },
          );

          await this.alarmsEventModel.updateOne(
            { alarmConfigId: alarm._id },
            { $set: { alarmLastOccurrence: now } },
          );
        }

        continue;
      }

      const result = await this.upsertTriggeredAlarm(alarm, rules, value);
      if (!result) continue;

      const { event, occurrence } = result;
      activeConfigIds.add(alarm._id.toString());

      triggeredAlarms.push({
        alarmOccurenceId: occurrence._id,
        alarmId: occurrence.alarmID,
        alarmStatus: occurrence.alarmStatus,
        alarmName: alarm.alarmName,
        Location: alarm.alarmLocation,
        subLocation: alarm.alarmSubLocation,
        device: alarm.alarmDevice,
        parameter: alarm.alarmParameter,
        value,
        threshold: triggered,
        triggeredAt: occurrence.date,
        alarmType: alarm.alarmTypeId?.type,
        priority: alarm.alarmTypeId?.priority,
        color: alarm.alarmTypeId?.color,
        code: alarm.alarmTypeId?.code,
        alarmSnoozeStatus: occurrence.alarmSnooze,
        alarmSnoozeDuration: occurrence.snoozeDuration,
        alarmSnoozeAt: occurrence.snoozeAt,
      });
    }

    await this.deactivateResolvedAlarms(activeConfigIds);

    return triggeredAlarms;
  }

  async gethistoricalAlarms(filters: any = {}) {
    const match: any = {};

    if (filters.alarmAcknowledgeStatus) {
      match['alarmOccurrences.alarmAcknowledgeStatus'] =
        filters.alarmAcknowledgeStatus;
    }

    if (filters.alarmStatus !== undefined) {
      match['alarmOccurrences.alarmStatus'] = filters.alarmStatus;
    }

    // Time range filter (range, from-to, date)
    if (filters.range || filters.from || filters.to || filters.date) {
      const { start, end } = getTimeRange(filters as TimeRangePayload);

      match['alarmOccurrences.date'] = {
        $gte: new Date(start),
        $lte: new Date(end),
      };
    }

    const results = await this.alarmsEventModel.aggregate([
      // Populate alarmOccurrences
      {
        $lookup: {
          from: 'alarmsOccurrence',
          localField: 'alarmOccurrences',
          foreignField: '_id',
          as: 'alarmOccurrences',
        },
      },

      // Populate alarmAcknowledgedBy inside alarmOccurrences
      {
        $unwind: {
          path: '$alarmOccurrences',
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { userId: '$alarmOccurrences.alarmAcknowledgedBy' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', '$$userId'] } } },
            { $project: { password: 0 } }, // exclude password
          ],
          as: 'alarmOccurrences.alarmAcknowledgedBy',
        },
      },
      {
        $unwind: {
          path: '$alarmOccurrences.alarmAcknowledgedBy',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Populate alarmConfigure
      {
        $lookup: {
          from: 'alarmsConfiguration',
          localField: 'alarmConfigId',
          foreignField: '_id',
          as: 'alarmConfigure',
        },
      },
      {
        $unwind: { path: '$alarmConfigure', preserveNullAndEmptyArrays: true },
      },

      // Populate alarmType inside alarmConfigure
      {
        $lookup: {
          from: 'alarmsType',
          localField: 'alarmConfigure.alarmTypeId',
          foreignField: '_id',
          as: 'alarmConfigure.alarmType',
        },
      },
      {
        $unwind: {
          path: '$alarmConfigure.alarmType',
          preserveNullAndEmptyArrays: true,
        },
      },

      // Apply filters
      { $match: match },

      // Regroup occurrences back into array
      {
        $group: {
          _id: '$_id',
          alarmConfigId: { $first: '$alarmConfigId' },
          alarmConfigure: { $first: '$alarmConfigure' },
          alarmOccurrenceCount: { $first: '$alarmOccurrenceCount' },
          alarmAcknowledgementStatusCount: {
            $first: '$alarmAcknowledgementStatusCount',
          },
          alarmFirstOccurrence: { $first: '$alarmFirstOccurrence' },
          alarmLastOccurrence: { $first: '$alarmLastOccurrence' },
          alarmOccurrences: { $push: '$alarmOccurrences' },
        },
      },
    ]);

    return {
      data: results,
      total: results.length,
    };
  }

  async acknowledgementActions() {
    const results = await this.alarmsModel.find(
      {}, // filter (sab documents)
      { acknowledgementActions: 1, _id: 0 }, // projection (sirf acknowledgementActions field)
    );
    const merged = results.flatMap((r) => r.acknowledgementActions || []);
    // merge all arrays into single array
    return [...new Set(merged)]; // return unique values only
  }

  async acknowledgeOne(
    occurrenceId: string,
    action: string,
    acknowledgedBy: string,
  ) {
    const occurrence = await this.alarmOccurrenceModel.findById(occurrenceId);
    if (!occurrence) throw new NotFoundException('Occurrence not found');

    if (occurrence.alarmAcknowledgeStatus === 'Acknowledged') {
      throw new Error('This occurrence is already acknowledged');
    }

    const now = new Date();
    const delay = (now.getTime() - new Date(occurrence.date).getTime()) / 1000;

    // ✅ Update occurrence
    occurrence.alarmAcknowledgeStatus = 'Acknowledged';
    occurrence.alarmAcknowledgmentAction = action;
    occurrence.alarmAcknowledgedBy = new Types.ObjectId(acknowledgedBy);
    occurrence.alarmAcknowledgedDelay = delay;
    await occurrence.save();

    // ✅ Update parent alarm
    const parentAlarm = await this.alarmsEventModel.findOne({
      alarmOccurrences: occurrence._id,
    });

    if (parentAlarm) {
      const acknowledgedCount = await this.alarmOccurrenceModel.countDocuments({
        _id: { $in: parentAlarm.alarmOccurrences },
        alarmAcknowledgeStatus: 'Acknowledged',
      });

      parentAlarm.alarmAcknowledgementStatusCount = acknowledgedCount;
      await parentAlarm.save();
    }

    // ✅ Fetch populated occurrence
    const populatedOccurrence = await this.alarmOccurrenceModel
      .findById(occurrence._id)
      .populate('alarmAcknowledgedBy', 'name email');

    // ✅ Fetch parent alarm with populated occurrences + acknowledgedBy
    const populatedParentAlarm = parentAlarm
      ? await this.alarmsEventModel.findById(parentAlarm._id).populate({
          path: 'alarmOccurrences',
          populate: { path: 'alarmAcknowledgedBy', select: 'name email' },
        })
      : null;

    return {
      updatedOccurrences: [populatedOccurrence], // 🔹 same shape as acknowledgeMany
      parentAlarms: populatedParentAlarm ? [populatedParentAlarm] : [],
    };
  }

  /**
   * Acknowledge multiple occurrences at once
   */
  async acknowledgeMany(occurrenceIds: string[], acknowledgedBy: string) {
    const now = new Date();

    // ✅ Cast all IDs to ObjectId
    const objectIds = occurrenceIds.map((id) => new Types.ObjectId(id));

    // ✅ Update occurrences in bulk
    await this.alarmOccurrenceModel.updateMany(
      {
        _id: { $in: objectIds },
        alarmAcknowledgeStatus: { $ne: 'Acknowledged' },
      },
      {
        $set: {
          alarmAcknowledgeStatus: 'Acknowledged',
          alarmAcknowledgmentAction: 'Auto Mass Acknowledged',
          alarmAcknowledgedBy: new Types.ObjectId(acknowledgedBy),
          alarmAcknowledgedDelay: 0, // you could calculate per-occurrence if needed
        },
      },
    );

    // ✅ Get all parent alarms that have these occurrences
    const occurrences = await this.alarmOccurrenceModel.find({
      _id: { $in: objectIds },
    });

    // Find unique parent alarms
    const parentAlarms = await this.alarmsEventModel.find({
      alarmOccurrences: { $in: objectIds },
    });

    for (const parentAlarm of parentAlarms) {
      // Recalculate acknowledged count for this parent
      const acknowledgedCount = await this.alarmOccurrenceModel.countDocuments({
        _id: { $in: parentAlarm.alarmOccurrences },
        alarmAcknowledgeStatus: 'Acknowledged',
      });

      parentAlarm.alarmAcknowledgementStatusCount = acknowledgedCount;
      await parentAlarm.save();
    }

    return { updatedOccurrences: occurrences, parentAlarms };
  }

  // alarms-occurrence.service.ts
  async snoozeAlarm(snoozeDto: SnoozeDto) {
    const { ids, alarmSnooze, snoozeDuration, snoozeAt } = snoozeDto;

    const updated = await this.alarmOccurrenceModel.updateMany(
      { _id: { $in: ids } }, // 👈 multiple ids filter
      {
        $set: {
          alarmSnooze,
          snoozeDuration,
          snoozeAt: new Date(snoozeAt),
        },
      },
      { runValidators: true },
    );

    if (updated.modifiedCount === 0) {
      throw new NotFoundException('No alarm occurrences updated');
    }

    return { message: `${updated.modifiedCount} alarms updated successfully` };
  }
}
