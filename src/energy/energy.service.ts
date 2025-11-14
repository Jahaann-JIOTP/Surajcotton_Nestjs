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

// ================== CONFIG SECTION ==================

const TZ = 'Asia/Karachi';

const meterIds: string[] = [
  'U1_PLC', 'U2_PLC', 'U3_PLC', 'U4_PLC', 'U5_PLC', 'U6_PLC', 'U7_PLC', 'U8_PLC', 'U9_PLC',
  'U10_PLC', 'U11_PLC', 'U12_PLC', 'U13_PLC', 'U14_PLC', 'U15_PLC', 'U16_PLC', 'U17_PLC',
  'U18_PLC', 'U19_PLC', 'U20_PLC', 'U21_PLC', 'U22_PLC', 'U23_PLC', 'U24_PLC', 'U25_PLC',
  'U26_PLC', 'U27_PLC', 'U28_PLC',

  'U1_GW01', 'U2_GW01', 'U3_GW01', 'U4_GW01', 'U5_GW01', 'U6_GW01', 'U7_GW01', 'U8_GW01',
  'U9_GW01', 'U10_GW01', 'U11_GW01', 'U12_GW01', 'U13_GW01', 'U14_GW01', 'U15_GW01',
  'U16_GW01', 'U17_GW01', 'U18_GW01', 'U19_GW01', 'U20_GW01', 'U21_GW01', 'U22_GW01',
  'U23_GW01', 'U24_GW01',

  'U1_GW02', 'U2_GW02', 'U3_GW02', 'U4_GW02', 'U5_GW02', 'U6_GW02', 'U7_GW02', 'U8_GW02',
  'U9_GW02', 'U10_GW02', 'U11_GW02', 'U12_GW02', 'U13_GW02', 'U14_GW02', 'U15_GW02',
  'U16_GW02', 'U17_GW02', 'U18_GW02', 'U19_GW02', 'U20_GW02', 'U21_GW02', 'U22_GW02',
  'U23_GW02',

  'U1_GW03', 'U2_GW03', 'U3_GW03', 'U4_GW03', 'U5_GW03', 'U6_GW03', 'U7_GW03', 'U8_GW03',
  'U9_GW03', 'U10_GW03', 'U11_GW03', 'U12_GW03', 'U13_GW03', 'U14_GW03', 'U15_GW03',
  'U16_GW03', 'U17_GW03', 'U18_GW03', 'U19_GW03', 'U20_GW03', 'U21_GW03', 'U22_GW03',
  'U23_GW03',
];

const suffixes: string[] = [
  'Del_ActiveEnergy',
  'ActivePower_Total',
  'ActiveEnergy_Imp_kWh',
  'ActiveEnergy_Exp_kWh',
];

// precompute meter keys once
const ALL_METER_KEYS: string[] = meterIds.flatMap((id) =>
  suffixes.map((sfx) => `${id}_${sfx}`),
);

