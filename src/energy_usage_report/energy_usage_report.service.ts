import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { Energyusagereport } from './schemas/energy-usage_report.schema';
import { DailyProduction } from './schemas/daily-production.schema';
import { FieldMeterProcess } from './schemas/field-meter-process.schema';
import * as moment from 'moment-timezone';

@Injectable()
export class EnergyUsageReportService {
  constructor(
    @InjectModel(Energyusagereport.name, 'surajcotton') private costModel: Model<Energyusagereport>,
    @InjectModel(DailyProduction.name, 'surajcotton') private dailyModel: Model<DailyProduction>,
    @InjectModel(FieldMeterProcess.name, 'surajcotton') private fieldMeterModel: Model<FieldMeterProcess>,
  ) {}

  private sanitizeValue(value: number): number {
    if (!isFinite(value) || isNaN(value)) return 0;
    const minThreshold = 1e-6;
    const maxThreshold = 1e+12;
    if (Math.abs(value) < minThreshold || Math.abs(value) > maxThreshold) return 0;
    return value;
  }

async getConsumptionData(dto: GetEnergyCostDto) {
  const { start_date, end_date, suffixes, area, start_time, end_time } = dto;
  const suffix = suffixes?.[0] || 'Del_ActiveEnergy';

  // -------------------------------
  // Mappings
  // -------------------------------
  const AutoConeMapping: Record<string, string[]> = {
    // Unit_4: ['U4_U23_GW03', 'U4_U22_GW03'],
    // Unit_5: ['U5_U23_GW03', 'U5_U22_GW03', 'U18_GW02', 'U10_GW03'],
    Unit_4: ['U4_U23_GW03'],
    Unit_5: ['U5_U23_GW03'],
  };
  const CardMapping: Record<string, string[]> = {
    Unit_4: ['U5_GW01', 'U9_GW01', 'U4_U3_GW02', 'U4_U1_GW02', 'U4_U2_GW02'],
    Unit_5: ['U19_GW02', 'U17_GW02', 'U11_GW02','U5_U3_GW02', 'U5_U1_GW02', 'U5_U2_GW02'],
  };
  const ComberMapping: Record<string, string[]> = {
    Unit_4: ['U4_U4_GW02', 'U13_PLC'],
    Unit_5: ['U5_U4_GW02', 'U6_GW03'],
  };
  const BlowRoomMapping: Record<string, string[]> = {
    Unit_4: ['U8_GW01', 'U14_GW01'],
    Unit_5: ['U12_GW02', 'U9_GW02'],
  };

  const DrawingMapping: Record<string, string[]> = {
    Unit_4: ['U8_PLC', 'U1_GW01'],
  };
    const SimplexMapping: Record<string, string[]> = {
    Unit_4: ['U15_PLC'],
    Unit_5: ['U21_GW02'],
  };
    const RTransportSystemMapping: Record<string, string[]> = {
    Unit_5: ['U4_GW03'],
    Unit_4: ['U1_PLC'],

  };
    const RingMapping: Record<string, string[]> = {
    Unit_4: ['U10_PLC', 'U11_PLC', 'U12_PLC', 'U17_PLC', 'U15_GW01', 'U17_GW01', 'U16_GW01'],
    Unit_5: ['U10_GW02', 'U7_GW02', 'U1_GW03','U5_GW03', 'U9_GW03', 'U12_GW03'],
  };

  const AirCompressorMapping: Record<string, string[]> = {
  
    Unit_4: ['U14_PLC', 'U16_PLC'],
  };
  const TurbineMapping: Record<string, string[]> = {
    Unit_4: ['U6_PLC'],
    Unit_5: ['U15_GW03'],
  };
  const BailingPressMapping: Record<string, string[]> = {
    Unit_4: ['U18_GW01'],
    Unit_5: ['U11_GW03'],

  };
  const ResidentialcolonyMapping: Record<string, string[]> = {
    Unit_4: ['U4_GW01','U6_GW01'],
    Unit_5: ['U3_GW03'],

  };
  const SpareMapping: Record<string, string[]> = {
    Unit_4: ['U7_PLC','U20_GW01','U21_GW01'],
    Unit_5: ['U22_GW02','U14_GW02','U7_GW03', 'U8_GW03'],

  };
    const WindingMapping: Record<string, string[]> = {
    Unit_4: ['U9_PLC','U10_GW01','U3_GW01'],
    Unit_5: ['U20_GW02'],

  };
  const BypassMapping: Record<string, string[]> = {
    Unit_4: ['U18_PLC','U12_GW01','U20_PLC']
    
  };
  const PackingMapping: Record<string, string[]> = {
    Unit_4: ['U2_GW01'],
    Unit_5: ['U14_GW03'],

    
  };
    const LabMapping: Record<string, string[]> = {
    Unit_4: ['U19_GW01']
    
  };
    const FrameFinisherMapping: Record<string, string[]> = {
    Unit_5: ['U23_GW02']
    
  };
    const ACPlantMapping: Record<string, string[]> = {
    Unit_5: ['U15_GW02', 'U8_GW02']
    
  };
    const FiberdepositMapping: Record<string, string[]> = {
    Unit_5: ['U13_GW03']
    
  };
    const YarnMapping: Record<string, string[]> = {
    Unit_5: ['U2_GW03']
    
  };
    const WaterChillerMapping: Record<string, string[]> = {
    Unit_5: ['U16_GW02']
    
  };
      const HFO2ndSourceMapping: Record<string, string[]> = {
    Unit_4: ['U5_PLC', 'U7 GW01']
    
  };
  const LightningMapping: Record<string, string[]> = {
    Unit_4: ['U4_PLC', 'U3_PLC']
  };
  const AuxUnit5Mapping: Record<string, string[]> = {
    Unit_4: ['U2_PLC']
  };
  const CapacitorbankMapping: Record<string, string[]> = {
    Unit_5: ['U18_GW03', 'U5_GW02']
  };

  // -------------------------------
  // Time range & areas
  // -------------------------------
 // ✅ Start 6 AM of start_date
// ✅ Start ISO
const startMoment = moment
  .tz(start_date, 'YYYY-MM-DD', 'Asia/Karachi')
  .hour(start_time ? parseInt(start_time.split(':')[0]) : 6)
  .minute(start_time ? parseInt(start_time.split(':')[1]) : 0)
  .second(0)
  .millisecond(0);

const startISO = startMoment.toISOString(true);

// ✅ End ISO
let endMoment = moment.tz(end_date, 'YYYY-MM-DD', 'Asia/Karachi');

if (end_time) {
  const [eh, em] = end_time.split(':').map(Number);
  endMoment = endMoment.hour(eh).minute(em).second(59).millisecond(999);

  // ⚡ Agar end <= start ho gaya, toh +1 day shift karna
  if (endMoment.isSameOrBefore(startMoment)) {
    endMoment.add(1, 'day');
  }
} else {
  // Default → next day 06:00
  endMoment = endMoment.add(1, 'day').hour(6).minute(0).second(0).millisecond(0);
}

const endISO = endMoment.toISOString(true);

console.log('📌 Query Range:', startISO, '➡️', endISO);


  const areaKeys = area === 'ALL' ? ['Unit_4', 'Unit_5'] : [area];

  // -------------------------------
  // Initialize accumulators
  // -------------------------------
  const AutoConeMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const CardingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const ComberMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const BlowRoomMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const DrawingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const SimplexMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const RTransportSystemMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const RingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const AirCompressorMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const TurbineMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const BailingPressMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const ResidentialcolonyMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const SpareMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const WindingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const BypassMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const PackingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const LabMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const FrameFinisherMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const ACPlantMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const FiberdepositMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const YarnMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const WaterChillerMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const HFO2ndSourceMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const LightningMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const AuxUnit5Map: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const CapacitorbankMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };



  // -------------------------------
  // Fetch first & last snapshot for the day (BlowRoom uses these)
  // -------------------------------
  const [docs] = await this.costModel.aggregate([
    { $match: { timestamp: { $gte: startISO, $lte: endISO } } },
    { $sort: { timestamp: 1 } },
    { $group: { _id: null, first: { $first: '$$ROOT' }, last: { $last: '$$ROOT' } } },
  ]);

  const firstDoc = docs?.first;
  const lastDoc = docs?.last;

  if (!firstDoc || !lastDoc) {
    const result: any = { date: start_date, startTimestamp: null, endTimestamp: null };
    for (const areaKey of areaKeys) {
      result[`${areaKey.toLowerCase()}AutoCone_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Carding_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Comber_consumption`] = 0;
      result[`${areaKey.toLowerCase()}BlowRoom_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Drawing_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Simplex_consumption`] = 0;
      result[`${areaKey.toLowerCase()}RTransportSystem_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Ring_consumption`] = 0;
      result[`${areaKey.toLowerCase()}AirCompressor_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Turbine_consumption`] = 0;
      result[`${areaKey.toLowerCase()}BailingPress_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Residentialcolony_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Spare_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Winding_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Bypass_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Packing_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Lab_consumption`] = 0;
      result[`${areaKey.toLowerCase()}FrameFinisher_consumption`] = 0;
      result[`${areaKey.toLowerCase()}ACPlant_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Fiberdeposit_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Yarn_consumption`] = 0;
      result[`${areaKey.toLowerCase()}WaterChiller_consumption`] = 0;
      result[`${areaKey.toLowerCase()}HFO2ndSource_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Lightning_consumption`] = 0;
      result[`${areaKey.toLowerCase()}AuxUnit5_consumption`] = 0;
      result[`${areaKey.toLowerCase()}Capacitorbank_consumption`] = 0;


    }
    return [result];
  }

