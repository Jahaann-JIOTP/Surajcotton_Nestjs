
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { consumption_energy } from './schemas/consumption_energy.schema';
import { Consumption_energyDto  } from './dto/consumption_energy.dto'; // Correct import for DTO

import * as moment from 'moment-timezone';

export interface HourlyData {
  Time: string;
  Today: number;
  Yesterday: number;
}

@Injectable()
export class ConsumptionEnergyService {
  constructor(
    @InjectModel( consumption_energy.name, 'surajcotton') private readonly generationModel: Model< consumption_energy>
  ) {}

  async handleQuery(query: Consumption_energyDto) {
    switch (query.value) {
      case 'today':
        return this.getTodayGeneration();
      case 'week':
        return this.getWeeklyGeneration();
      case 'month':
        return this.getMonthlyGeneration();
      case 'year':
        return this.getYearlyGeneration();
      default:
        return { error: 'Invalid value' };
    }
  }

private async calculateConsumption(range: { start: string; end: string }) {
  // Define all meter key arrays
//  const transportKeys = ["U1_PLC_Del_ActiveEnergy"];
// const unit05AuxKeys = ["U2_PLC_Del_ActiveEnergy"];
// const LightExternalKeys = ["U3_PLC_Del_ActiveEnergy"];
// const LightInternalKeys = ["U4_PLC_Del_ActiveEnergy"];
// const PowerHouse2ndSourceKeys = ["U5_PLC_Del_ActiveEnergy"];
// const TurbineKeys = ["U6_PLC_Del_ActiveEnergy"];
// const SpareKeys = ["U7_PLC_Del_ActiveEnergy"];
// const Drawing01Keys = ["U8_PLC_Del_ActiveEnergy"];
// const Winding01Keys = ["U9_PLC_Del_ActiveEnergy"];
// const Ring01Keys = ["U10_PLC_Del_ActiveEnergy"];
// const Ring05Keys = ["U11_PLC_Del_ActiveEnergy"];
// const Ring06Keys = ["U12_PLC_Del_ActiveEnergy"];
// const Comber1Keys = ["U13_PLC_Del_ActiveEnergy"];
// const CompressorKeys = ["U14_PLC_Del_ActiveEnergy"];
// const Simplex01Keys = ["U15_PLC_Del_ActiveEnergy"];
// const Compressor02Keys = ["U16_PLC_Del_ActiveEnergy"];
// const RingACKeys = ["U17_PLC_Del_ActiveEnergy"];
const TR2Keys = ["U19_PLC_Del_ActiveEnergy"];
const TR1Keys = ["U21_PLC_Del_ActiveEnergy"];
const GasLTPanelKeys = ["U11_GW01_Del_ActiveEnergy"];
const PowerHouseKeys = ["U13_GW01_Del_ActiveEnergy"];
const Solar1Keys = ["U6_GW02_Del_ActiveEnergy"];
const Transformer1LT1CBKeys = ["U13_GW02_Del_ActiveEnergy"];
const Transformer2ACBKeys = ["U16_GW03_Del_ActiveEnergy"];
const Solar2Keys = ["U17_GW03_Del_ActiveEnergy"];


// const RingACBypassKeys = ["U18_PLC_Del_ActiveEnergy"];
// const CompressorBypassKeys = ["U20_PLC_Del_ActiveEnergy"];
// const DryingSimplexACKeys = ["U1_GW01_Del_ActiveEnergy"];
// const WeikelConditioningMachineKeys = ["U2_GW01_Del_ActiveEnergy"];
// const WindingACKeys = ["U3_GW01_Del_ActiveEnergy"];
// const MillsWorkshopKeys = ["U4_GW01_Del_ActiveEnergy"];
// const Card1Keys = ["U5_GW01_Del_ActiveEnergy"];
// const ColonyKeys = ["U6_GW01_Del_ActiveEnergy"];
// const BlowRoomKeys = ["U8_GW01_Del_ActiveEnergy"];
// const Card2Keys = ["U9_GW01_Del_ActiveEnergy"];
// const Winding011Keys = ["U10_GW01_Del_ActiveEnergy"];


// const CardFilterBypassKeys = ["U12_GW01_Del_ActiveEnergy"];
// const DRCardFilterKeys = ["U14_GW01_Del_ActiveEnergy"];
// const Ring02AutoConeKeys = ["U15_GW01_Del_ActiveEnergy"];
// const Ring04Keys = ["U16_GW01_Del_ActiveEnergy"];
// const Ring03Keys = ["U17_GW01_Del_ActiveEnergy"];
// const BalePressKeys = ["U18_GW01_Del_ActiveEnergy"];
// const ACLabKeys = ["U19_GW01_Del_ActiveEnergy"];
// const Spare01Keys = ["U20_GW01_Del_ActiveEnergy"];
// const Spare02Keys = ["U21_GW01_Del_ActiveEnergy"];
// const HFOIncomingKeys = ["U22_GW01_Del_ActiveEnergy"];
// const Wapda1IncomingKeys = ["U23_GW01_Del_ActiveEnergy"]; U7, U23 missed
//adding meters of unit 5 from there
// const PDBCD1Keys = ["U1_GW02_Del_ActiveEnergy"];
// const PDBCD2Keys = ["U2_GW02_Del_ActiveEnergy"];
// const CardPDB01Keys = ["U3_GW02_Del_ActiveEnergy"];
// const PDB8Keys = ["U4_GW02_Del_ActiveEnergy"];
// const PFPanelKeys = ["U5_GW02_Del_ActiveEnergy"];


// //U6_GW02 meter not added
// const Ring13Keys = ["U7_GW02_Del_ActiveEnergy"];
// const ACPlantspinningKeys = ["U8_GW02_Del_ActiveEnergy"];
// const BlowRoomL1Keys = ["U9_GW02_Del_ActiveEnergy"];
// const RingFramesKeys = ["U10_GW02_Del_ActiveEnergy"];
// const ACPlantBlowingKeys = ["U11_GW02_Del_ActiveEnergy"];
// const MLDB1BlowerroomcardKeys = ["U12_GW02_Del_ActiveEnergy"];
// const SpareGW02Keys = ["U14_GW02_Del_ActiveEnergy"];
// const ACPlantspinninggw02Keys = ["U15_GW02_Del_ActiveEnergy"];
// const WaterChillerKeys = ["U16_GW02_Del_ActiveEnergy"];
// const CardMCKeys = ["U17_GW02_Del_ActiveEnergy"];
// const AutoConlinkConnerKeys = ["U18_GW02_Del_ActiveEnergy"];
// const CardMC1Keys = ["U19_GW02_Del_ActiveEnergy"];
// const ACPlantwindingKeys = ["U20_GW02_Del_ActiveEnergy"];
// const SimplexMCKeys = ["U21_GW02_Del_ActiveEnergy"];
// const SpareGW02againKeys = ["U22_GW02_Del_ActiveEnergy"];
// const DrawFrameFinishKeys = ["U23_GW02_Del_ActiveEnergy"];
// const RingFrameKeys = ["U1_GW03_Del_ActiveEnergy"];
// const YarnConditioningMCKeys = ["U2_GW03_Del_ActiveEnergy"];
// const MLDB3SingleroomquarterKeys = ["U3_GW03_Del_ActiveEnergy"];
// const RovingtransportsystemKeys = ["U4_GW03_Del_ActiveEnergy"];
// const ringFrameKeys = ["U5_GW03_Del_ActiveEnergy"];
// const ComberMCSKeys = ["U6_GW03_Del_ActiveEnergy"];
// const SpareGW03Keys = ["U7_GW03_Del_ActiveEnergy"];
// const Spare2Keys = ["U8_GW03_Del_ActiveEnergy"];
// const RingFrameGW03Keys = ["U9_GW03_Del_ActiveEnergy"];
// const AutoConlinkerConnerKeys = ["U10_GW03_Del_ActiveEnergy"];
// const BalingPressKeys = ["U11_GW03_Del_ActiveEnergy"];
// const RingFrameGW033Keys = ["U12_GW03_Del_ActiveEnergy"];
// const FiberDepositPlantKeys = ["U13_GW03_Del_ActiveEnergy"];
// const MLDB2RingConKeys = ["U14_GW03_Del_ActiveEnergy"];
// const DeepValveTurbineKeys = ["U15_GW03_Del_ActiveEnergy"];

// const PFPanelGW03Keys = ["U18_GW03_Del_ActiveEnergy"];
// const wapdaHFOGasIncomingKeys = ["U19_GW03_Del_ActiveEnergy"];
// // not adding U20,21
// const PDB07Keys = ["U22_GW03_Del_ActiveEnergy"];
// const PDB10Keys = ["U23_GW03_Del_ActiveEnergy"];

const allMeterKeys = [...TR2Keys, ...TR1Keys, ...GasLTPanelKeys, ...PowerHouseKeys, ...Solar1Keys, ...Transformer1LT1CBKeys, ...Transformer2ACBKeys, ...Solar2Keys];
  // const allMeterKeys = [
  //  ...transportKeys, ...unit05AuxKeys, ...LightExternalKeys, ...LightInternalKeys, ...PowerHouse2ndSourceKeys,
  //   ...TurbineKeys, ...SpareKeys, ...Drawing01Keys, ...Winding01Keys, ...Ring01Keys, ...Ring05Keys, ...Ring06Keys, ...Comber1Keys,
  // ...CompressorKeys, ...Simplex01Keys, ...Compressor02Keys, ...RingACKeys, ...RingACBypassKeys, ...CompressorBypassKeys, ...DryingSimplexACKeys,
  // ...WeikelConditioningMachineKeys, ...WindingACKeys, ...MillsWorkshopKeys, ...Card1Keys, ...ColonyKeys, ...Card2Keys,
  // ...BlowRoomKeys, ...Winding011Keys, ...GasLTPanelKeys, ...CardFilterBypassKeys, ...DRCardFilterKeys, ...Ring02AutoConeKeys, ...Ring04Keys,
  // ...Ring03Keys, ...BalePressKeys, ...TR2Keys, ...ACLabKeys, ...Spare01Keys, ...Spare02Keys, ...HFOIncomingKeys, 
  // //Unit 5 meters
  //  ...PDBCD1Keys, ...PDBCD2Keys, ...CardPDB01Keys, ...PDB8Keys, ...PFPanelKeys, ...Ring13Keys, ...ACPlantspinningKeys, ...BlowRoomL1Keys, ...RingFramesKeys,
  // ...ACPlantBlowingKeys, ...MLDB1BlowerroomcardKeys, ...Transformer1LT1CBKeys, ...SpareGW02Keys, ...ACPlantspinninggw02Keys, ...WaterChillerKeys,
  // ...CardMC1Keys, ...AutoConlinkConnerKeys, ...CardMCKeys, ...SpareGW02againKeys, ...DrawFrameFinishKeys,...ACPlantwindingKeys, ...SimplexMCKeys, ...RingFrameKeys, ...YarnConditioningMCKeys,
  // ...MLDB3SingleroomquarterKeys, ...RovingtransportsystemKeys, ...ringFrameKeys, ...ComberMCSKeys, ...SpareGW03Keys, ...Spare2Keys, ...RingFrameGW03Keys,
  // ...AutoConlinkerConnerKeys, ...BalingPressKeys, ...RingFrameGW033Keys, ...FiberDepositPlantKeys, ...MLDB2RingConKeys, ...DeepValveTurbineKeys,
  // ...Transformer2ACBKeys, ...PFPanelGW03Keys, ...wapdaHFOGasIncomingKeys, ...PDB07Keys, ...PDB10Keys


  // ];

  // ✅ Dynamically build meterSuffixMap from meter keys
  const meterSuffixMap: Record<string, string> = {};
  allMeterKeys.forEach(fullKey => {
    const [meterId, ...suffixParts] = fullKey.split("_");
    meterSuffixMap[meterId] = suffixParts.join("_");
  });

  // ✅ Build projection
  const projection: Record<string, number> = { timestamp: 1 };
  Object.entries(meterSuffixMap).forEach(([meterId, suffix]) => {
    projection[`${meterId}_${suffix}`] = 1;
  });

  // ✅ Fetch data from DB
  const data = await this.generationModel.aggregate([
    {
      $match: {
        timestamp: {
          $gte: range.start,
          $lte: range.end,
        },
      },
    },
    { $project: projection },
    { $sort: { timestamp: 1 } },
  ]);

  // ✅ Initialize first & last values
  const firstValues: Record<string, number | null> = {};
  const lastValues: Record<string, number | null> = {};
  Object.entries(meterSuffixMap).forEach(([meterId, suffix]) => {
    const key = `${meterId}_${suffix}`;
    firstValues[key] = null;
    lastValues[key] = null;
  });

  // ✅ Populate first/last values
  for (const doc of data) {
    Object.entries(meterSuffixMap).forEach(([meterId, suffix]) => {
      const key = `${meterId}_${suffix}`;
      const val = doc[key];
      if (typeof val === "number") {
        if (firstValues[key] === null) firstValues[key] = val;
        lastValues[key] = val;
      }
    });
  }

  // ✅ Compute consumption
  const consumption: Record<string, number> = {};
  Object.keys(firstValues).forEach(key => {
    if (firstValues[key] !== null && lastValues[key] !== null) {
      let diff = lastValues[key]! - firstValues[key]!;
      diff = diff >= 0 ? diff : 0; // no negative
      // Filter invalid (scientific notation / extreme) values
      if (diff > 1e12 || diff < 1e-6) diff = 0;
      consumption[key] = diff;
    } else {
      consumption[key] = 0;
    }
  });

  // ✅ Sum by group
  const sumByMeterGroup = (meterKeys: string[]) =>
    meterKeys.reduce((sum, fullKey) => {
      const [meterId, ...suffixParts] = fullKey.split("_");
      const key = `${meterId}_${suffixParts.join("_")}`;
      const value = consumption[key];
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

  // ✅ Calculate each group total
  //  const transport = sumByMeterGroup(transportKeys);
  // const unit05Aux = sumByMeterGroup(unit05AuxKeys);
  // const LightExternal = sumByMeterGroup(LightExternalKeys);
  // const LightInternal = sumByMeterGroup(LightInternalKeys);
  // const PowerHouse2ndSource = sumByMeterGroup(PowerHouse2ndSourceKeys);
  // const Turbine = sumByMeterGroup(TurbineKeys);
  // const Spare = sumByMeterGroup(SpareKeys);
  // const Drawing01 = sumByMeterGroup(Drawing01Keys);
  // const Winding01 = sumByMeterGroup(Winding01Keys);
  // const Ring01 = sumByMeterGroup(Ring01Keys);
  // const Ring05 = sumByMeterGroup(Ring05Keys);
  const TR2 = sumByMeterGroup(TR2Keys);
  const TR1 = sumByMeterGroup(TR1Keys);
  const GasLTPanel = sumByMeterGroup(GasLTPanelKeys);
  const PowerHouse = sumByMeterGroup(PowerHouseKeys);
  const Solar1 = sumByMeterGroup(Solar1Keys);
  const Transformer1LT1CB = sumByMeterGroup(Transformer1LT1CBKeys);
  const Transformer2ACB = sumByMeterGroup(Transformer2ACBKeys);
  const Solar2 = sumByMeterGroup(Solar2Keys);








  
//   const Ring06 = sumByMeterGroup(Ring06Keys);
//   const Comber1 = sumByMeterGroup(Comber1Keys);
//   const Compressor = sumByMeterGroup(CompressorKeys);
//   const Simplex01 = sumByMeterGroup(Simplex01Keys);
//   const Compressor02 = sumByMeterGroup(Compressor02Keys);
//   const RingAC = sumByMeterGroup(RingACKeys);
//   const RingACBypass= sumByMeterGroup(RingACBypassKeys);
//   const CompressorBypass= sumByMeterGroup(CompressorBypassKeys);
//   const DryingSimplexAC= sumByMeterGroup(DryingSimplexACKeys);
//   const WeikelConditioningMachine= sumByMeterGroup(WeikelConditioningMachineKeys);
//   const WindingAC= sumByMeterGroup(WindingACKeys);
//   const MillsWorkshop= sumByMeterGroup(MillsWorkshopKeys);
//   const Card1= sumByMeterGroup(Card1Keys);
//   const Colony= sumByMeterGroup(ColonyKeys);
//   const BlowRoom= sumByMeterGroup(BlowRoomKeys);
//   const Card2= sumByMeterGroup(Card2Keys);
//   const Winding011= sumByMeterGroup(Winding011Keys);
//   const GasLTPanel= sumByMeterGroup(GasLTPanelKeys);
//   const CardFilterBypass= sumByMeterGroup(CardFilterBypassKeys);
//   const DRCardFilter= sumByMeterGroup(DRCardFilterKeys);
//   const Ring02AutoCone= sumByMeterGroup(Ring02AutoConeKeys);
//   const Ring04= sumByMeterGroup(Ring04Keys);
//   const Ring03= sumByMeterGroup(Ring03Keys);
//   const BalePress= sumByMeterGroup(BalePressKeys);
//   const ACLab= sumByMeterGroup(ACLabKeys);
//   const Spare01= sumByMeterGroup(Spare01Keys);
//   const Spare02= sumByMeterGroup(Spare02Keys);
//   const HFOIncoming= sumByMeterGroup(HFOIncomingKeys);
//   // const Wapda1Incoming = sumByMeterGroup(Wapda1IncomingKeys);
// // adding meters for unit 5
//   const PDBCD1 = sumByMeterGroup(PDBCD1Keys);
//   const PDBCD2 = sumByMeterGroup(PDBCD2Keys);
//   const CardPDB01 = sumByMeterGroup(CardPDB01Keys);
//   const PDB8 = sumByMeterGroup(PDB8Keys);
//   const PFPanel = sumByMeterGroup(PFPanelKeys);
//   const Ring13 = sumByMeterGroup(Ring13Keys);
//   const ACPlantspinning = sumByMeterGroup(ACPlantspinningKeys);
//   const BlowRoomL1 = sumByMeterGroup(BlowRoomL1Keys);
//   const RingFrames = sumByMeterGroup(RingFramesKeys);
//   const ACPlantBlowing = sumByMeterGroup(ACPlantBlowingKeys);
//   const MLDB1Blowerroomcard = sumByMeterGroup(MLDB1BlowerroomcardKeys);

  // const SpareGW02 = sumByMeterGroup(SpareGW02Keys);
  // const ACPlantspinninggw02 = sumByMeterGroup(ACPlantspinninggw02Keys);
  // const WaterChiller = sumByMeterGroup(WaterChillerKeys);
  // const AutoConlinkConner = sumByMeterGroup(AutoConlinkConnerKeys);
  // const  CardMC = sumByMeterGroup(CardMCKeys);
  // const  CardMC1 = sumByMeterGroup(CardMC1Keys);
  // const  ACPlantwinding = sumByMeterGroup(ACPlantwindingKeys);
  // const  SimplexMC = sumByMeterGroup(SimplexMCKeys);
  // const  SpareGW02again = sumByMeterGroup(SpareGW02againKeys);
  // const DrawFrameFinish = sumByMeterGroup(DrawFrameFinishKeys);
  // const RingFrame = sumByMeterGroup(RingFrameKeys);
  // const MLDB3Singleroomquarter = sumByMeterGroup(MLDB3SingleroomquarterKeys);
  // const Rovingtransportsystem = sumByMeterGroup(RovingtransportsystemKeys);
  // const ringFrame = sumByMeterGroup(ringFrameKeys);
  // const ComberMCS= sumByMeterGroup(ComberMCSKeys);
  // const SpareGW03= sumByMeterGroup(SpareGW03Keys);
  // const Spare2= sumByMeterGroup(Spare2Keys);
  // const RingFrameGW03= sumByMeterGroup(RingFrameGW03Keys);
  // const AutoConlinkerConner= sumByMeterGroup(AutoConlinkerConnerKeys);
  // const BalingPress= sumByMeterGroup(BalingPressKeys);
  // const RingFrameGW033= sumByMeterGroup(RingFrameGW033Keys);
  // const FiberDepositPlant= sumByMeterGroup(FiberDepositPlantKeys);
  // const MLDB2RingCon= sumByMeterGroup(MLDB2RingConKeys);
  // const DeepValveTurbine= sumByMeterGroup(DeepValveTurbineKeys);
  // const Transformer2ACB= sumByMeterGroup(Transformer2ACBKeys);
  // const PFPanelGW03= sumByMeterGroup(PFPanelGW03Keys);
  // const wapdaHFOGasIncoming= sumByMeterGroup(wapdaHFOGasIncomingKeys);
  // const PDB07= sumByMeterGroup(PDB07Keys);
  // const PDB10= sumByMeterGroup(PDB10Keys);

  // ✅ Final totals
 const totalConsumption = TR2 + TR1 + GasLTPanel + PowerHouse 
//  transport 
//  + unit05Aux + LightExternal + LightInternal + PowerHouse2ndSource + Turbine + Spare +Drawing01
//    + Winding01 +Ring01 +Ring05+ Ring06 +Comber1+ TR2+Compressor +Simplex01 +Compressor02 +RingAC +RingACBypass +CompressorBypass
//    + DryingSimplexAC +WeikelConditioningMachine +WindingAC +MillsWorkshop +Card1 +Colony +BlowRoom +Card2 + Winding011 +GasLTPanel
//    +CardFilterBypass  +DRCardFilter +Ring02AutoCone +Ring04 +Ring03 +BalePress +ACLab +Spare01 +Spare02 +HFOIncoming ;

const totalConsumption1= Solar1 + Transformer1LT1CB +Transformer2ACB + Solar2
// PDBCD1+ PDBCD2 +CardPDB01 +PDB8 +PFPanel +Ring13 +ACPlantspinning +BlowRoomL1 +RingFrames +ACPlantBlowing
// +MLDB1Blowerroomcard +Transformer1LT1CB+SpareGW02 + ACPlantspinninggw02 +WaterChiller +AutoConlinkConner + CardMC + CardMC1 +  SimplexMC
// + ACPlantwinding+ SpareGW02again +DrawFrameFinish +RingFrame + MLDB3Singleroomquarter +Rovingtransportsystem +ringFrame +ComberMCS +SpareGW03
// +Spare2 +RingFrameGW03 +AutoConlinkerConner+ BalingPress +RingFrameGW033 +FiberDepositPlant +MLDB2RingCon +DeepValveTurbine +Transformer2ACB
// +PFPanelGW03 +wapdaHFOGasIncoming +PDB07 +PDB10


// const total= totalConsumption + totalConsumption1
const total= totalConsumption + totalConsumption1


  return +total.toFixed(2);
}



// async getWeeklyGeneration() {
//   const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
//   const result: { Day: string; [key: string]: number | string }[] = [];

//   const now = moment().tz('Asia/Karachi');

//   // Get Monday of this week in Asia/Karachi
//   const mondayThisWeek = now.clone().startOf('week').add(1, 'day'); // Monday
//   if (mondayThisWeek.day() === 1) {
//     // Confirmed Monday
//     for (let i = 0; i < 7; i++) {
//       const thisDayStart = mondayThisWeek.clone().add(i, 'days').startOf('day');
//       const thisDayEnd = thisDayStart.clone().endOf('day');

//       const lastWeekStart = thisDayStart.clone().subtract(7, 'days');
//       const lastWeekEnd = thisDayEnd.clone().subtract(7, 'days');

//       const thisWeekConsumption = await this.calculateConsumption({
//         start: thisDayStart.toISOString(),
//         end: thisDayEnd.toISOString(),
//       });

//       const lastWeekConsumption = await this.calculateConsumption({
//         start: lastWeekStart.toISOString(),
//         end: lastWeekEnd.toISOString(),
//       });

//       result.push({
//         Day: days[i],
//         "This Week": +thisWeekConsumption.toFixed(2),
//         "Last Week": +lastWeekConsumption.toFixed(2),
//       });
//     }
//   }

//   return result;
// }
 

async calculateConsumption1(range: { start: string; end: string }): Promise<number> {
  const TR2Keys = ["U19_PLC_Del_ActiveEnergy"];
  const TR1Keys = ["U21_PLC_Del_ActiveEnergy"];
  const GasLTPanelKeys = ["U11_GW01_Del_ActiveEnergy"];
  const PowerHouseKeys = ["U13_GW01_Del_ActiveEnergy"];
  const Solar1Keys = ["U6_GW02_Del_ActiveEnergy"];
  const Transformer1LT1CBKeys = ["U13_GW02_Del_ActiveEnergy"];
  const Transformer2ACBKeys = ["U16_GW03_Del_ActiveEnergy"];
  const Solar2Keys = ["U17_GW03_Del_ActiveEnergy"];

  const allKeys = [
    ...TR2Keys, ...TR1Keys, ...GasLTPanelKeys, ...PowerHouseKeys,
    ...Solar1Keys, ...Transformer1LT1CBKeys, ...Transformer2ACBKeys, ...Solar2Keys
  ];

  // Range as ISO (UTC Z); aap ki caller (getWeeklyGeneration) Asia/Karachi ko UTC mēn convert karke bhej rahi hai — sahi.
  const startUTC = range.start;
  const endUTC = range.end;

  // Log: incoming range
  // console.log(`[CONSUMP] Query range (UTC): start=${startUTC} end=${endUTC}`);

  // Build projection
  const projection: Record<string, number> = { timestamp: 1 };
  allKeys.forEach(key => (projection[key] = 1));

  // 🔒 Safer match: handle both string and Date timestamps (mixed collections)
  // NOTE: Agar aapke collection mēn timestamp 100% Date ho, to is $match ko
  // simple { timestamp: { $gte: new Date(startUTC), $lte: new Date(endUTC) } } se replace kar sakte hain.
  const data = await this.generationModel.aggregate([
    {
      $match: {
        $expr: {
          $and: [
            { $gte: [ { $toDate: '$timestamp' }, new Date(startUTC) ] },
            { $lte: [ { $toDate: '$timestamp' }, new Date(endUTC) ] },
          ]
        }
      }
    },
    { $project: projection },
    { $sort: { timestamp: 1 } },
  ]);

  // console.log(`[CONSUMP] Docs found: ${data.length}`);

  if (data.length > 0) {
    const firstTs = data[0].timestamp instanceof Date ? data[0].timestamp.toISOString() : data[0].timestamp;
    const lastTs  = data[data.length - 1].timestamp instanceof Date ? data[data.length - 1].timestamp.toISOString() : data[data.length - 1].timestamp;
    // console.log(`[CONSUMP] First doc ts: ${firstTs} | Last doc ts: ${lastTs}`);
  } else {
    // console.log(`[CONSUMP] No docs in range.`);
  }

  const firstValues: Record<string, number | null> = {};
  const lastValues: Record<string, number | null> = {};
  const consumption: Record<string, number> = {};
  allKeys.forEach(k => { firstValues[k] = null; lastValues[k] = null; consumption[k] = 0; });

  // Single pass: capture first/last numeric values
  for (const doc of data) {
    for (const key of allKeys) {
      const val = doc[key];
      if (typeof val === "number") {
        if (firstValues[key] === null) firstValues[key] = val;
        lastValues[key] = val;
      }
    }
  }

  // Compute per-key deltas + guardrails
  allKeys.forEach(key => {
    const s = firstValues[key];
    const e = lastValues[key];
    let delta = (s !== null && e !== null) ? Math.max(0, e - s) : 0;

    // Outlier clamp (scientific sanity)
    if (delta > 1e12 || delta < 1e-6) delta = 0;

    consumption[key] = delta;
  });

  // Optional: concise per-key debug (only non-zero)
  const nonZero = allKeys
    .filter(k => (consumption[k] || 0) > 0)
    .slice(0, 10) // log limit
    .map(k => ({
      key: k,
      first: firstValues[k],
      last: lastValues[k],
      delta: consumption[k]
    }));
  // console.log(`[CONSUMP] Non-zero sample (up to 10):`, nonZero);

  // Group sums
  const sum = (keys: string[]) => keys.reduce((t, k) => t + (consumption[k] || 0), 0);

  const TR2 = sum(TR2Keys);
  const TR1 = sum(TR1Keys);
  const GasLTPanel = sum(GasLTPanelKeys);
  const PowerHouse = sum(PowerHouseKeys);
  const Solar1 = sum(Solar1Keys);
  const Transformer1LT1CB = sum(Transformer1LT1CBKeys);
  const Transformer2ACB = sum(Transformer2ACBKeys);
  const Solar2 = sum(Solar2Keys);

  const totalConsumption = TR2 + TR1 + GasLTPanel + PowerHouse;
  const totalConsumption1 = Solar1 + Transformer1LT1CB + Transformer2ACB + Solar2;
  const total = totalConsumption + totalConsumption1;

  // console.log(`[CONSUMP] Group sums => TR2:${TR2.toFixed(2)} TR1:${TR1.toFixed(2)} GasLT:${GasLTPanel.toFixed(2)} PH:${PowerHouse.toFixed(2)} | Solar1:${Solar1.toFixed(2)} T1LT1CB:${Transformer1LT1CB.toFixed(2)} T2ACB:${Transformer2ACB.toFixed(2)} Solar2:${Solar2.toFixed(2)}`);
  // console.log(`[CONSUMP] Totals => Import:${totalConsumption.toFixed(2)} Export:${totalConsumption1.toFixed(2)} Overall:${total.toFixed(2)}`);

  return +total.toFixed(2);
}




async getWeeklyGeneration() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const result: { Day: string; [key: string]: number | string }[] = [];

  const now = moment().tz('Asia/Karachi');
  const monday = now.clone().startOf('week').add(1, 'day'); // Monday in PKT

  // console.log(`[WEEKLY] Base week (PKT). Monday: ${monday.format()}`);

  for (let i = 0; i < 7; i++) {
    const thisDayStart = monday.clone().add(i, 'days').startOf('day').toISOString(); // UTC Z
    const thisDayEnd   = monday.clone().add(i, 'days').endOf('day').toISOString();   // UTC Z

    const lastWeekStart = moment(thisDayStart).subtract(7, 'days').toISOString();
    const lastWeekEnd   = moment(thisDayEnd).subtract(7, 'days').toISOString();

    // console.log(`[WEEKLY] ${days[i]} | thisWeek: ${thisDayStart} -> ${thisDayEnd} | lastWeek: ${lastWeekStart} -> ${lastWeekEnd}`);

    const [thisWeek, lastWeek] = await Promise.all([
      this.calculateConsumption1({ start: thisDayStart, end: thisDayEnd }),
      this.calculateConsumption1({ start: lastWeekStart, end: lastWeekEnd }),
    ]);

    // console.log(`[WEEKLY] ${days[i]} => thisWeek:${thisWeek.toFixed(2)} lastWeek:${lastWeek.toFixed(2)}`);

    result.push({
      Day: days[i],
      "This Week": +thisWeek.toFixed(2),
      "Last Week": +lastWeek.toFixed(2),
    });
  }

  return result;
}



async getTodayGeneration(): Promise<HourlyData[]> {
  const todayRange = this.getDayRange(0);
  const yesterdayRange = this.getDayRange(-1);

  const meterKeys = [
      "U19_PLC_Del_ActiveEnergy",
      "U21_PLC_Del_ActiveEnergy",
      "U11_GW01_Del_ActiveEnergy",
      "U13_GW01_Del_ActiveEnergy",
      "U6_GW02_Del_ActiveEnergy",
      "U13_GW02_Del_ActiveEnergy",
      "U16_GW03_Del_ActiveEnergy",
      "U17_GW03_Del_ActiveEnergy",
    // "U1_PLC_Del_ActiveEnergy",
    // "U2_PLC_Del_ActiveEnergy",
    // "U3_PLC_Del_ActiveEnergy",
    // "U4_PLC_Del_ActiveEnergy",
    // "U5_PLC_Del_ActiveEnergy",
    // "U6_PLC_Del_ActiveEnergy",
    // "U7_PLC_Del_ActiveEnergy",
    // "U8_PLC_Del_ActiveEnergy",
    // "U9_PLC_Del_ActiveEnergy",
    // "U10_PLC_Del_ActiveEnergy",
    // "U11_PLC_Del_ActiveEnergy",
    // "U12_PLC_Del_ActiveEnergy",
    // "U13_PLC_Del_ActiveEnergy",
    // "U14_PLC_Del_ActiveEnergy",
    // "U15_PLC_Del_ActiveEnergy",
    // "U16_PLC_Del_ActiveEnergy",
    // "U17_PLC_Del_ActiveEnergy",
    // "U18_PLC_Del_ActiveEnergy",
    // "U20_PLC_Del_ActiveEnergy",
    // // "U21_PLC_Del_ActiveEnergy",
    // "U1_GW01_Del_ActiveEnergy",
    // "U2_GW01_Del_ActiveEnergy",
    // "U3_GW01_Del_ActiveEnergy",
    // "U4_GW01_Del_ActiveEnergy",
    // "U5_GW01_Del_ActiveEnergy",
    // "U6_GW01_Del_ActiveEnergy",
    // "U7_GW01_Del_ActiveEnergy",
    // "U8_GW01_Del_ActiveEnergy",
    // "U9_GW01_Del_ActiveEnergy",
    // "U10_GW01_Del_ActiveEnergy",
    // "U11_GW01_Del_ActiveEnergy",
    // "U12_GW01_Del_ActiveEnergy",
    // "U13_GW01_Del_ActiveEnergy",
    // "U14_GW01_Del_ActiveEnergy",
    // "U15_GW01_Del_ActiveEnergy",
    // "U16_GW01_Del_ActiveEnergy",
    // "U17_GW01_Del_ActiveEnergy",
    // "U18_GW01_Del_ActiveEnergy",
    // "U19_GW01_Del_ActiveEnergy",
    // "U20_GW01_Del_ActiveEnergy",
    // "U21_GW01_Del_ActiveEnergy",
    // "U22_GW01_Del_ActiveEnergy",
    // // "U23_GW01_Del_ActiveEnergy",
    // // Unit 5 meters
    // "U1_GW02_Del_ActiveEnergy",
    // "U2_GW02_Del_ActiveEnergy",
    // "U3_GW02_Del_ActiveEnergy",
    // "U4_GW02_Del_ActiveEnergy",
    // "U5_GW02_Del_ActiveEnergy",
    // // "U6_GW02_Del_ActiveEnergy",
    // "U7_GW02_Del_ActiveEnergy",
    // "U8_GW02_Del_ActiveEnergy",
    // "U9_GW02_Del_ActiveEnergy",
    // "U10_GW02_Del_ActiveEnergy",
    // "U11_GW02_Del_ActiveEnergy",
    // "U12_GW02_Del_ActiveEnergy",
    // "U13_GW02_Del_ActiveEnergy",
    // "U14_GW02_Del_ActiveEnergy",
    // "U15_GW02_Del_ActiveEnergy",
    // "U16_GW02_Del_ActiveEnergy",
    // "U17_GW02_Del_ActiveEnergy",
    // "U18_GW02_Del_ActiveEnergy",
    // "U19_GW02_Del_ActiveEnergy",
    // "U20_GW02_Del_ActiveEnergy",
    // "U21_GW02_Del_ActiveEnergy",
    // "U22_GW02_Del_ActiveEnergy",
    // "U23_GW02_Del_ActiveEnergy",
    // "U1_GW03_Del_ActiveEnergy",
    // "U2_GW03_Del_ActiveEnergy",
    // "U3_GW03_Del_ActiveEnergy",
    // "U4_GW03_Del_ActiveEnergy",
    // "U5_GW03_Del_ActiveEnergy",
    // "U6_GW03_Del_ActiveEnergy",
    // "U7_GW03_Del_ActiveEnergy",
    // "U8_GW03_Del_ActiveEnergy",
    // "U9_GW03_Del_ActiveEnergy",
    // "U10_GW03_Del_ActiveEnergy",
    // "U11_GW03_Del_ActiveEnergy",
    // "U12_GW03_Del_ActiveEnergy",
    // "U13_GW03_Del_ActiveEnergy",
    // "U14_GW03_Del_ActiveEnergy",
    // "U15_GW03_Del_ActiveEnergy",
    // "U16_GW03_Del_ActiveEnergy",
    // // "U17_GW03_Del_ActiveEnergy",
    // "U18_GW03_Del_ActiveEnergy",
    // "U19_GW03_Del_ActiveEnergy",
    // "U20_GW03_Del_ActiveEnergy", //for trafo3
    // "U21_GW03_Del_ActiveEnergy", // for trafo4
    // "U22_GW03_Del_ActiveEnergy",
    // "U23_GW03_Del_ActiveEnergy",

  ];

  const projection: Record<string, number> = { timestamp: 1 };
  meterKeys.forEach(key => projection[key] = 1);

  const [todayData, yesterdayData] = await Promise.all([
    this.generationModel.aggregate([
      { $match: { timestamp: { $gte: todayRange.start, $lte: todayRange.end } } },
      { $project: projection },
      { $sort: { timestamp: 1 } }
    ]),
    this.generationModel.aggregate([
      { $match: { timestamp: { $gte: yesterdayRange.start, $lte: yesterdayRange.end } } },
      { $project: projection },
      { $sort: { timestamp: 1 } }
    ])
  ]);

  const calculateHourly = (data: any[], hour: number, offset: number): number => {
    const base = moment().tz("Asia/Karachi").startOf("day").add(offset, 'days');
    const hourStart = base.clone().add(hour, 'hours');
    const hourEnd = hourStart.clone().add(1, 'hour');

    const firstValues: Record<string, number | null> = {};
    const lastValues: Record<string, number | null> = {};

    for (const doc of data) {
      const time = moment(doc.timestamp).tz("Asia/Karachi");
      if (time.isBetween(hourStart, hourEnd, null, '[)')) {
        meterKeys.forEach(key => {
          const val = doc[key];
          if (typeof val === "number") {
            if (firstValues[key] === undefined || firstValues[key] === null) {
              firstValues[key] = val;
            }
            lastValues[key] = val;
          }
        });
      }
    }

    let total = 0;
    meterKeys.forEach(key => {
      const first = firstValues[key];
      const last = lastValues[key];
      if (first !== null && last !== null && first !== undefined && last !== undefined) {
        let diff = last - first;
        if (diff < 0 || diff > 1e12 || diff < 1e-6) diff = 0;
        total += diff;
      }
    });

    return +total.toFixed(2);
  };

  const hourlyData: HourlyData[] = [];

  for (let hour = 0; hour < 24; hour++) {
    const today = calculateHourly(todayData, hour, 0);
    const yesterday = calculateHourly(yesterdayData, hour, -1);

    hourlyData.push({
      Time: `${hour.toString().padStart(2, '0')}:00`,
      Today: today,
      Yesterday: yesterday
    });
  }

  return hourlyData;
}


  
  private getDayRange(offset: number): { start: string; end: string } {
    const date = new Date();
    date.setDate(date.getDate() + offset);
  
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
  
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
  
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }
  

  async getMonthlyGeneration() {
  const weekLabels = ["Week1", "Week2", "Week3", "Week4"];
  const result: { Weeks: string; [key: string]: number | string }[] = [];

  const getWeekRanges = (month: number, year: number) => {
    const weeks: [string, string][] = [];
    const startDate = new Date(year, month - 1, 1); // first day of month
    const firstMonday = new Date(startDate);
    while (firstMonday.getDay() !== 1) {
      firstMonday.setDate(firstMonday.getDate() + 1);
    }

    for (let i = 0; i < 4; i++) {
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      weeks.push([
        new Date(weekStart.setHours(0, 0, 0, 0)).toISOString(),
        new Date(weekEnd.setHours(23, 59, 59, 999)).toISOString(),
      ]);
    }

    return weeks;
  };

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const lastMonthDate = new Date(now.setMonth(now.getMonth() - 1));
  const lastMonth = lastMonthDate.getMonth() + 1;
  const lastYear = lastMonthDate.getFullYear();

  const weeksThisMonth = getWeekRanges(currentMonth, currentYear);
  const weeksLastMonth = getWeekRanges(lastMonth, lastYear);

  for (let i = 0; i < 4; i++) {
    const thisMonth = await this.calculateConsumption({
      start: weeksThisMonth[i][0],
      end: weeksThisMonth[i][1],
    });

    const lastMonth = await this.calculateConsumption({
      start: weeksLastMonth[i][0],
      end: weeksLastMonth[i][1],
    });

    result.push({
      Weeks: weekLabels[i],
      "This Month": +thisMonth.toFixed(2),
      "Last Month": +lastMonth.toFixed(2),
    });
  }

  return result;
}

  private getMonthDateRange(year: number, month: number): { start: string; end: string } {
    const start = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)); // last day of month
  
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }
  

  async getYearlyGeneration(): Promise<
  { Month: string; [key: string]: number | string }[]
> {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  const result: { Month: string; [key: string]: number | string }[] = [];

  for (let month = 0; month < 12; month++) {
    const currentYearRange = this.getMonthDateRange(currentYear, month);
    const previousYearRange = this.getMonthDateRange(previousYear, month);

    const currentYearConsumption = Number(await this.calculateConsumption(currentYearRange)) || 0;
    const previousYearConsumption = Number(await this.calculateConsumption(previousYearRange)) || 0;

    result.push({
      Month: months[month],
      "Current Year": +currentYearConsumption.toFixed(2),
      "Previous Year": +previousYearConsumption.toFixed(2),
    });
  }

  return result;
}


}
  
  
  
  
  
  
  
  