// group definitions
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
  Wapda1: ['U23_GW01_Del_ActiveEnergy'],
  Wapda2: ['U27_PLC_Del_ActiveEnergy'],
  Niigata: ['U22_PLC_Del_ActiveEnergy'],
  JMS: ['U26_PLC_Del_ActiveEnergy'],
  mainincomingunit5: ['U21_GW03_Del_ActiveEnergy'],
  hfoaux: ['U25_PLC_Del_ActiveEnergy'],
  WapdaExport: ['U20_GW03_ActiveEnergy_Exp_kWh', 'U19_GW03_ActiveEnergy_Exp_kWh'],

  Trafo1Incoming: ['U23_GW01_Del_ActiveEnergy'],
  Trafo2Incoming: ['U22_GW01_Del_ActiveEnergy'],
  Trafo3Incoming: ['U20_GW03_Del_ActiveEnergy'],
  Trafo4Incoming: ['U19_GW03_Del_ActiveEnergy'],

  Trafo1outgoing: ['U21_PLC_Del_ActiveEnergy'],
  Trafo2outgoing: ['U13_GW01_Del_ActiveEnergy'],
  Trafo3outgoing: ['U13_GW02_Del_ActiveEnergy'],
  Trafo4outgoing: ['U16_GW03_Del_ActiveEnergy'],

  DieselGensetandGasGenset: ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'],

  Solar1: ['U6_GW02_Del_ActiveEnergy'],
  Solar2: ['U17_GW03_Del_ActiveEnergy'],
  solarunit4: ['U24_GW01_Del_ActiveEnergy'],
  solar52: ['U28_PLC_Del_ActiveEnergy'],

  PH_IC: ['U22_GW01_Del_ActiveEnergy'],

  Unit4_LT1: [
    'U1_PLC_Del_ActiveEnergy', 'U2_PLC_Del_ActiveEnergy', 'U3_PLC_Del_ActiveEnergy',
    'U4_PLC_Del_ActiveEnergy', 'U5_PLC_Del_ActiveEnergy', 'U6_PLC_Del_ActiveEnergy',
    'U7_PLC_Del_ActiveEnergy', 'U8_PLC_Del_ActiveEnergy', 'U9_PLC_Del_ActiveEnergy',
    'U10_PLC_Del_ActiveEnergy', 'U11_PLC_Del_ActiveEnergy', 'U12_PLC_Del_ActiveEnergy',
    'U13_PLC_Del_ActiveEnergy', 'U14_PLC_Del_ActiveEnergy', 'U15_PLC_Del_ActiveEnergy',
    'U16_PLC_Del_ActiveEnergy', 'U17_PLC_Del_ActiveEnergy', 'U18_PLC_Del_ActiveEnergy',
    'U20_PLC_Del_ActiveEnergy',
  ],

  Unit4_LT2: [
    'U1_GW01_Del_ActiveEnergy', 'U2_GW01_Del_ActiveEnergy', 'U3_GW01_Del_ActiveEnergy',
    'U4_GW01_Del_ActiveEnergy', 'U5_GW01_Del_ActiveEnergy', 'U6_GW01_Del_ActiveEnergy',
    'U8_GW01_Del_ActiveEnergy', 'U9_GW01_Del_ActiveEnergy', 'U10_GW01_Del_ActiveEnergy',
    'U7_GW01_Del_ActiveEnergy', 'U12_GW01_Del_ActiveEnergy', 'U14_GW01_Del_ActiveEnergy',
    'U15_GW01_Del_ActiveEnergy', 'U16_GW01_Del_ActiveEnergy', 'U17_GW01_Del_ActiveEnergy',
    'U18_GW01_Del_ActiveEnergy', 'U19_GW01_Del_ActiveEnergy', 'U20_GW01_Del_ActiveEnergy',
    'U21_GW01_Del_ActiveEnergy',
  ],

  Unit5_LT1: [
    // 4 PDB meters skipped as per your comment
    'U5_GW02_Del_ActiveEnergy', 'U7_GW02_Del_ActiveEnergy', 'U8_GW02_Del_ActiveEnergy',
    'U9_GW02_Del_ActiveEnergy', 'U10_GW02_Del_ActiveEnergy', 'U11_GW02_Del_ActiveEnergy',
    'U12_GW02_Del_ActiveEnergy', 'U14_GW02_Del_ActiveEnergy', 'U15_GW02_Del_ActiveEnergy',
    'U16_GW02_Del_ActiveEnergy', 'U17_GW02_Del_ActiveEnergy', 'U18_GW02_Del_ActiveEnergy',
    'U19_GW02_Del_ActiveEnergy', 'U20_GW02_Del_ActiveEnergy', 'U21_GW02_Del_ActiveEnergy',
    'U22_GW02_Del_ActiveEnergy', 'U23_GW02_Del_ActiveEnergy',
  ],

  Unit5_LT2: [
    // 2 PDB meters skipped as per your comment
    'U1_GW03_Del_ActiveEnergy', 'U2_GW03_Del_ActiveEnergy', 'U3_GW03_Del_ActiveEnergy',
    'U4_GW03_Del_ActiveEnergy', 'U5_GW03_Del_ActiveEnergy', 'U6_GW03_Del_ActiveEnergy',
    'U7_GW03_Del_ActiveEnergy', 'U8_GW03_Del_ActiveEnergy', 'U9_GW03_Del_ActiveEnergy',
    'U10_GW03_Del_ActiveEnergy', 'U11_GW03_Del_ActiveEnergy', 'U12_GW03_Del_ActiveEnergy',
    'U13_GW03_Del_ActiveEnergy', 'U14_GW03_Del_ActiveEnergy', 'U15_GW03_Del_ActiveEnergy',
    'U18_GW03_Del_ActiveEnergy',
  ],

  Aux_consumption: ['U25_PLC_Del_ActiveEnergy'],

  totalgeneration1: [
    'U1_PLC_Del_ActiveEnergy', 'U2_PLC_Del_ActiveEnergy', 'U3_PLC_Del_ActiveEnergy',
    'U4_PLC_Del_ActiveEnergy', 'U5_PLC_Del_ActiveEnergy', 'U6_PLC_Del_ActiveEnergy',
    'U7_PLC_Del_ActiveEnergy', 'U8_PLC_Del_ActiveEnergy', 'U9_PLC_Del_ActiveEnergy',
    'U10_PLC_Del_ActiveEnergy', 'U11_PLC_Del_ActiveEnergy', 'U12_PLC_Del_ActiveEnergy',
    'U13_PLC_Del_ActiveEnergy', 'U14_PLC_Del_ActiveEnergy', 'U15_PLC_Del_ActiveEnergy',
    'U16_PLC_Del_ActiveEnergy', 'U17_PLC_Del_ActiveEnergy', 'U18_PLC_Del_ActiveEnergy',
    'U20_PLC_Del_ActiveEnergy',

    'U1_GW01_Del_ActiveEnergy', 'U2_GW01_Del_ActiveEnergy', 'U3_GW01_Del_ActiveEnergy',
    'U4_GW01_Del_ActiveEnergy', 'U5_GW01_Del_ActiveEnergy', 'U6_GW01_Del_ActiveEnergy',
    'U8_GW01_Del_ActiveEnergy', 'U9_GW01_Del_ActiveEnergy', 'U10_GW01_Del_ActiveEnergy',
    'U12_GW01_Del_ActiveEnergy', 'U14_GW01_Del_ActiveEnergy', 'U15_GW01_Del_ActiveEnergy',
    'U16_GW01_Del_ActiveEnergy', 'U18_GW01_Del_ActiveEnergy', 'U19_GW01_Del_ActiveEnergy',
    'U20_GW01_Del_ActiveEnergy', 'U21_GW01_Del_ActiveEnergy', 'U22_GW01_Del_ActiveEnergy',

    'U1_GW02_Del_ActiveEnergy', 'U2_GW02_Del_ActiveEnergy', 'U3_GW02_Del_ActiveEnergy',
    'U4_GW02_Del_ActiveEnergy', 'U5_GW02_Del_ActiveEnergy', 'U7_GW02_Del_ActiveEnergy',
    'U8_GW02_Del_ActiveEnergy', 'U9_GW02_Del_ActiveEnergy', 'U10_GW02_Del_ActiveEnergy',
    'U11_GW02_Del_ActiveEnergy', 'U12_GW02_Del_ActiveEnergy', 'U14_GW02_Del_ActiveEnergy',
    'U15_GW02_Del_ActiveEnergy', 'U16_GW02_Del_ActiveEnergy', 'U17_GW02_Del_ActiveEnergy',
    'U18_GW02_Del_ActiveEnergy', 'U19_GW02_Del_ActiveEnergy', 'U20_GW02_Del_ActiveEnergy',
    'U21_GW02_Del_ActiveEnergy', 'U22_GW02_Del_ActiveEnergy', 'U23_GW02_Del_ActiveEnergy',

    'U1_GW03_Del_ActiveEnergy', 'U2_GW03_Del_ActiveEnergy', 'U3_GW03_Del_ActiveEnergy',
    'U4_GW03_Del_ActiveEnergy', 'U5_GW03_Del_ActiveEnergy', 'U6_GW03_Del_ActiveEnergy',
    'U7_GW03_Del_ActiveEnergy', 'U8_GW03_Del_ActiveEnergy', 'U9_GW03_Del_ActiveEnergy',
    'U10_GW03_Del_ActiveEnergy', 'U11_GW03_Del_ActiveEnergy', 'U12_GW03_Del_ActiveEnergy',
    'U13_GW03_Del_ActiveEnergy', 'U14_GW03_Del_ActiveEnergy', 'U15_GW03_Del_ActiveEnergy',
    'U18_GW03_Del_ActiveEnergy', 'U19_GW03_Del_ActiveEnergy', 'U22_GW03_Del_ActiveEnergy',
  ],

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

