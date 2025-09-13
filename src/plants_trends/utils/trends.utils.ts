// src/utils/trends.utils.ts
import * as moment from 'moment-timezone';
import { Model } from 'mongoose';

export interface TrendOptions {
  startDate: string;
  endDate: string;
  meters: string[];
  model: Model<any>;
  timezone?: string;
}

export async function getTrends({
  startDate,
  endDate,
  meters,
  model,
  timezone = 'Asia/Karachi',
}: TrendOptions) {
  // ✅ Time range banate hue +05:00 offset add karo
  const startISO = `${startDate}T06:00:00.000+05:00`;
  const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');
  const endISO = `${nextDay}T06:00:00.000+05:00`;

  // console.log('📌 Query range:', startISO, '➡️', endISO);

  // Field suffixes
  const energySuffix = 'Del_ActiveEnergy';
  const powerSuffix = 'ActivePower_Total';
  const currentSuffix = 'Current_Avg';
  const voltageSuffix = 'Voltage_Avg';
  const recEnergySuffix = 'Rec_Active_Energy';
  const harmonicsSuffixes = ['Harmonics_V1_THD', 'Harmonics_V2_THD', 'Harmonics_V3_THD'];

  // ✅ Build projection
  const projection: Record<string, 1> = { timestamp: 1 };
  meters.forEach((m) => {
    projection[`${m}_${energySuffix}`] = 1;
    projection[`${m}_${powerSuffix}`] = 1;
    projection[`${m}_${currentSuffix}`] = 1;
    projection[`${m}_${voltageSuffix}`] = 1;
    projection[`${m}_${recEnergySuffix}`] = 1;
    harmonicsSuffixes.forEach((h) => (projection[`${m}_${h}`] = 1));
  });

  // ✅ Fetch data
  const raw = await model
    .find({ timestamp: { $gte: startISO, $lt: endISO } }, projection)
    .sort({ timestamp: 1 })
    .lean();

  // console.log('📌 Raw docs count:', raw.length);

  // ✅ Convert raw docs into 15-min buckets
  const meterValues: Record<string, any> = {};
  raw.forEach((doc) => {
    const ts = moment.tz(doc.timestamp as string, timezone);
    const tsKey = ts
      .minutes(Math.floor(ts.minutes() / 15) * 15)
      .seconds(0)
      .milliseconds(0)
      .format('YYYY-MM-DD HH:mm');

    const meterData: Record<string, any> = {};
    meters.forEach((m) => {
      const uHarmonicsAvg =
        ((doc[`${m}_Harmonics_V1_THD`] ?? 0) +
          (doc[`${m}_Harmonics_V2_THD`] ?? 0) +
          (doc[`${m}_Harmonics_V3_THD`] ?? 0)) /
        3;

      meterData[m] = {
        energy: doc[`${m}_Del_ActiveEnergy`] ?? 0,
        power: doc[`${m}_ActivePower_Total`] ?? 0,
        current: doc[`${m}_Current_Avg`] ?? 0,
        voltage: doc[`${m}_Voltage_Avg`] ?? 0,
        recEnergy: doc[`${m}_Rec_Active_Energy`] ?? 0,
        harmonicsAvg: uHarmonicsAvg,
      };
    });

    meterValues[tsKey] = meterData;
  });

  // console.log('📌 Meter values prepared keys:', Object.keys(meterValues).length);

  // ✅ Generate 15-min buckets
  const result: any[] = [];
  let prevSumEnergy = 0;
  const cursor = moment(startISO, moment.ISO_8601).tz(timezone);
  const end = moment(endISO, moment.ISO_8601).tz(timezone);
  const now = moment().tz(timezone);

  while (cursor.isBefore(end)) {
    const bucket = cursor.format('YYYY-MM-DD HH:mm');
    if (cursor.isSame(now, 'day') && cursor.isAfter(now)) break;

    const values = meterValues[bucket] ?? {};

    let sumEnergy = 0,
      sumPower = 0,
      sumCurrent = 0,
      sumVoltage = 0,
      sumRecEnergy = 0,
      sumHarmonics = 0;

    meters.forEach((m) => {
      const v =
        values[m] ?? {
          energy: 0,
          power: 0,
          current: 0,
          voltage: 0,
          recEnergy: 0,
          harmonicsAvg: 0,
        };
      sumEnergy += v.energy;
      sumPower += v.power;
      sumCurrent += v.current;
      sumVoltage += v.voltage;
      sumRecEnergy += v.recEnergy;
      sumHarmonics += v.harmonicsAvg;
    });

    const consumption = Math.max(sumEnergy - prevSumEnergy, 0);

    result.push({
      timestamp: bucket,
      consumption,
      sumEnergy: +sumEnergy.toFixed(2),
      sumActivePower: +sumPower.toFixed(2),
      sumCurrent: +sumCurrent.toFixed(2),
      sumVoltage: +sumVoltage.toFixed(2),
      sumRecEnergy: +sumRecEnergy.toFixed(2),
      sumHarmonics: +sumHarmonics.toFixed(3),
    });

    prevSumEnergy = sumEnergy;
    cursor.add(15, 'minutes');
  }

  // console.log('📌 Final result buckets:', result.length);
  return result;
}
