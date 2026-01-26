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
  const startISO = `${startDate}T06:00:00+05:00`;
  const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');
  const endISO = `${nextDay}T06:00:59.999+05:00`;

  const energySuffix = 'Del_ActiveEnergy';
  const powerSuffix = 'ActivePower_Total';
  const currentSuffix = 'Current_Avg';
  const voltageSuffix = 'Voltage_Avg';
  const recEnergySuffix = 'Rec_Active_Energy';
  const PowerFactor_AvgSuffix = 'PowerFactor_Avg';
  const harmonicsSuffixes = ['Harmonics_V1_THD', 'Harmonics_V2_THD', 'Harmonics_V3_THD'];

  const projection: Record<string, 1> = { timestamp: 1 };
  meters.forEach((m) => {
    projection[`${m}_${energySuffix}`] = 1;
    projection[`${m}_${powerSuffix}`] = 1;
    projection[`${m}_${currentSuffix}`] = 1;
    projection[`${m}_${voltageSuffix}`] = 1;
    projection[`${m}_${recEnergySuffix}`] = 1;
    projection[`${m}_${PowerFactor_AvgSuffix}`] = 1;
    harmonicsSuffixes.forEach((h) => (projection[`${m}_${h}`] = 1));
  });

  const raw = await model
    .find({ timestamp: { $gte: startISO, $lt: endISO } }, projection)
    .sort({ timestamp: 1 })
    .lean();

  const meterValues: Record<string, any> = {};
  raw.forEach((doc) => {
    const ts = moment.tz(doc.timestamp as string, timezone);
    const tsKey = ts
      .minutes(Math.floor(ts.minutes() / 15) * 15)
      .seconds(0)
      .milliseconds(0)
      .toISOString(true);

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
        powerfactor: doc[`${m}_PowerFactor_Avg`] ?? 0,
        harmonicsAvg: uHarmonicsAvg,
      };
    });

    meterValues[tsKey] = meterData;
  });

  const result: any[] = [];
  let prevSumEnergy = 0;
  const cursor = moment(startISO, moment.ISO_8601).tz(timezone);
  const end = moment(endISO, moment.ISO_8601).tz(timezone);
  const now = moment().tz(timezone);

  while (cursor.isBefore(end)) {
    const bucket = cursor.toISOString(true);
    if (cursor.isSame(now, 'day') && cursor.isAfter(now)) break;

    const values = meterValues[bucket] ?? {};

    // --- Initialize accumulators with same final variable names ---
    let sumEnergy = 0,
      sumPower = 0,
      sumRecEnergy = 0,
      sumVoltage = 0,
      voltageCount = 0,
      sumCurrent = 0,
      currentCount = 0,
      sumpowerfactor = 0,
      pfCount = 0,
      sumHarmonics = 0,
      harmonicCount = 0;

    meters.forEach((m) => {
      const v =
        values[m] ?? {
          energy: 0,
          power: 0,
          current: 0,
          voltage: 0,
          recEnergy: 0,
          powerfactor: 0,
          harmonicsAvg: 0,
        };

      // SUM fields
      sumEnergy += v.energy;
      sumPower += v.power;
      sumRecEnergy += v.recEnergy;

      // AVG Voltage
      if (v.voltage > 0) {
        sumVoltage += v.voltage;
        voltageCount++;
      }

      // AVG Current
      if (v.current > 0) {
        sumCurrent += v.current;
        currentCount++;
      }

      // AVG PF
      if (v.powerfactor > 0) {
        sumpowerfactor += v.powerfactor;
        pfCount++;
      }

      // AVG Harmonics
      if (v.harmonicsAvg > 0) {
        sumHarmonics += v.harmonicsAvg;
        harmonicCount++;
      }
    });

    const consumption = Math.max(sumEnergy - prevSumEnergy, 0);

    result.push({
      timestamp: bucket,
      consumption,
      sumEnergy: +sumEnergy.toFixed(2),
      sumActivePower: +sumPower.toFixed(2),
      sumRecEnergy: +sumRecEnergy.toFixed(2),
      sumVoltage: voltageCount > 0 ? +(sumVoltage / voltageCount).toFixed(2) : 0,
      sumCurrent: currentCount > 0 ? +(sumCurrent / currentCount).toFixed(2) : 0,
      sumpowerfactor: pfCount > 0 ? +(sumpowerfactor / pfCount).toFixed(2) : 0,
      sumHarmonics: harmonicCount > 0 ? +(sumHarmonics / harmonicCount).toFixed(2) : 0,
    });

    prevSumEnergy = sumEnergy;
    cursor.add(15, 'minutes');
  }

  return result;
}