// build projection once per request
function buildProjection() {
  const projection: Record<string, 1> = { timestamp: 1 as 1 };
  for (const key of ALL_METER_KEYS) {
    projection[key] = 1;
  }
  return projection;
}

// sum helper
function sumGroup(consumption: Record<string, number>, keys: string[]): number {
  return keys.reduce((sum, key) => sum + (consumption[key] || 0), 0);
}

function getUnaccountedEnergyFromSankey(raw: any): number {
  const data = Array.isArray(raw) ? raw : raw?.sankeyData || [];
  const node = data.find((n: any) => n.to === 'Unaccounted Energy');
  return node?.value || 0;
}

// ================== SERVICE ==================

@Injectable()
export class EnergyService {
  constructor(
    @InjectModel(Energy.name, 'surajcotton')
    private readonly energyModel: Model<EnergyDocument>,
    private readonly unit4LT1Service: Unit4LT1Service,
    private readonly unit4LT2Service: Unit4LT2Service,
    private readonly unit5LT3Service: Unit5LT3Service,
    private readonly unit5LT4Service: Unit5LT4Service,
  ) {}

  async getConsumption(start: string, end: string) {
    // ---------- Time Window: 06:00 to next day 06:00 ----------
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
      timestamp: {
        $gte: startStr,
        $lte: endStr,
      },
    };

