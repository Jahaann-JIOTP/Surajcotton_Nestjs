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

/* ===================== GROUP KEYS ===================== */
const GROUP_KEYS = {
  Wapda1: ['U23_GW01_Del_ActiveEnergy'],
  Wapda2: ['U27_PLC_Del_ActiveEnergy'],

  Niigata: ['U22_PLC_Del_ActiveEnergy'],
  JMS: ['U26_PLC_Del_ActiveEnergy'],

  Solar1: ['U6_GW02_Del_ActiveEnergy'],
  Solar2: ['U17_GW03_Del_ActiveEnergy'],
  solarunit4: ['U24_GW01_Del_ActiveEnergy'],
  solar52: ['U28_PLC_Del_ActiveEnergy'],

  DieselandGasGenset: [
    'U19_PLC_Del_ActiveEnergy',
    'U11_GW01_Del_ActiveEnergy',
  ],

  Wapdaexport: [
    'U20_GW03_ActiveEnergy_Exp_kWh',
    'U19_GW03_ActiveEnergy_Exp_kWh',
  ],

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

/* ===================== HELPERS ===================== */
const sumGroup = (data: Record<string, number>, keys: string[]) =>
  keys.reduce((s, k) => s + (data[k] || 0), 0);

const safeDiff = (first: any, last: any): number => {
  const diff = Number(last || 0) - Number(first || 0);
  return !isFinite(diff) || diff < 0 || Math.abs(diff) > 1e10 ? 0 : diff;
};

const percent = (loss: number, total: number) =>
  total ? (loss / total) * 100 : 0;

const fmt = (v: number) => v.toFixed(2);

const getUnaccountedFromSankey = (raw: any): number => {
  const data = Array.isArray(raw) ? raw : raw?.sankeyData || [];
  return data.find((n: any) => n.to === 'Unaccounted Energy')?.value || 0;
};

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
    /* ===================== TIME WINDOW ===================== */
    const startMoment = moment.tz(`${start} 06:00:00`, TZ);

      const endMoment =
        start === end
        ? startMoment.clone().add(1, 'day').endOf('minute')
        : moment.tz(`${end} 06:00:00`, TZ).endOf('minute');

      const matchStage = {
        timestamp: {
          $gte: startMoment.format(),
        $lte: endMoment.clone().add(2, 'minutes').format(), // safety buffer
        },
      };

    /* ===================== AGGREGATION ===================== */
    const requiredKeys = [...new Set(Object.values(GROUP_KEYS).flat())];

    const projectStage = requiredKeys.reduce(
      (acc, k) => ({ ...acc, [k]: 1 }),
      { timestamp: 1 },
    );

    const groupStage = requiredKeys.reduce(
      (acc, k) => ({
        ...acc,
        [`${k}_first`]: { $first: `$${k}` },
        [`${k}_last`]: { $last: `$${k}` },
      }),
      { _id: null },
    );

    const [doc] = await this.energyModel.aggregate([
        { $match: matchStage },
        { $sort: { timestamp: 1 } },
      { $project: projectStage },
        { $group: groupStage },
      ]);

    if (!doc) {
        return {
        total_consumption: Object.fromEntries(
          Object.keys(GROUP_KEYS).map((k) => [k, '0.00']),
        ),
        };
      }

    /* ===================== DIFF CALC ===================== */
      const consumption: Record<string, number> = {};
    for (const k of requiredKeys) {
      consumption[k] = safeDiff(doc[`${k}_first`], doc[`${k}_last`]);
    }

    /* ===================== ENERGY CALCS ===================== */
      const Wapda1 = sumGroup(consumption, GROUP_KEYS.Wapda1);
      const Wapda2 = sumGroup(consumption, GROUP_KEYS.Wapda2);
      const Niigata = sumGroup(consumption, GROUP_KEYS.Niigata);
      const JMS = sumGroup(consumption, GROUP_KEYS.JMS);

      const Solar1 = sumGroup(consumption, GROUP_KEYS.Solar1);
      const Solar2 = sumGroup(consumption, GROUP_KEYS.Solar2);
      const solarunit4 = sumGroup(consumption, GROUP_KEYS.solarunit4);
      const solar52 = sumGroup(consumption, GROUP_KEYS.solar52);

    const DieselandGasGenset = sumGroup(
      consumption,
      GROUP_KEYS.DieselandGasGenset,
    );
      const Wapdaexport = sumGroup(consumption, GROUP_KEYS.Wapdaexport);

    const T1In = sumGroup(consumption, GROUP_KEYS.Trafo1Incoming);
    const T2In = sumGroup(consumption, GROUP_KEYS.Trafo2Incoming);
    const T3In = sumGroup(consumption, GROUP_KEYS.Trafo3Incoming);
    const T4In = sumGroup(consumption, GROUP_KEYS.Trafo4Incoming);

    const T1Out = sumGroup(consumption, GROUP_KEYS.Trafo1outgoing);
    const T2Out = sumGroup(consumption, GROUP_KEYS.Trafo2outgoing);
    const T3Out = sumGroup(consumption, GROUP_KEYS.Trafo3outgoing);
    const T4Out = sumGroup(consumption, GROUP_KEYS.Trafo4outgoing);

    const T12In = T1In + T2In;
    const T12Out = T1Out + T2Out;
    const T12Loss = T12In - T12Out;

    const T34In = T3In + T4In;
    const T34Out = T3Out + T4Out;
    const T34Loss = T34In - T34Out;

    const TransformerLosses = T12Loss + T34Loss;

    const HTLoss =
      Math.max(
        0,
        Wapda2 +
          Niigata +
          JMS -
          (sumGroup(consumption, GROUP_KEYS.mainincomingunit5) +
            sumGroup(consumption, GROUP_KEYS.PH_IC)),
      ) - sumGroup(consumption, GROUP_KEYS.hfoaux);

    /* ===================== SANKEY ===================== */
        const payload = {
          startDate: start,
          endDate: endMoment.format('YYYY-MM-DD'),
          startTime: '06:00',
          endTime: '06:00',
        };

    const sankeyResults = await Promise.allSettled([
          this.unit4LT1.getSankeyData(payload),
          this.unit4LT2.getSankeyData(payload),
          this.unit5LT3.getSankeyData(payload),
          this.unit5LT4.getSankeyData(payload),
        ]);

    const unaccoutable_energy = sankeyResults.reduce(
      (sum, r) =>
        r.status === 'fulfilled'
          ? sum + getUnaccountedFromSankey(r.value)
          : sum,
      0,
    );

    /* ===================== RESPONSE ===================== */
      return {
        total_consumption: {
        Wapda1: fmt(Wapda1),
        Wapda2: fmt(Wapda2),
        Niigata: fmt(Niigata),
        JMS: fmt(JMS),

        T1andT2incoming: fmt(T12In),
        T1andT2outgoing: fmt(T12Out),
        T1andT2losses: fmt(T12Loss),
        T1T2unit4percentage: fmt(percent(T12Loss, T12In)),

        T3andT4incoming: fmt(T34In),
        T3andT4outgoing: fmt(T34Out),
        T3andT4losses: fmt(T34Loss),
        T3T4percentage: fmt(percent(T34Loss, T34In)),

        Solar1: fmt(Solar1),
        Solar2: fmt(Solar2),
        solarunit4: fmt(solarunit4),
        solar52: fmt(solar52),

        DieselandGasGenset: fmt(DieselandGasGenset),
        Wapdaexport: fmt(Wapdaexport),

        unaccoutable_energy: fmt(unaccoutable_energy),

        TrasformerLosses: fmt(TransformerLosses),
        TotalTrasformepercentage: fmt(
          percent(TransformerLosses, T12In + T34In),
        ),

        HT_Transmissioin_Losses: fmt(HTLoss),
        },
      };
  }
}
