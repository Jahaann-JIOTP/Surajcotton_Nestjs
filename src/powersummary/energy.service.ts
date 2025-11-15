// src/energy/energy.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Energy, EnergyDocument } from './schemas/energy.schema';
import { Unit4LT1Service } from '../unit4_lt1/unit4_lt1.service';
import { Unit4LT2Service } from '../unit4_lt2/unit4_lt2.service';
import { Unit5LT3Service } from '../unit5_lt3/unit5_lt3.service';
import { Unit5LT4Service } from '../unit5_lt4/unit5_lt4.service';
import * as moment from 'moment-timezone';

const TZ = 'Asia/Karachi';

// ================== REQUIRED METER GROUPS ==================

const GROUP_KEYS = {
  Wapda1: ['U23_GW01_Del_ActiveEnergy'],
  Wapda2: ['U27_PLC_Del_ActiveEnergy'],

  Niigata: ['U22_PLC_Del_ActiveEnergy'],
  JMS: ['U26_PLC_Del_ActiveEnergy'],

  Solar1: ['U6_GW02_Del_ActiveEnergy'],
  Solar2: ['U17_GW03_Del_ActiveEnergy'],
  solarunit4: ['U24_GW01_Del_ActiveEnergy'],
  solar52: ['U28_PLC_Del_ActiveEnergy'],

  DieselandGasGenset: ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'],

  Wapdaexport: ['U20_GW03_ActiveEnergy_Exp_kWh', 'U19_GW03_ActiveEnergy_Exp_kWh'],

  // Transformer related:
  Trafo1Incoming: ['U23_GW01_Del_ActiveEnergy'],
  Trafo2Incoming: ['U22_GW01_Del_ActiveEnergy'],
  Trafo3Incoming: ['U20_GW03_Del_ActiveEnergy'],
  Trafo4Incoming: ['U19_GW03_Del_ActiveEnergy'],

  Trafo1outgoing: ['U21_PLC_Del_ActiveEnergy'],
  Trafo2outgoing: ['U13_GW01_Del_ActiveEnergy'],
  Trafo3outgoing: ['U13_GW02_Del_ActiveEnergy'],
  Trafo4outgoing: ['U16_GW03_Del_ActiveEnergy'],

  // Required internally for HT_Transmission_Losses
  mainincomingunit5: ['U21_GW03_Del_ActiveEnergy'],
  PH_IC: ['U22_GW01_Del_ActiveEnergy'],
  hfoaux: ['U25_PLC_Del_ActiveEnergy'],
};

// Utility
function sumGroup(consumption: Record<string, number>, keys: string[]): number {
  return keys.reduce((sum, k) => sum + (consumption[k] || 0), 0);
}

// Extract unaccounted energy from Sankey
function getUnaccountedEnergyFromSankey(raw: any): number {
  const data = Array.isArray(raw) ? raw : raw?.sankeyData || [];
  const node = data.find((n: any) => n.to === 'Unaccounted Energy');
  return node?.value || 0;
}

@Injectable()
export class EnergyService {
  constructor(
    @InjectModel(Energy.name, 'surajcotton')
    private readonly energyModel: Model<EnergyDocument>,
    private readonly unit4LT1: Unit4LT1Service,
    private readonly unit4LT2: Unit4LT2Service,
    private readonly unit5LT3: Unit5LT3Service,
    private readonly unit5LT4: Unit5LT4Service,
  ) {}