    // ---------- Aggregate ----------
    const projection = buildProjection();
//     console.log("=== DEBUG QUERY WINDOW ===");
// console.log("StartStr:", startStr);
// console.log("EndStr  :", endStr);

const sample = await this.energyModel
  .findOne({})
  .sort({ timestamp: 1 })
  .select({ timestamp: 1 });

// console.log("Earliest Timestamp In DB:", sample?.timestamp);
// console.log("===========================");

    const result = await this.energyModel.aggregate([
      { $match: matchStage },
      { $project: projection },
      { $sort: { timestamp: 1 } },
    ]);

    if (!result.length) {
      // if no data, return all zeros so frontend doesn't break
      return {
        total_consumption: {
          LTGeneration: '0.00',
          SolarGeneration: '0.00',
          WapdaImport: '0.00',
          Wapda1: '0.00',
          Wapda2: '0.00',
          Niigata: '0.00',
          JMS: '0.00',
          mainincomingunit5: '0.00',
          hfoaux:'0.00',
          Unit4_LT1: '0.00',
          Unit4_LT2: '0.00',
          Unit5_LT1: '0.00',
          Unit5_LT2: '0.00',
          PH_ICKeys: '0.00',
          Wapdaexport: '0.00',
          T1andT2incoming: '0.00',
          T1andT2outgoing: '0.00',
          T1andT2losses: '0.00',
          T1T2unit4percentage: '0.00',
          Trafo3Incoming: '0.00',
          Trafo4Incoming: '0.00',
          Trafo3outgoing: '0.00',
          Trafo4outgoing: '0.00',
          HT_Transmissioin_Losses: '0.00',
          Trafo1losses: '0.00',
          Trafo2losses: '0.00',
          Trafo3losses: '0.00',
          T1unit5percentage: '0.00',
          Trafo4losses: '0.00',
          T2unit5percentage: '0.00',
          TrasformerLosses: '0.00',
          TotalTrasformepercentage: '0.00',
          Solar1: '0.00',
          Solar2: '0.00',
          solarunit4: '0.00',
          solar52: '0.00',
          Aux_consumption: '0.00',
          Total_Generation: '0.00',
          totalgeneration1: '0.00',
          U4_Consumption: '0.00',
          U5_Consumption: '0.00',
          HT_Generation: '0.00',
          total_energy_input: '0.00',
          totalenergyoutput: '0.00',
          unaccoutable_energy: '0.00',
          DieselandGasGenset: '0.00',
        },
      };
    }

