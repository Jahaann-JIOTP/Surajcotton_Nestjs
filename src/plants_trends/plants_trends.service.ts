import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { Historical } from './schemas/historical.schema';

@Injectable()
export class PlantsTrendsService {
  constructor(
    @InjectModel(Historical.name, 'surajcotton')
    private readonly historicalModel: Model<Historical>,
  ) {}

  async getUnit4LT1Trends(startDate: string, endDate: string) {
    const startISO = `${startDate} 06:00`;
    const endISO = `${moment(endDate).add(1, 'day').format('YYYY-MM-DD')} 06:00`;

    console.log('📅 Query Range:', startISO, '→', endISO);

    const meters = ['U19_PLC', 'U21_PLC'];
    const energySuffix = 'Del_ActiveEnergy';
    const powerSuffix = 'ActivePower_Total';
    const currentSuffix = 'Current_Avg';
    const voltageSuffix = 'Voltage_Avg';
    const recEnergySuffix = 'Rec_Active_Energy';
    const harmonicsSuffixes = ['Harmonics_V1_THD', 'Harmonics_V2_THD', 'Harmonics_V3_THD'];

    // Projection including harmonics
    const projection: Record<string, 1> = { timestamp: 1 };
    meters.forEach(m => {
      projection[`${m}_${energySuffix}`] = 1;
      projection[`${m}_${powerSuffix}`] = 1;
      projection[`${m}_${currentSuffix}`] = 1;
      projection[`${m}_${voltageSuffix}`] = 1;
      projection[`${m}_${recEnergySuffix}`] = 1;
      harmonicsSuffixes.forEach(h => (projection[`${m}_${h}`] = 1));
    });

    const raw = await this.historicalModel
      .find({ timestamp: { $gte: startISO, $lt: endISO } }, projection)
      .sort({ timestamp: 1 })
      .lean();

    console.log('📊 Raw Count from DB:', raw.length);
    raw.slice(0, 10).forEach((doc, idx) =>
      console.log(
        `Doc[${idx}] - timestamp: ${doc.timestamp}, ` +
        `U19_Energy: ${doc['U19_PLC_Del_ActiveEnergy']}, ` +
        `U21_Energy: ${doc['U21_PLC_Del_ActiveEnergy']}, ` +
        `U19_Power: ${doc['U19_PLC_ActivePower_Total']}, ` +
        `U21_Power: ${doc['U21_PLC_ActivePower_Total']}, ` +
        `U19_Current: ${doc['U19_PLC_Current_Avg']}, ` +
        `U21_Current: ${doc['U21_PLC_Current_Avg']}, ` +
        `U19_Voltage: ${doc['U19_PLC_Voltage_Avg']}, ` +
        `U21_Voltage: ${doc['U21_PLC_Voltage_Avg']}, ` +
        `U19_RecEnergy: ${doc['U19_PLC_Rec_Active_Energy']}, ` +
        `U21_RecEnergy: ${doc['U21_PLC_Rec_Active_Energy']}, ` +
        `U19_Harmonics: ${[
          doc['U19_PLC_Harmonics_V1_THD'],
          doc['U19_PLC_Harmonics_V2_THD'],
          doc['U19_PLC_Harmonics_V3_THD']
        ]}, ` +
        `U21_Harmonics: ${[
          doc['U21_PLC_Harmonics_V1_THD'],
          doc['U21_PLC_Harmonics_V2_THD'],
          doc['U21_PLC_Harmonics_V3_THD']
        ]}`
      )
    );

    const meterValues: Record<string, any> = {};
    raw.forEach(doc => {
      const ts = moment.tz(doc.timestamp as string, 'Asia/Karachi');
      const tsKey = ts
        .minutes(Math.floor(ts.minutes() / 15) * 15)
        .seconds(0)
        .milliseconds(0)
        .format('YYYY-MM-DD HH:mm');

      const u19HarmonicsAvg =
        ((doc['U19_PLC_Harmonics_V1_THD'] ?? 0) +
          (doc['U19_PLC_Harmonics_V2_THD'] ?? 0) +
          (doc['U19_PLC_Harmonics_V3_THD'] ?? 0)) /
        3;

      const u21HarmonicsAvg =
        ((doc['U21_PLC_Harmonics_V1_THD'] ?? 0) +
          (doc['U21_PLC_Harmonics_V2_THD'] ?? 0) +
          (doc['U21_PLC_Harmonics_V3_THD'] ?? 0)) /
        3;

      meterValues[tsKey] = {
        u19Energy: doc['U19_PLC_Del_ActiveEnergy'] ?? 0,
        u21Energy: doc['U21_PLC_Del_ActiveEnergy'] ?? 0,
        u19Power: doc['U19_PLC_ActivePower_Total'] ?? 0,
        u21Power: doc['U21_PLC_ActivePower_Total'] ?? 0,
        u19Current: doc['U19_PLC_Current_Avg'] ?? 0,
        u21Current: doc['U21_PLC_Current_Avg'] ?? 0,
        u19Voltage: doc['U19_PLC_Voltage_Avg'] ?? 0,
        u21Voltage: doc['U21_PLC_Voltage_Avg'] ?? 0,
        u19RecEnergy: doc['U19_PLC_Rec_Active_Energy'] ?? 0,
        u21RecEnergy: doc['U21_PLC_Rec_Active_Energy'] ?? 0,
        u19HarmonicsAvg,
        u21HarmonicsAvg,
      };

      console.log(`Mapped tsKey: ${tsKey}`, meterValues[tsKey]);
    });

    const result: any[] = [];
    let prevSumEnergy = 0;
    const cursor = moment(startISO, 'YYYY-MM-DD HH:mm');
    const now = moment().tz('Asia/Karachi');

    while (cursor.isBefore(endISO)) {
      const bucket = cursor.format('YYYY-MM-DD HH:mm');
      if (cursor.isSame(now, 'day') && cursor.isAfter(now)) break;

      const values = meterValues[bucket] ?? {
        u19Energy: prevSumEnergy / 2,
        u21Energy: prevSumEnergy / 2,
        u19Power: 0,
        u21Power: 0,
        u19Current: 0,
        u21Current: 0,
        u19Voltage: 0,
        u21Voltage: 0,
        u19RecEnergy: 0,
        u21RecEnergy: 0,
        u19HarmonicsAvg: 0,
        u21HarmonicsAvg: 0,
      };

      const sumEnergy = +(values.u19Energy + values.u21Energy).toFixed(2);
      const consumption = Math.max(sumEnergy - prevSumEnergy, 0);
      const sumActivePower = +(values.u19Power + values.u21Power).toFixed(2);
      const sumCurrent = +(values.u19Current + values.u21Current).toFixed(2);
      const sumVoltage = +(values.u19Voltage + values.u21Voltage).toFixed(2);
      const sumRecEnergy = +(values.u19RecEnergy + values.u21RecEnergy).toFixed(2);
      const sumHarmonics = +(values.u19HarmonicsAvg + values.u21HarmonicsAvg).toFixed(3);

      console.log(
        `🕒 Bucket: ${bucket} | ` +
        `U19_Energy: ${values.u19Energy}, U21_Energy: ${values.u21Energy}, SumEnergy: ${sumEnergy}, ΔConsumption: ${consumption} | ` +
        `U19_Power: ${values.u19Power}, U21_Power: ${values.u21Power}, SumActivePower: ${sumActivePower} | ` +
        `U19_Current: ${values.u19Current}, U21_Current: ${values.u21Current}, SumCurrent: ${sumCurrent} | ` +
        `U19_Voltage: ${values.u19Voltage}, U21_Voltage: ${values.u21Voltage}, SumVoltage: ${sumVoltage} | ` +
        `U19_RecEnergy: ${values.u19RecEnergy}, U21_RecEnergy: ${values.u21RecEnergy}, SumRecEnergy: ${sumRecEnergy} | ` +
        `U19_HarmonicsAvg: ${values.u19HarmonicsAvg.toFixed(3)}, U21_HarmonicsAvg: ${values.u21HarmonicsAvg.toFixed(3)}, SumHarmonics: ${sumHarmonics}`
      );

      result.push({
        timestamp: bucket,
        consumption,
        sumEnergy,
        sumActivePower,
        sumCurrent,
        sumVoltage,
        sumRecEnergy,
        sumHarmonics,
      });

      prevSumEnergy = sumEnergy;
      cursor.add(15, 'minutes');
    }

    console.log('📈 Total Buckets Generated:', result.length);
    return result;
  }
}