  // -------------------------------
  // Fetch all field meter docs for AutoCone, Card, Comber
  // -------------------------------
  const allFieldMeters = [
    ...AutoConeMapping.Unit_4, ...AutoConeMapping.Unit_5,
    ...CardMapping.Unit_4, ...CardMapping.Unit_5,
    ...ComberMapping.Unit_4, ...ComberMapping.Unit_5,
  ].map((meterId) => `${meterId}_${suffix}`);

  const fieldMeterDocs = await this.fieldMeterModel.find({
    timestamp: { $gte: startISO, $lte: endISO },
    [allFieldMeters[0]]: { $exists: true },
  });

  // -------------------------------
  // Calculate consumption
  // -------------------------------
// -------------------------------
// Calculate consumption with debug logs
// -------------------------------
for (const key of areaKeys) {
  // console.log(`\n--- Area: ${key} ---`);

  // --- AutoCone ---
  for (const meterId of AutoConeMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;

    // If this meter is U18_GW02, treat like BlowRoom (start & end snapshot)
   if (['U18_GW02', 'U10_GW03', 'U23_GW03'].includes(meterId)) {
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      AutoConeMap[key] += consumption;
      // console.log(`AutoCone Meter (cumulative): ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
    } else {
      // Normal AutoCone logic
      const meterVals = fieldMeterDocs.map((doc) => doc.toObject()[meterKey]?.CONS ?? 0);
      const sum = meterVals.reduce((sum, val) => sum + this.sanitizeValue(val), 0);
      AutoConeMap[key] += sum;
      // console.log(`AutoCone Meter: ${meterKey} | Values: ${meterVals} | Sum: ${sum}`);
    }
  }

  // --- Card ---
    for (const key of areaKeys) {
      // console.log(`\n--- Area: ${key} ---`);

  // --- Carding ---
  for (const meterId of CardMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;

    // Special meters that need first-last snapshot (cumulative)
    if (['U19_GW02', 'U17_GW02', 'U11_GW02', 'U5_GW01', 'U9_GW01'].includes(meterId)) {
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      CardingMap[key] += consumption;
      // console.log(`Card Meter (cumulative): ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
    } else {
      // Normal Carding logic
      const meterVals = fieldMeterDocs.map((doc) => doc.toObject()[meterKey]?.CONS ?? 0);
      const sum = meterVals.reduce((sum, val) => sum + this.sanitizeValue(val), 0);
      CardingMap[key] += sum;
      // console.log(`Card Meter: ${meterKey} | Values: ${meterVals} | Sum: ${sum}`);
    }
  }}

  // --- Comber ---
    for (const meterId of ComberMapping[key] || []) {
  const meterKey = `${meterId}_${suffix}`;

  // Special meters that need first-last snapshot (cumulative)
  if (['U13_PLC', 'U6_GW03', 'U4_GW02'].includes(meterId)) {
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    ComberMap[key] += consumption;
    // console.log(`Comber Meter (cumulative): ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  } else {
    // Normal Comber logic
    const meterVals = fieldMeterDocs.map((doc) => doc.toObject()[meterKey]?.CONS ?? 0);
    const sum = meterVals.reduce((sum, val) => sum + this.sanitizeValue(val), 0);
    ComberMap[key] += sum;
    // console.log(`Comber Meter: ${meterKey} | Values: ${meterVals} | Sum: ${sum}`);
  }
}


  // --- BlowRoom (firstDoc & lastDoc direct values, no .CONS) ---
  for (const meterId of BlowRoomMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    BlowRoomMap[key] += consumption;

    // console.log(`BlowRoom Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }


  ///....Drawing (firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of DrawingMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    DrawingMap[key] += consumption;

    // console.log(`Drawing Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

   ///....Simplex (firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of SimplexMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    SimplexMap[key] += consumption;

    // console.log(`Simplex Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }
   ///....RTransportSystem (firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of RTransportSystemMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   RTransportSystemMap[key] += consumption;

    // console.log(`RTransportSystem Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }
     ///.... Ring(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of RingMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   RingMap[key] += consumption;

    // console.log(`Ring Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }
     ///.... AirCompressor(firstDoc & lastDoc direct values, no .CONS) ---

      for (const meterId of AirCompressorMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   AirCompressorMap[key] += consumption;

    // console.log(`AirCompressor Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }
       ///.... Turbine(firstDoc & lastDoc direct values, no .CONS) ---

      for (const meterId of TurbineMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   TurbineMap[key] += consumption;

    // console.log(`Turbine Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

         ///.... BailingPress(firstDoc & lastDoc direct values, no .CONS) ---

      for (const meterId of BailingPressMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   BailingPressMap[key] += consumption;

    // console.log(`BailingPress Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }
///.... BailingPress(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of ResidentialcolonyMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   ResidentialcolonyMap[key] += consumption;

    // console.log(`Residentialcolony Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

  ///.... Spare(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of SpareMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   SpareMap[key] += consumption;

    // console.log(`Spare Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

    ///.... Winding(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of WindingMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   WindingMap[key] += consumption;

    // console.log(`Winding Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

      ///.... Bypass(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of BypassMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   BypassMap[key] += consumption;

    // console.log(`Bypass Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

        ///.... Packing(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of PackingMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   PackingMap[key] += consumption;

    // console.log(`Packing Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

          ///.... Lab(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of LabMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
   LabMap[key] += consumption;

    // console.log(`Lab Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

            ///.... FrameFinisher(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of FrameFinisherMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    FrameFinisherMap[key] += consumption;

    // console.log(`FrameFinisher Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

  
            ///.... ACPlant(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of ACPlantMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    ACPlantMap[key] += consumption;

    // console.log(`ACPlant Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

   
            ///.... Fiberdeposit(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of FiberdepositMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    FiberdepositMap[key] += consumption;

    // console.log(`Fiberdeposit Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

              ///.... Yarn(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of YarnMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    YarnMap[key] += consumption;

    // console.log(`Yarn Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

                ///.... WaterChiller(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of WaterChillerMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    WaterChillerMap[key] += consumption;

    // console.log(`WaterChiller Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

  
                ///.... HFO2ndSource(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of HFO2ndSourceMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    HFO2ndSourceMap[key] += consumption;

    // console.log(`HFO2ndSource Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

                  ///.... Lightning(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of LightningMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    LightningMap[key] += consumption;

    // console.log(`Lightning Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }
                    ///.... AuxUnit5(firstDoc & lastDoc direct values, no .CONS) ---
    for (const meterId of AuxUnit5Mapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
    AuxUnit5Map[key] += consumption;

    // console.log(`AuxUnit5 Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }

      for (const meterId of  CapacitorbankMapping[key] || []) {
    const meterKey = `${meterId}_${suffix}`;
    const startVal = this.sanitizeValue(firstDoc[meterKey]);
    const endVal = this.sanitizeValue(lastDoc[meterKey]);
    const consumption = this.sanitizeValue(endVal - startVal);
     CapacitorbankMap[key] += consumption;

    console.log(`AuxUnit5 Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
  }
  }

  // -------------------------------
  // Prepare result
  // -------------------------------
  const result: any = {
    date: start_date,
    startTimestamp: firstDoc.timestamp,
    endTimestamp: lastDoc.timestamp,
  };

  for (const areaKey of areaKeys) {
    result[`${areaKey.toLowerCase()}AutoCone_consumption`] = +AutoConeMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Carding_consumption`] = +CardingMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Comber_consumption`] = +ComberMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}BlowRoom_consumption`] = +BlowRoomMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Drawing_consumption`] = +DrawingMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Simplex_consumption`] = +SimplexMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}RTransportSystem_consumption`] = +RTransportSystemMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Ring_consumption`] = +RingMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}AirCompressor_consumption`] = +AirCompressorMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Turbine_consumption`] = +TurbineMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}BailingPress_consumption`] = +BailingPressMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Residentialcolony_consumption`] = +ResidentialcolonyMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Spare_consumption`] = +SpareMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Winding_consumption`] = +WindingMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Bypass_consumption`] = +BypassMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Packing_consumption`] = +PackingMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Lab_consumption`] = +LabMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}FrameFinisher_consumption`] = +FrameFinisherMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}ACPlant_consumption`] = +ACPlantMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Fiberdeposit_consumption`] = +FiberdepositMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Yarn_consumption`] = +YarnMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}WaterChiller_consumption`] = +WaterChillerMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}HFO2ndSource_consumption`] = +HFO2ndSourceMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Lightning_consumption`] = +LightningMap[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}AuxUnit5_consumption`] = +AuxUnit5Map[areaKey].toFixed(2);
    result[`${areaKey.toLowerCase()}Capacitorbank_consumption`] = +CapacitorbankMap[areaKey].toFixed(2);

  }

  return [result];
}



}