    // ---------- First / Last values (optimized loop) ----------
    // ---------- First / Last values (improved logic) ----------
const firstValues: Record<string, number> = {};
const lastValues: Record<string, number> = {};

// Pass 1: Pick last values & first VALID (non-zero) values
for (const doc of result) {
  for (const [key, raw] of Object.entries(doc)) {
    if (key === 'timestamp') continue;
    const val = Number(raw);
    if (isNaN(val)) continue;

    // Always set last value
    lastValues[key] = val;

    // Set FIRST valid value (skip 0 or null)
    if (!(key in firstValues) && val > 0) {
      firstValues[key] = val;
    }
  }
}

// Pass 2: If some firstValues still missing (all zero for that meter),
// fallback to first non-null value
for (const doc of result) {
  for (const [key, raw] of Object.entries(doc)) {
    if (key === 'timestamp') continue;
    if (key in firstValues) continue;

    const val = Number(raw);
    if (!isNaN(val)) {
      firstValues[key] = val;
    }
  }
}


    // ---------- Consumption ----------
    const consumption: Record<string, number> = {};
for (const key of Object.keys(firstValues)) {
  let diff = (lastValues[key] ?? 0) - (firstValues[key] ?? 0);
  
  const diffStr = diff.toString();
  if (
    diffStr.includes('e+') ||
    diffStr.includes('e-') ||
    Math.abs(diff) > 1e10 ||
    Math.abs(diff) < 1e-5
  ) {
    diff = 0;
  }

  consumption[key] = diff;
}


    // ---------- Group Sums ----------
    const LTGeneration = sumGroup(consumption, GROUP_KEYS.LTGeneration);
    const SolarGeneration = sumGroup(consumption, GROUP_KEYS.SolarGeneration);
    const HT_Generation = sumGroup(consumption, GROUP_KEYS.HT_Generation);

    const WapdaImport = sumGroup(consumption, GROUP_KEYS.WapdaImport);
    const Wapda1 = sumGroup(consumption, GROUP_KEYS.Wapda1);
    const Wapda2 = sumGroup(consumption, GROUP_KEYS.Wapda2);
    const Niigata = sumGroup(consumption, GROUP_KEYS.Niigata);
    const JMS = sumGroup(consumption, GROUP_KEYS.JMS);
    const mainincomingunit5 = sumGroup(consumption, GROUP_KEYS.mainincomingunit5);
    const hfoaux = sumGroup(consumption, GROUP_KEYS.hfoaux);
    const WapdaExport = sumGroup(consumption, GROUP_KEYS.WapdaExport);

    const Trafo1Incoming = sumGroup(consumption, GROUP_KEYS.Trafo1Incoming);
    const Trafo2Incoming = sumGroup(consumption, GROUP_KEYS.Trafo2Incoming);
    const Trafo3Incoming = sumGroup(consumption, GROUP_KEYS.Trafo3Incoming);
    const Trafo4Incoming = sumGroup(consumption, GROUP_KEYS.Trafo4Incoming);

    const Trafo1outgoing = sumGroup(consumption, GROUP_KEYS.Trafo1outgoing);
    const Trafo2outgoing = sumGroup(consumption, GROUP_KEYS.Trafo2outgoing);
    const Trafo3outgoing = sumGroup(consumption, GROUP_KEYS.Trafo3outgoing);
    const Trafo4outgoing = sumGroup(consumption, GROUP_KEYS.Trafo4outgoing);

    const DieselandGasGenset = sumGroup(consumption, GROUP_KEYS.DieselGensetandGasGenset);

    const Solar1 = sumGroup(consumption, GROUP_KEYS.Solar1);
    const Solar2 = sumGroup(consumption, GROUP_KEYS.Solar2);
    const solarunit4 = sumGroup(consumption, GROUP_KEYS.solarunit4);
    const solar52 = sumGroup(consumption, GROUP_KEYS.solar52);

