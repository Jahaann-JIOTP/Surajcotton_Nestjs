import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { sankey } from './schemas/sankey.schema';
import { Unit4LT1Service } from '../unit4_lt1/unit4_lt1.service';
import { Unit4LT2Service } from '../unit4_lt2/unit4_lt2.service';
import { Unit5LT3Service } from '../unit5_lt3/unit5_lt3.service';
import { Unit5LT4Service } from '../unit5_lt4/unit5_lt4.service';

@Injectable()
export class sankeyService {
  constructor(
    @InjectModel(sankey.name, 'surajcotton')
    private readonly unitModel: Model<sankey>,
     private readonly unit4LT1Service: Unit4LT1Service,
     private readonly unit4LT2Service: Unit4LT2Service,
     private readonly Unit5LT3Service: Unit5LT3Service,
     private readonly Unit5LT4Service: Unit5LT4Service,
  ) {}
// main sankey
  async getmainSankey(payload: { startDate: string; endDate: string; startTime: string; endTime: string }) {
    const TZ = 'Asia/Karachi';

    if (!payload.startDate || !payload.endDate || !payload.startTime || !payload.endTime) {
      throw new BadRequestException('Missing required parameters.');
    }

    const startMoment = moment
      .tz(`${payload.startDate} ${payload.startTime}`, 'YYYY-MM-DD HH:mm', TZ)
      .startOf('minute')
      .toDate();
    const endMoment = moment
      .tz(`${payload.endDate} ${payload.endTime}`, 'YYYY-MM-DD HH:mm', TZ)
      .endOf('minute')
      .toDate();

    const startISO = startMoment.toISOString();
    const endISO = endMoment.toISOString();

    // console.log('📌 Start ISO:', startISO);
    // console.log('📌 End ISO:', endISO);

    // ---------------- Generation mapping (only visible nodes) ----------------
    const generationMap: Record<string, string[]> = {
      'HT Generation': ['U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy'],
      'LT Generation': ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'],
      'Solar Generation': [
        'U24_GW01_Del_ActiveEnergy',
        'U28_PLC_Del_ActiveEnergy',
        'U6_GW02_Del_ActiveEnergy',
        'U17_GW03_Del_ActiveEnergy',
      ],
      'WAPDA': ['U27_PLC_Del_ActiveEnergy', 'U23_GW01_Del_ActiveEnergy'],
    };

    // ✅ Transformer Incoming tags (used for loss calculation only)
    const transformerIncomingTags = [
      'U23_GW01_Del_ActiveEnergy', // Trafo 1
      'U22_GW01_Del_ActiveEnergy', // Trafo 2
      'U20_GW03_Del_ActiveEnergy', // Trafo 3
      'U19_GW03_Del_ActiveEnergy', // Trafo 4
    ];

    // ---------------- Consumption mapping ----------------
    const consumptionMap: Record<string, string[]> = {
      'Unit 4 Incomer': [
        'U19_PLC_Del_ActiveEnergy',
        'U21_PLC_Del_ActiveEnergy',
        'U13_GW01_Del_ActiveEnergy',
        'U11_GW01_Del_ActiveEnergy',
        'U24_GW01_Del_ActiveEnergy',
        'U28_PLC_Del_ActiveEnergy',
      ],
      'Unit 5 Incomer': [
        'U13_GW02_Del_ActiveEnergy',
        'U16_GW03_Del_ActiveEnergy',
        'U6_GW02_Del_ActiveEnergy',
        'U17_GW03_Del_ActiveEnergy',
      ],
      // 'Aux Consumption': ['U25_PLC_Del_ActiveEnergy'],
    };

    // ---------------- Build all required meter fields ----------------
    const generationFields = Object.values(generationMap).flat();
    const consumptionFields = Object.values(consumptionMap).flat();
    const meterFields = Array.from(
  new Set([
    ...generationFields,
    ...consumptionFields,
    ...transformerIncomingTags,

    // ✅ REQUIRED FOR HT LOSS
    'U21_GW03_Del_ActiveEnergy', // mainIncomingUnit5
    'U25_PLC_Del_ActiveEnergy', // HFO
  ]),
);

    // ---------------- Aggregation pipeline ----------------
    const projection: any = {};
    meterFields.forEach((field) => {
      projection[`first_${field}`] = { $first: `$${field}` };
      projection[`last_${field}`] = { $last: `$${field}` };
    });

    const pipeline: any[] = [
      { $addFields: { ts: { $toDate: '$timestamp' } } },
      { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) } } },
      { $sort: { ts: 1 } },
      { $group: { _id: null, ...projection } },
    ];

    const results = await this.unitModel.aggregate(pipeline).exec();

    // ---------------- Calculate meter-wise totals ----------------
    const consumptionTotals: Record<string, number> = {};
    meterFields.forEach((field) => (consumptionTotals[field] = 0));

    for (const entry of results) {
      for (const field of meterFields) {
        const first = entry[`first_${field}`] || 0;
        const last = entry[`last_${field}`] || 0;
        const consumption = last - first;
        if (!isNaN(consumption) && consumption >= 0) {
          consumptionTotals[field] += parseFloat(consumption.toFixed(2));
        }
      }
    }

    // ---------------- Compute generation totals ----------------
    const generationTotals: Record<string, number> = {};
    Object.entries(generationMap).forEach(([group, meters]) => {
      const total = meters.reduce((sum, field) => sum + (consumptionTotals[field] || 0), 0);
      generationTotals[group] = +total.toFixed(2);
    });

    const totalGeneration = Object.values(generationTotals).reduce((sum, val) => sum + val, 0);

    // ---------------- Calculate Transformer and HT Losses ----------------
    const Trafo1Incoming = consumptionTotals['U23_GW01_Del_ActiveEnergy'] || 0;
    const Trafo2Incoming = consumptionTotals['U22_GW01_Del_ActiveEnergy'] || 0;
    const Trafo3Incoming = consumptionTotals['U20_GW03_Del_ActiveEnergy'] || 0;
    const Trafo4Incoming = consumptionTotals['U19_GW03_Del_ActiveEnergy'] || 0;

    const Trafo1outgoing = consumptionTotals['U21_PLC_Del_ActiveEnergy'] || 0;
    const Trafo2outgoing = consumptionTotals['U13_GW01_Del_ActiveEnergy'] || 0;
    const Trafo3outgoing = consumptionTotals['U13_GW02_Del_ActiveEnergy'] || 0;
    const Trafo4outgoing = consumptionTotals['U16_GW03_Del_ActiveEnergy'] || 0;

    const Trafo1losses = Trafo1Incoming - Trafo1outgoing;
    const Trafo2losses = Trafo2Incoming - Trafo2outgoing;
    const Trafo3losses = Trafo3Incoming - Trafo3outgoing;
    const Trafo4losses = Trafo4Incoming - Trafo4outgoing;

    const TransformerLosses = Trafo1losses + Trafo2losses + Trafo3losses + Trafo4losses;

    const Wapda2 = consumptionTotals['U27_PLC_Del_ActiveEnergy'] || 0;
    const Niigata = consumptionTotals['U22_PLC_Del_ActiveEnergy'] || 0;
    const JMS = consumptionTotals['U26_PLC_Del_ActiveEnergy'] || 0;
    const PH_IC = consumptionTotals['U22_GW01_Del_ActiveEnergy'] || 0;
  const mainIncomingUnit5 =
  consumptionTotals['U21_GW03_Del_ActiveEnergy'] || 0;