  async getConsumption(start: string, end: string) {
    // console.time('getConsumption_totalTime'); // ------------------ MAIN TIMER START

    try {
      // console.time('timeRange_calc');
      // =========== TIME RANGE 06:00 → NEXT 06:00 ===========
      const startMoment = moment.tz(`${start} 06:00:00`, 'YYYY-MM-DD HH:mm:ss', TZ);

      const endMoment =
        start === end
          ? moment.tz(`${start} 06:00:00`, TZ).add(1, 'day').hour(6).minute(0).second(59).millisecond(999)
          : moment.tz(`${end} 06:00:00`, TZ).hour(6).minute(0).second(59).millisecond(999);

      // console.timeEnd('timeRange_calc');

      const matchStage = {
        timestamp: {
          $gte: startMoment.format(),
          $lte: endMoment.format(),
        },
      };

      // Required keys
      const requiredKeys = Object.values(GROUP_KEYS).flat();

      const groupStage: any = { _id: null };
      for (const key of requiredKeys) {
        groupStage[`${key}_first`] = { $first: `$${key}` };
        groupStage[`${key}_last`] = { $last: `$${key}` };
      }

      // ---------------------------- AGGREGATION TIMER
      // console.time('MongoDB_aggregation');
      const agg = await this.energyModel.aggregate([
        { $match: matchStage },
        { $sort: { timestamp: 1 } },
        { $group: groupStage },
      ]);
      // console.timeEnd('MongoDB_aggregation');

      // If no data return zeros
      if (!agg.length) {
        return {
          total_consumption: {
            Wapda1: "0.00",
            Wapda2: "0.00",
            Niigata: "0.00",
            JMS: "0.00",
            T1andT2incoming: "0.00",
            T1andT2outgoing: "0.00",
            T1andT2losses: "0.00",
            T1T2unit4percentage: "0.00",
            T3andT4incoming: "0.00",
            T3andT4outgoing: "0.00",
            T3andT4losses: "0.00",
            T3T4percentage: "0.00",
            Solar1: "0.00",
            Solar2: "0.00",
            solarunit4: "0.00",
            solar52: "0.00",
            DieselandGasGenset: "0.00",
            Wapdaexport: "0.00",
            unaccoutable_energy: "0.00",
            TrasformerLosses: "0.00",
            TotalTrasformepercentage: "0.00",
            HT_Transmissioin_Losses: "0.00",
          },
        };
      }

      const doc = agg[0];
      const consumption: Record<string, number> = {};

      // ---------------------------- DIFFERENCE CALCULATION TIMER
      // console.time('diff_calc');
      for (const key of requiredKeys) {
        const first = Number(doc[`${key}_first`] || 0);
        const last = Number(doc[`${key}_last`] || 0);
        let diff = last - first;
        if (!isFinite(diff) || diff < 0 || Math.abs(diff) > 1e10) diff = 0;
        consumption[key] = diff;
      }
      // console.timeEnd('diff_calc');

      // ---------------------------- ENERGY CALCULATION TIMER
      // console.time('energy_calculations');
      const Wapda1 = sumGroup(consumption, GROUP_KEYS.Wapda1);
      const Wapda2 = sumGroup(consumption, GROUP_KEYS.Wapda2);
      const Niigata = sumGroup(consumption, GROUP_KEYS.Niigata);
      const JMS = sumGroup(consumption, GROUP_KEYS.JMS);

      const Solar1 = sumGroup(consumption, GROUP_KEYS.Solar1);
      const Solar2 = sumGroup(consumption, GROUP_KEYS.Solar2);
      const solarunit4 = sumGroup(consumption, GROUP_KEYS.solarunit4);
      const solar52 = sumGroup(consumption, GROUP_KEYS.solar52);

      const DieselandGasGenset = sumGroup(consumption, GROUP_KEYS.DieselandGasGenset);
      const Wapdaexport = sumGroup(consumption, GROUP_KEYS.Wapdaexport);

      const Trafo1Incoming = sumGroup(consumption, GROUP_KEYS.Trafo1Incoming);
      const Trafo2Incoming = sumGroup(consumption, GROUP_KEYS.Trafo2Incoming);
      const Trafo3Incoming = sumGroup(consumption, GROUP_KEYS.Trafo3Incoming);
      const Trafo4Incoming = sumGroup(consumption, GROUP_KEYS.Trafo4Incoming);

      const Trafo1outgoing = sumGroup(consumption, GROUP_KEYS.Trafo1outgoing);
      const Trafo2outgoing = sumGroup(consumption, GROUP_KEYS.Trafo2outgoing);
      const Trafo3outgoing = sumGroup(consumption, GROUP_KEYS.Trafo3outgoing);
      const Trafo4outgoing = sumGroup(consumption, GROUP_KEYS.Trafo4outgoing);

      const mainincomingunit5 = sumGroup(consumption, GROUP_KEYS.mainincomingunit5);
      const PH_IC = sumGroup(consumption, GROUP_KEYS.PH_IC);
      const hfoaux = sumGroup(consumption, GROUP_KEYS.hfoaux);

      const T1andT2incoming = Trafo1Incoming + Trafo2Incoming;
      const T1andT2outgoing = Trafo1outgoing + Trafo2outgoing;
      const T1andT2losses = T1andT2incoming - T1andT2outgoing;
      const T1T2unit4percentage = T1andT2incoming ? (T1andT2losses / T1andT2incoming) * 100 : 0;

      const T3andT4incoming = Trafo3Incoming + Trafo4Incoming;
      const T3andT4outgoing = Trafo3outgoing + Trafo4outgoing;
      const T3andT4losses = T3andT4incoming - T3andT4outgoing;
      const T3T4percentage = T3andT4incoming ? (T3andT4losses / T3andT4incoming) * 100 : 0;

      const TrasformerLosses =
        T1andT2losses + (Trafo3Incoming - Trafo3outgoing) + (Trafo4Incoming - Trafo4outgoing);

      const TotalTrasformepercentage =
        (T1andT2incoming + Trafo3Incoming + Trafo4Incoming)
          ? (TrasformerLosses / (T1andT2incoming + Trafo3Incoming + Trafo4Incoming)) * 100
          : 0;

      const HT_Transmission_Losses1 = Math.max(
        0,
        Wapda2 + Niigata + JMS - (mainincomingunit5 + PH_IC)
      );
      const HT_Transmissioin_Losses = HT_Transmission_Losses1 - hfoaux;

      // console.timeEnd('energy_calculations');

      // ---------------------------- SANKEY API TIMER
      // console.time('sankey_api_calls');

      let un1 = 0, un2 = 0, un3 = 0, un4 = 0;

      try {
        const payload = {
          startDate: start,
          endDate: endMoment.format('YYYY-MM-DD'),
          startTime: '06:00',
          endTime: '06:00',
        };

        const results = await Promise.allSettled([
          this.unit4LT1.getSankeyData(payload),
          this.unit4LT2.getSankeyData(payload),
          this.unit5LT3.getSankeyData(payload),
          this.unit5LT4.getSankeyData(payload),
        ]);

        if (results[0].status === 'fulfilled') un1 = getUnaccountedEnergyFromSankey(results[0].value);
        if (results[1].status === 'fulfilled') un2 = getUnaccountedEnergyFromSankey(results[1].value);
        if (results[2].status === 'fulfilled') un3 = getUnaccountedEnergyFromSankey(results[2].value);
        if (results[3].status === 'fulfilled') un4 = getUnaccountedEnergyFromSankey(results[3].value);
      } catch {}

      // console.timeEnd('sankey_api_calls');

      const unaccoutable_energy = Number((un1 + un2 + un3 + un4).toFixed(2));

      const f = (v: number) => v.toFixed(2);

      // ========== FINAL OUTPUT ==========
      return {
        total_consumption: {
          Wapda1: f(Wapda1),
          Wapda2: f(Wapda2),
          Niigata: f(Niigata),
          JMS: f(JMS),

          T1andT2incoming: f(T1andT2incoming),
          T1andT2outgoing: f(T1andT2outgoing),
          T1andT2losses: f(T1andT2losses),
          T1T2unit4percentage: f(T1T2unit4percentage),

          T3andT4incoming: f(T3andT4incoming),
          T3andT4outgoing: f(T3andT4outgoing),
          T3andT4losses: f(T3andT4losses),
          T3T4percentage: f(T3T4percentage),

          Solar1: f(Solar1),
          Solar2: f(Solar2),
          solarunit4: f(solarunit4),
          solar52: f(solar52),

          DieselandGasGenset: f(DieselandGasGenset),
          Wapdaexport: f(Wapdaexport),

          unaccoutable_energy: f(unaccoutable_energy),

          TrasformerLosses: f(TrasformerLosses),
          TotalTrasformepercentage: f(TotalTrasformepercentage),

          HT_Transmissioin_Losses: f(HT_Transmissioin_Losses),
        },
      };

    } finally {
      // console.timeEnd('getConsumption_totalTime'); // ------------------ MAIN TIMER END?
    }
  }
}