    const PH_IC = sumGroup(consumption, GROUP_KEYS.PH_IC);

    const Unit4_LT1 = sumGroup(consumption, GROUP_KEYS.Unit4_LT1);
    const Unit4_LT2 = sumGroup(consumption, GROUP_KEYS.Unit4_LT2);
    const Unit5_LT1 = sumGroup(consumption, GROUP_KEYS.Unit5_LT1);
    const Unit5_LT2 = sumGroup(consumption, GROUP_KEYS.Unit5_LT2);

    const Aux_consumption = sumGroup(consumption, GROUP_KEYS.Aux_consumption);
    const totalgeneration1 = sumGroup(consumption, GROUP_KEYS.totalgeneration1);

    const U4_Consumption = sumGroup(consumption, GROUP_KEYS.U4_Consumption);
    const U5_Consumption = sumGroup(consumption, GROUP_KEYS.U5_Consumption);

    // ---------- Formulas ----------
    const totalGeneration = LTGeneration + SolarGeneration + HT_Generation;
    const totalenergyinput = LTGeneration + SolarGeneration + WapdaImport + HT_Generation;
    const totalenergyoutput = U4_Consumption + U5_Consumption + Aux_consumption;

    const T1andT2incoming = Trafo1Incoming + Trafo2Incoming;
    const T1andT2outgoing = Trafo1outgoing + Trafo2outgoing;
    const T1andT2losses = T1andT2incoming - T1andT2outgoing;
    const T1T2percentage =
      T1andT2incoming !== 0 ? (T1andT2losses / T1andT2incoming) * 100 : 0;

    const Trafo1losses = Trafo1Incoming - Trafo1outgoing;
    const Trafo2losses = Trafo2Incoming - Trafo2outgoing;
    const Trafo3losses = Trafo3Incoming - Trafo3outgoing;
    // console.log(Trafo3losses,'trafo3');
    const Trafo4losses = Trafo4Incoming - Trafo4outgoing;
    // console.log(Trafo4losses,'trafo4');

    const T3percentage =
      Trafo3Incoming !== 0 ? (Trafo3losses / Trafo3Incoming) * 100 : 0;
      //  console.log(T3percentage,'trafopercent');
    const T4percentage =
      Trafo4Incoming !== 0 ? (Trafo4losses / Trafo4Incoming) * 100 : 0;
          // console.log(T4percentage,'trafopercent4');
    const T3andT4incoming=Trafo3Incoming + Trafo4Incoming;
    const T3andT4outing=Trafo3outgoing + Trafo4outgoing;
    const T3andT4losses = T3andT4incoming - T3andT4outing;
    const T3T4percentage =
      T3andT4incoming !== 0 ? (T3andT4losses / T3andT4incoming) * 100 : 0;

    const TrasformerLosses = T1andT2losses + Trafo3losses + Trafo4losses;
    const TotalTrasformepercentage =
      T1andT2incoming + Trafo3Incoming + Trafo4Incoming !== 0
        ? (TrasformerLosses /
            (T1andT2incoming + Trafo3Incoming + Trafo4Incoming)) *
          100
        : 0;

    // const HT_Transmissioin_Losses =
    //   Wapda2 + Niigata + JMS - (Trafo3Incoming + Trafo4Incoming + PH_IC);

    const HT_Transmission_Losses1 = Math.max(0, (Wapda2 + Niigata + JMS) - (mainincomingunit5 + PH_IC));
    const HT_Transmissioin_Losses = HT_Transmission_Losses1 - hfoaux;
    // console.log(hfoaux,'hfoaux');

    // ---------- LT Unaccounted Energy (run in parallel) ----------
    let unaccountedFromLT1 = 0;
    let unaccountedFromLT2 = 0;
    let unaccountedFromLT3 = 0;
    let unaccountedFromLT4 = 0;