const hfoaux= consumptionTotals['U25_PLC_Del_ActiveEnergy'] || 0;

  const HT_Transmission_Losses = Math.max(
  0,
  (Wapda2 + Niigata + JMS) -
  (mainIncomingUnit5 + PH_IC) -
  (hfoaux)
);


    const losses=TransformerLosses + HT_Transmission_Losses;

    // ---------------- Compute consumption totals ----------------
    const unitConsumptionTotals: Record<string, number> = {};
    Object.entries(consumptionMap).forEach(([group, meters]) => {
      const total = meters.reduce((sum, field) => sum + (consumptionTotals[field] || 0), 0);
      unitConsumptionTotals[group] = +total.toFixed(2);
    });

    // ---------------- Build Sankey output ----------------
    const sankeyData: any[] = [];

    for (const [source, value] of Object.entries(generationTotals)) {
      sankeyData.push({ from: source, to: 'Total Generation', value });
    }

    for (const [target, value] of Object.entries(unitConsumptionTotals)) {
      sankeyData.push({ from: 'Total Generation', to: target, value });
    }

    const totalConsumed = Object.values(unitConsumptionTotals).reduce((a, b) => a + b, 0);
    const totalOut = totalConsumed + TransformerLosses + HT_Transmission_Losses;
    // ---------------- Compute Unaccounted Energy from LT1 and LT2 ----------------
      let unaccountedFromLT1 = 0;
      let unaccountedFromLT2 = 0;
      let unaccountedFromLT3 = 0;
      let unaccountedFromLT4 = 0;

      try {
        const lt1Data = await this.unit4LT1Service.getSankeyData(payload);

          let sankeyData: { from: string; to: string; value: number }[] = [];

          if (Array.isArray(lt1Data)) {
            sankeyData = lt1Data; // service returned array only
          } else {
            sankeyData = lt1Data.sankeyData; // service returned { sankeyData, totals }
          }

          const nodeLT1 = sankeyData.find(n => n.to === 'Unaccounted Energy');
        if (nodeLT1) unaccountedFromLT1 = nodeLT1.value || 0;

        // const lt2Data = await this.unit4LT2Service.getSankeyData(payload);
        // const nodeLT2 = lt2Data.find(n => n.to === 'Unaccounted Energy');
        // if (nodeLT2) unaccountedFromLT2 = nodeLT2.value || 0;

        // const lt3Data = await this.Unit5LT3Service.getSankeyData(payload);
        // const nodeLT3 = lt3Data.find(n => n.to === 'Unaccounted Energy');
        // if (nodeLT3) unaccountedFromLT3 = nodeLT3.value || 0;

        // const lt4Data = await this.Unit5LT4Service.getSankeyData(payload);
        // const nodeLT4 = lt4Data.find(n => n.to === 'Unaccounted Energy');
        // if (nodeLT4) unaccountedFromLT4 = nodeLT4.value || 0;

        // console.log('✅ Unaccounted Energy (LT1 Unit 4):', unaccountedFromLT1);
        // console.log('✅ Unaccounted Energy (LT2 Unit 4):', unaccountedFromLT2);
        // console.log('✅ Unaccounted Energy (LT1 Unit 5):', unaccountedFromLT3);
        // console.log('✅ Unaccounted Energy (LT2 Unit 5):', unaccountedFromLT4);
      } catch (err) {
        console.warn('⚠️ Error fetching LT1/LT2 unaccounted energy:', err.message);
      }

    const unaccountedTotal = +(unaccountedFromLT1 + unaccountedFromLT2 + unaccountedFromLT3 + unaccountedFromLT4).toFixed(2);

    sankeyData.push({
      from: 'Total Generation',
      to: 'Losses',
      value: +losses.toFixed(2),
    });
    // sankeyData.push({
    //   from: 'Total Generation',
    //   to: 'Unaccounted Energy',
    //   value: unaccountedTotal,
    // });

    return sankeyData;
  }
  //unit 4 lt1 and lt2
  async getUnit4Sankey(payload: { startDate: string; endDate: string; startTime: string; endTime: string }) {
  const TZ = 'Asia/Karachi';

  if (!payload.startDate || !payload.endDate || !payload.startTime || !payload.endTime) {
    throw new BadRequestException('Missing required parameters.');
  }

  const startMoment = moment
    .tz(`${payload.startDate} ${payload.startTime}`, 'YYYY-MM-DD HH:mm', TZ)
    .startOf('minute')
    .toDate();
  const endMoment = moment
    .tz(`${payload.endDate} ${payload.endTime}`, 'YYYY-MM-DD HH:mm', TZ)
    .endOf('minute')
    .toDate();

  const startISO = startMoment.toISOString();
  const endISO = endMoment.toISOString();

  // ✅ Define LT1/LT2 mapping for Unit 4 & Unit 5
  const Unit4_LT1 = ['U19_PLC_Del_ActiveEnergy', 'U21_PLC_Del_ActiveEnergy'];
  const Unit4_LT2 = ['U13_GW01_Del_ActiveEnergy','U11_GW01_Del_ActiveEnergy', 'U24_GW01_Del_ActiveEnergy', 'U28_PLC_Del_ActiveEnergy'];
  // const Unit5_LT1 = ['U13_GW02_Del_ActiveEnergy', 'U6_GW02_Del_ActiveEnergy'];
  // const Unit5_LT2 = ['U16_GW03_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];

  const allMeters = [...Unit4_LT1, ...Unit4_LT2];
  const projection: any = {};
  allMeters.forEach((field) => {
    projection[`first_${field}`] = { $first: `$${field}` };
    projection[`last_${field}`] = { $last: `$${field}` };
  });

  const pipeline: any[] = [
    { $addFields: { ts: { $toDate: '$timestamp' } } },
    { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) } } },
    { $sort: { ts: 1 } },
    { $group: { _id: null, ...projection } },
  ];

  const results = await this.unitModel.aggregate(pipeline).exec();

  // ✅ Compute total energy for each meter
  const totals: Record<string, number> = {};
  allMeters.forEach((f) => (totals[f] = 0));

  for (const entry of results) {
    for (const f of allMeters) {
      const first = entry[`first_${f}`] || 0;
      const last = entry[`last_${f}`] || 0;
      const diff = last - first;
      if (!isNaN(diff) && diff >= 0) {
        totals[f] += parseFloat(diff.toFixed(2));
      }
    }
  }

  // ✅ Group by LT levels
  const Unit4_LT1_Total = Unit4_LT1.reduce((sum, f) => sum + (totals[f] || 0), 0);
  const Unit4_LT2_Total = Unit4_LT2.reduce((sum, f) => sum + (totals[f] || 0), 0);
  const Unit4_Total = Unit4_LT1_Total + Unit4_LT2_Total;



  // ✅ Build Sankey structure
  const sankeyData = [
    { from: 'Total Generation', to: 'Unit 4 Incomer', value: +Unit4_Total.toFixed(2) },
    { from: 'Unit 4 Incomer', to: 'LT1', value: +Unit4_LT1_Total.toFixed(2) },
    { from: 'Unit 4 Incomer', to: 'LT2', value: +Unit4_LT2_Total.toFixed(2) },
  ];

  return sankeyData;
}
  async getUnit5Sankey(payload: { startDate: string; endDate: string; startTime: string; endTime: string }) {
  const TZ = 'Asia/Karachi';

  if (!payload.startDate || !payload.endDate || !payload.startTime || !payload.endTime) {
    throw new BadRequestException('Missing required parameters.');
  }

  const startMoment = moment
    .tz(`${payload.startDate} ${payload.startTime}`, 'YYYY-MM-DD HH:mm', TZ)
    .startOf('minute')
    .toDate();
  const endMoment = moment
    .tz(`${payload.endDate} ${payload.endTime}`, 'YYYY-MM-DD HH:mm', TZ)
    .endOf('minute')
    .toDate();

  const startISO = startMoment.toISOString();
  const endISO = endMoment.toISOString();

  // ✅ Define LT1/LT2 mapping for Unit 4 & Unit 5
 
  const Unit5_LT1 = ['U13_GW02_Del_ActiveEnergy', 'U6_GW02_Del_ActiveEnergy'];
  const Unit5_LT2 = ['U16_GW03_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];

  const allMeters = [...Unit5_LT1, ...Unit5_LT2];
  const projection: any = {};
  allMeters.forEach((field) => {
    projection[`first_${field}`] = { $first: `$${field}` };
    projection[`last_${field}`] = { $last: `$${field}` };
  });

  const pipeline: any[] = [
    { $addFields: { ts: { $toDate: '$timestamp' } } },
    { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) } } },
    { $sort: { ts: 1 } },
    { $group: { _id: null, ...projection } },
  ];

  const results = await this.unitModel.aggregate(pipeline).exec();

  // ✅ Compute total energy for each meter
  const totals: Record<string, number> = {};
  allMeters.forEach((f) => (totals[f] = 0));

  for (const entry of results) {
    for (const f of allMeters) {
      const first = entry[`first_${f}`] || 0;
      const last = entry[`last_${f}`] || 0;
      const diff = last - first;
      if (!isNaN(diff) && diff >= 0) {
        totals[f] += parseFloat(diff.toFixed(2));
      }
    }
  }

  // ✅ Group by LT levels


  const Unit5_LT1_Total = Unit5_LT1.reduce((sum, f) => sum + (totals[f] || 0), 0);
  const Unit5_LT2_Total = Unit5_LT2.reduce((sum, f) => sum + (totals[f] || 0), 0);
  const Unit5_Total = Unit5_LT1_Total + Unit5_LT2_Total;

  // ✅ Build Sankey structure
  const sankeyData = [
    { from: 'Total Generation', to: 'Unit 5 Incomer', value: +Unit5_Total.toFixed(2) },
    { from: 'Unit 5 Incomer', to: 'LT1', value: +Unit5_LT1_Total.toFixed(2) },
    { from: 'Unit 5 Incomer', to: 'LT2', value: +Unit5_LT2_Total.toFixed(2) },
  ];

  return sankeyData;
}
async getLossesSankey(payload: { startDate: string; endDate: string; startTime: string; endTime: string }) {
  const TZ = 'Asia/Karachi';

  if (!payload.startDate || !payload.endDate || !payload.startTime || !payload.endTime) {
    throw new BadRequestException('Missing required parameters.');
  }

  const startMoment = moment
    .tz(`${payload.startDate} ${payload.startTime}`, 'YYYY-MM-DD HH:mm', TZ)
    .startOf('minute')
    .toDate();
  const endMoment = moment
    .tz(`${payload.endDate} ${payload.endTime}`, 'YYYY-MM-DD HH:mm', TZ)
    .endOf('minute')
    .toDate();

  const startISO = startMoment.toISOString();
  const endISO = endMoment.toISOString();

  // ---------------- Transformer Incoming tags (same as main sankey) ----------------
  const transformerIncomingTags = [
    'U23_GW01_Del_ActiveEnergy', // Trafo 1 incoming
    'U22_GW01_Del_ActiveEnergy', // Trafo 2 incoming
    'U20_GW03_Del_ActiveEnergy', // Trafo 3 incoming
    'U19_GW03_Del_ActiveEnergy', // Trafo 4 incoming
  ];

  // ---------------- Transformer Outgoing + Source tags ----------------
  const transformerOutgoingTags = [
    'U21_PLC_Del_ActiveEnergy',  // Trafo 1 outgoing
    'U13_GW01_Del_ActiveEnergy', // Trafo 2 outgoing
    'U13_GW02_Del_ActiveEnergy', // Trafo 3 outgoing
    'U16_GW03_Del_ActiveEnergy', // Trafo 4 outgoing
    'U27_PLC_Del_ActiveEnergy',  // WAPDA
    'U22_PLC_Del_ActiveEnergy',  // Niigata
    'U26_PLC_Del_ActiveEnergy',  // JMS
    'U22_GW01_Del_ActiveEnergy', // PH_IC
    'U21_GW03_Del_ActiveEnergy', // mainincoming
    'U25_PLC_Del_ActiveEnergy', // hfo
  ];

  const meterFields = Array.from(new Set([...transformerIncomingTags, ...transformerOutgoingTags]));

  // ---------------- Aggregation Pipeline ----------------
  const projection: any = {};
  meterFields.forEach((field) => {
    projection[`first_${field}`] = { $first: `$${field}` };
    projection[`last_${field}`] = { $last: `$${field}` };
  });

  const pipeline: any[] = [
    { $addFields: { ts: { $toDate: '$timestamp' } } },
    { $match: { ts: { $gte: new Date(startISO), $lte: new Date(endISO) } } },
    { $sort: { ts: 1 } },
    { $group: { _id: null, ...projection } },
  ];

  const results = await this.unitModel.aggregate(pipeline).exec();
  if (!results.length) return [];

  // ---------------- Calculate meter-wise totals ----------------
  const totals: Record<string, number> = {};
  meterFields.forEach((field) => (totals[field] = 0));

  for (const entry of results) {
    for (const field of meterFields) {
      const first = entry[`first_${field}`] || 0;
      const last = entry[`last_${field}`] || 0;
      const diff = last - first;
      if (!isNaN(diff) && diff >= 0) {
        totals[field] += parseFloat(diff.toFixed(2));
      }
    }
  }

  // ---------------- Calculate Transformer and HT Losses ----------------
  const Trafo1Incoming = totals['U23_GW01_Del_ActiveEnergy'] || 0;
  const Trafo2Incoming = totals['U22_GW01_Del_ActiveEnergy'] || 0;
  const Trafo3Incoming = totals['U20_GW03_Del_ActiveEnergy'] || 0;
  const Trafo4Incoming = totals['U19_GW03_Del_ActiveEnergy'] || 0;

  const Trafo1outgoing = totals['U21_PLC_Del_ActiveEnergy'] || 0;
  const Trafo2outgoing = totals['U13_GW01_Del_ActiveEnergy'] || 0;
  const Trafo3outgoing = totals['U13_GW02_Del_ActiveEnergy'] || 0;
  const Trafo4outgoing = totals['U16_GW03_Del_ActiveEnergy'] || 0;

  const Trafo1losses = Trafo1Incoming - Trafo1outgoing;
  const Trafo2losses = Trafo2Incoming - Trafo2outgoing;
  const Trafo3losses = Trafo3Incoming - Trafo3outgoing;
  const Trafo4losses = Trafo4Incoming - Trafo4outgoing;

  const TransformerLosses = Trafo1losses + Trafo2losses + Trafo3losses + Trafo4losses;

  const Wapda2 = totals['U27_PLC_Del_ActiveEnergy'] || 0;
  const Niigata = totals['U22_PLC_Del_ActiveEnergy'] || 0;
  const JMS = totals['U26_PLC_Del_ActiveEnergy'] || 0;
  const PH_IC = totals['U22_GW01_Del_ActiveEnergy'] || 0;
  const mainIncomingUnit5 =
  totals['U21_GW03_Del_ActiveEnergy'] || 0;

const hfoaux= totals['U25_PLC_Del_ActiveEnergy'] || 0;

  const HT_Transmission_Losses = Math.max(
  0,
  (Wapda2 + Niigata + JMS) -
  (mainIncomingUnit5 + PH_IC) -
  (hfoaux)
);

  const losses = TransformerLosses + HT_Transmission_Losses;
   // ---------------- Compute Unaccounted Energy from LT1 and LT2 ----------------
      let unaccountedFromLT1 = 0;
      let unaccountedFromLT2 = 0;
      let unaccountedFromLT3 = 0;
      let unaccountedFromLT4 = 0;

      try {
        // const lt1Data = await this.unit4LT1Service.getSankeyData(payload);
        // const nodeLT1 = lt1Data.find(n => n.to === 'Unaccounted Energy');
        // if (nodeLT1) unaccountedFromLT1 = nodeLT1.value || 0;

        // const lt2Data = await this.unit4LT2Service.getSankeyData(payload);
        // const nodeLT2 = lt2Data.find(n => n.to === 'Unaccounted Energy');
        // if (nodeLT2) unaccountedFromLT2 = nodeLT2.value || 0;

        // const lt3Data = await this.Unit5LT3Service.getSankeyData(payload);
        // const nodeLT3 = lt3Data.find(n => n.to === 'Unaccounted Energy');
        // if (nodeLT3) unaccountedFromLT3 = nodeLT3.value || 0;

        // const lt4Data = await this.Unit5LT4Service.getSankeyData(payload);
        // const nodeLT4 = lt4Data.find(n => n.to === 'Unaccounted Energy');
        // if (nodeLT4) unaccountedFromLT4 = nodeLT4.value || 0;

        // console.log('✅ Unaccounted Energy (LT1 Unit 4):', unaccountedFromLT1);
        // console.log('✅ Unaccounted Energy (LT2 Unit 4):', unaccountedFromLT2);
        // console.log('✅ Unaccounted Energy (LT1 Unit 5):', unaccountedFromLT3);
        // console.log('✅ Unaccounted Energy (LT2 Unit 5):', unaccountedFromLT4);
      } catch (err) {
        console.warn('⚠️ Error fetching LT1/LT2 unaccounted energy:', err.message);
      }

    const unaccountedTotal = +(unaccountedFromLT1 + unaccountedFromLT2 + unaccountedFromLT3 + unaccountedFromLT4).toFixed(2);


  // ---------------- Build Sankey Output ----------------
  const sankeyData = [
    { from: 'Total Generation', to: 'Losses', value: +losses.toFixed(2) },
    { from: 'Losses', to: 'Transformer Losses', value: +TransformerLosses.toFixed(2) },
    { from: 'Losses', to: 'HT Transmission Losses', value: +HT_Transmission_Losses.toFixed(2) },
    { from: 'Losses', to: 'Unaccounted Energy', value: +unaccountedTotal.toFixed(2) },
  ];

  return sankeyData;
}



}
