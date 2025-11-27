// src/energy/energy.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Energy, EnergyDocument } from './schemas/energy.schema';
import * as moment from 'moment-timezone';

const TZ = 'Asia/Karachi';

// Toggle Debug Mode Here
// const DEBUG = true;

// Only required meter groups
const GROUP_KEYS = {
  LTGeneration: ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'],

  SolarGeneration: [
    'U6_GW02_Del_ActiveEnergy',
    'U17_GW03_Del_ActiveEnergy',
    'U24_GW01_Del_ActiveEnergy',
    'U28_PLC_Del_ActiveEnergy',
  ],

  HT_Generation: ['U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy'],

  WapdaImport: ['U23_GW01_Del_ActiveEnergy', 'U27_PLC_Del_ActiveEnergy'],

  hfoaux: ['U25_PLC_Del_ActiveEnergy'],

  Aux_consumption: ['U25_PLC_Del_ActiveEnergy'],

  U4_Consumption: [
    'U19_PLC_Del_ActiveEnergy',
    'U21_PLC_Del_ActiveEnergy',
    'U13_GW01_Del_ActiveEnergy',
    'U11_GW01_Del_ActiveEnergy',
    'U24_GW01_Del_ActiveEnergy',
    'U28_PLC_Del_ActiveEnergy',
  ],

  U5_Consumption: [
    'U13_GW02_Del_ActiveEnergy',
    'U16_GW03_Del_ActiveEnergy',
    'U6_GW02_Del_ActiveEnergy',
    'U17_GW03_Del_ActiveEnergy',
  ],
};

function sumGroup(consumption: Record<string, number>, keys: string[]): number {
  return keys.reduce((sum, key) => sum + (consumption[key] || 0), 0);
}

@Injectable()
export class EnergyService {
  constructor(
    @InjectModel(Energy.name, 'surajcotton')
    private readonly energyModel: Model<EnergyDocument>,
  ) {}

  async getConsumption(start: string, end: string) {
     const startTime = performance.now();  // ⏱️ Start measuring
    const startMoment = moment.tz(`${start} 06:00:00`, 'YYYY-MM-DD HH:mm:ss', TZ);
    let endMoment: moment.Moment;
        if (start === end) {
          // single day
          endMoment = moment
            .tz(`${start} 06:00:00`, TZ)
            .add(1, 'day')
            .hour(6)
            .minute(0)
            .second(59)
            .millisecond(999);
        } else {
          // multi-day (week, month, custom range)
          endMoment = moment
            .tz(`${end} 06:00:00`, TZ)
            .hour(6)
            .minute(0)
            .second(59)
            .millisecond(999);
        }
    const startStr = startMoment.format('YYYY-MM-DDTHH:mm:ss.SSSZ');
    const endStr = endMoment.format('YYYY-MM-DDTHH:mm:ss.SSSZ');

    const matchStage = {
      timestamp: { $gte: startStr, $lte: endStr },
    };

    const requiredKeys = Object.values(GROUP_KEYS).flat();

    // Build group stage
    const groupStage: any = { _id: null };
    for (const key of requiredKeys) {
      groupStage[`${key}_first`] = { $first: `$${key}` };
      groupStage[`${key}_last`] = { $last: `$${key}` };
      groupStage[`first_ts_${key}`] = { $first: '$timestamp' };
      groupStage[`last_ts_${key}`] = { $last: '$timestamp' };
    }

    const agg = await this.energyModel.aggregate([
      { $match: matchStage },
      { $sort: { timestamp: 1 } },
      { $group: groupStage },
    ]);

    if (!agg.length) {
      return {
        total_consumption: {
          LTGeneration: "0.00",
          SolarGeneration: "0.00",
          WapdaImport: "0.00",
          hfoaux: "0.00",
          Aux_consumption: "0.00",
          Total_Generation: "0.00",
          HT_Generation: "0.00",
          total_energy_input: "0.00",
          totalenergyoutput: "0.00",
        },
      };
    }

    const doc = agg[0];
    const consumption: Record<string, number> = {};

    // LOOP THROUGH ALL REQUIRED METERS
    for (const key of requiredKeys) {
      const firstValue = Number(doc[`${key}_first`] ?? 0);
      const lastValue = Number(doc[`${key}_last`] ?? 0);

      const firstTS = doc[`first_ts_${key}`];
      const lastTS = doc[`last_ts_${key}`];

      const diff = lastValue > firstValue ? lastValue - firstValue : 0;
      consumption[key] = diff;

      // DEBUG LOG
      // if (DEBUG) {
      //   console.log("\n------------ DEBUG METER -------------");
      //   console.log("Meter:", key);
      //   console.log("FIRST Timestamp:", firstTS, "Value:", firstValue);
      //   console.log("LAST  Timestamp:", lastTS, "Value:", lastValue);
      //   console.log("DIFF:", diff);
      //   console.log("-------------------------------------\n");
      // }
    }

    // Compute only required metrics
    const LTGeneration = sumGroup(consumption, GROUP_KEYS.LTGeneration);
    const SolarGeneration = sumGroup(consumption, GROUP_KEYS.SolarGeneration);
    const HT_Generation = sumGroup(consumption, GROUP_KEYS.HT_Generation);

    const WapdaImport = sumGroup(consumption, GROUP_KEYS.WapdaImport);
    const hfoaux = sumGroup(consumption, GROUP_KEYS.hfoaux);

    const Aux_consumption = sumGroup(consumption, GROUP_KEYS.Aux_consumption);

    const U4_Consumption = sumGroup(consumption, GROUP_KEYS.U4_Consumption);
    const U5_Consumption = sumGroup(consumption, GROUP_KEYS.U5_Consumption);

    const totalGeneration = LTGeneration + SolarGeneration + HT_Generation;
    const totalenergyinput = LTGeneration + SolarGeneration + HT_Generation + WapdaImport;
    const totalenergyoutput = U4_Consumption + U5_Consumption + Aux_consumption;

    const f = (v: number) => v.toFixed(2);
    const endTime = performance.now();  // ⏱️ End measuring
    console.log(`🔥 getConsumption executed in ${(endTime - startTime).toFixed(2)} ms`);

    return {
      total_consumption: {
        LTGeneration: f(LTGeneration),
        SolarGeneration: f(SolarGeneration),
        WapdaImport: f(WapdaImport),
        hfoaux: f(hfoaux),
        Aux_consumption: f(Aux_consumption),
        Total_Generation: f(totalGeneration),
        HT_Generation: f(HT_Generation),
        total_energy_input: f(totalenergyinput),
        totalenergyoutput: f(totalenergyoutput),
      },
    };
  }
}