    try {
      const payload = {
        startDate: start,
        endDate: endMoment.format('YYYY-MM-DD'), // same logic as your code
        startTime: '06:00',
        endTime: '06:00',
      };

      const [lt1Data, lt2Data, lt3Data, lt4Data] = await Promise.all([
        this.unit4LT1Service.getSankeyData(payload),
        this.unit4LT2Service.getSankeyData(payload),
        this.unit5LT3Service.getSankeyData(payload),
        this.unit5LT4Service.getSankeyData(payload),
      ]);

      unaccountedFromLT1 = getUnaccountedEnergyFromSankey(lt1Data);
      unaccountedFromLT2 = getUnaccountedEnergyFromSankey(lt2Data);
      unaccountedFromLT3 = getUnaccountedEnergyFromSankey(lt3Data);
      unaccountedFromLT4 = getUnaccountedEnergyFromSankey(lt4Data);
    } catch (err: any) {
      // optional: log
      // console.warn('Error fetching LT unaccounted energy:', err?.message || err);
    }

    const unaccoutable_energy = +(
      unaccountedFromLT1 +
      unaccountedFromLT2 +
      unaccountedFromLT3 +
      unaccountedFromLT4
    ).toFixed(2);

    // ---------- Final Response (same structure as your original) ----------
    return {
      total_consumption: {
        LTGeneration: LTGeneration.toFixed(2),
        SolarGeneration: SolarGeneration.toFixed(2),
        WapdaImport: WapdaImport.toFixed(2),
        Wapda1: Wapda1.toFixed(2),
        Wapda2: Wapda2.toFixed(2),
        Niigata: Niigata.toFixed(2),
        JMS: JMS.toFixed(2),
        Unit4_LT1: Unit4_LT1.toFixed(2),
        Unit4_LT2: Unit4_LT2.toFixed(2),
        Unit5_LT1: Unit5_LT1.toFixed(2),
        Unit5_LT2: Unit5_LT2.toFixed(2),
        PH_ICKeys: PH_IC.toFixed(2),
        Wapdaexport: WapdaExport.toFixed(2),
        T1andT2incoming: T1andT2incoming.toFixed(2),
        T1andT2outgoing: T1andT2outgoing.toFixed(2),
        T1andT2losses: T1andT2losses.toFixed(2),
        T1T2unit4percentage: T1T2percentage.toFixed(2),
        Trafo3Incoming: Trafo3Incoming.toFixed(2),
        Trafo4Incoming: Trafo4Incoming.toFixed(2),
        Trafo3outgoing: Trafo3outgoing.toFixed(2),
        Trafo4outgoing: Trafo4outgoing.toFixed(2),
        HT_Transmissioin_Losses: HT_Transmissioin_Losses.toFixed(2),
        Trafo1losses: Trafo1losses.toFixed(2),
        Trafo2losses: Trafo2losses.toFixed(2),
        Trafo3losses: Trafo3losses.toFixed(2),
        T1unit5percentage: T3percentage.toFixed(2),
        Trafo4losses: Trafo4losses.toFixed(2),
        T2unit5percentage: T4percentage.toFixed(2),
        TrasformerLosses: TrasformerLosses.toFixed(2),
        TotalTrasformepercentage: TotalTrasformepercentage.toFixed(2),
        Solar1: Solar1.toFixed(2),
        Solar2: Solar2.toFixed(2),
        solarunit4: solarunit4.toFixed(2),
        solar52: solar52.toFixed(2),
        Aux_consumption: Aux_consumption.toFixed(2),
        Total_Generation: totalGeneration.toFixed(2),
        totalgeneration1: totalgeneration1.toFixed(2),
        U4_Consumption: U4_Consumption.toFixed(2),
        U5_Consumption: U5_Consumption.toFixed(2),
        HT_Generation: HT_Generation.toFixed(2),
        total_energy_input: totalenergyinput.toFixed(2),
        totalenergyoutput: totalenergyoutput.toFixed(2),
        unaccoutable_energy: unaccoutable_energy.toFixed(2),
        DieselandGasGenset: DieselandGasGenset.toFixed(2),
        T3andT4incoming: T3andT4incoming.toFixed(2),
        T3andT4outgoing: T3andT4outing.toFixed(2),
        T3andT4losses: T3andT4losses.toFixed(2),
        T3T4percentage: T3T4percentage.toFixed(2),

      },
    };
  }
}
