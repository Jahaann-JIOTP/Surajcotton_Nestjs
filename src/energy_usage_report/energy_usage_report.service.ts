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
  ) { }

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


    const Card_BreakerMapping: Record<string, string[]> = {
      Unit_4: ['U5_GW01', 'U9_GW01'], //1
    };
    const BlowRoomMapping: Record<string, string[]> = {
      Unit_4: ['U8_GW01'],
      Unit_5: ['U12_GW02', 'U9_GW02'], //2
    };
    const CardMapping: Record<string, string[]> = {
      // Unit_4: ['U4_U3_GW02', 'U4_U1_GW02', 'U4_U2_GW02'], jab feild meter add add hon gay nicy feild meter ki logic b un comment karni ha
      Unit_5: ['U19_GW02', 'U17_GW02'], //3
    };
    const ComberandunilapMapping: Record<string, string[]> = {
      Unit_4: ['U13_PLC'],
      Unit_5: ['U14_GW02', 'U6_GW03'],//4
    };
    const DrawingFinisherand2BreakerMapping: Record<string, string[]> = {
      Unit_4: ['U8_PLC'], //5

    };
    const DrawingFinisher1to8BreakerMapping: Record<string, string[]> = {
      Unit_5: ['U23_GW02'], //6

    };

    const DrawingSimplexMapping: Record<string, string[]> = {
      Unit_4: ['U15_PLC'], //7

    };
    const DrawingSimplex_BreakerMapping: Record<string, string[]> = {
      Unit_5: ['U21_GW02'], //7

    };
    //   const DrawingBreakerandSimplexMapping: Record<string, string[]> = {
    //   Unit_5: ['U21_GW02'], //8

    // };

    const RTransportSystemMapping: Record<string, string[]> = {
      Unit_5: ['U4_GW03'], // 9
      Unit_4: ['U1_PLC'],
    };
    const RingMapping: Record<string, string[]> = {
      Unit_4: ['U10_PLC', 'U11_PLC', 'U12_PLC', 'U15_GW01', 'U17_GW01', 'U16_GW01', 'U22_GW02'],
      Unit_5: ['U10_GW02', 'U7_GW02', 'U1_GW03', 'U5_GW03', 'U9_GW03', 'U12_GW03'], //10
    }; //9

    const AutoCone_Winding10to18Mapping: Record<string, string[]> = {
      Unit_4: ['U9_PLC', 'U10_GW01'],
      Unit_5: ['U18_GW02', 'U10_GW03'], // 11

    };
    const B_CardandComberFilterMapping: Record<string, string[]> = {
      Unit_4: ['U14_GW01', 'U12_GW01'],
      Unit_5: ['U13_GW03'], // 12

    };
    const AC_BackProcessMapping: Record<string, string[]> = {
      Unit_4: ['U1_GW01'],
      Unit_5: ['U11_GW02'], // 13

    };
    const AC_RingMapping: Record<string, string[]> = {
      Unit_4: ['U18_PLC', 'U17_PLC'],
      Unit_5: ['U8_GW02', 'U15_GW02'], // 14

    };

    const AC_AutoCone_WindingMapping: Record<string, string[]> = {
      Unit_4: ['U3_GW01'],
      Unit_5: ['U20_GW02'], // 15

    };

    const AirCompressorMapping: Record<string, string[]> = {

      Unit_4: ['U14_PLC', 'U20_PLC'],
      Unit_5: ['U16_PLC'], // 16

    };
    const Deep_Well_TurbineMapping: Record<string, string[]> = {
      Unit_4: ['U6_PLC'],
      Unit_5: ['U15_GW03'],//  17
    };
    const BailingPressMapping: Record<string, string[]> = {
      Unit_4: ['U20_GW01'],
      Unit_5: ['U11_GW03'], // 18

    };
    const Mills_LightingMapping: Record<string, string[]> = {
      Unit_4: ['U4_PLC', 'U3_PLC'],
      Unit_5: ['U14_GW03', 'U2_PLC'] // 19

    };
    const ResidentialcolonyMapping: Record<string, string[]> = {
      Unit_4: ['U18_GW01'],
      Unit_5: ['U3_GW03'], // 20

    };
    const Conditioning_MachineMapping: Record<string, string[]> = {
      Unit_4: ['U2_GW01'],
      Unit_5: ['U2_GW03'], // 21

    };
    const WorkshopMapping: Record<string, string[]> = {
      Unit_4: ['U4_GW01'], ///22


    };
    const Lab_and_OfficesMapping: Record<string, string[]> = { //Done
      Unit_4: ['U19_GW01'] //23

    };
    const Power_House2ndSourceGasMapping: Record<string, string[]> = { //Done
      Unit_4: ['U5_PLC'] //24

    };
    const Power_House2ndSourceHFOMapping: Record<string, string[]> = { //Done
      Unit_4: ['U11_GW01'] //25

    };
    const WaterChillerMapping: Record<string, string[]> = {
      Unit_5: ['U16_GW02'] //26

    };
    const SpareMapping: Record<string, string[]> = {
      Unit_4: ['U6_GW01', 'U21_GW01'],
      Unit_5: ['U7_GW03', 'U8_GW03'], //27

    };






    const TZ = 'Asia/Karachi';

    let startISO: string;
    let endISO: string;

    if (start_time && end_time) {
      // Custom time window
      startISO = moment.tz(`${start_date} ${start_time}`, "YYYY-MM-DD HH:mm", TZ)
        .startOf('minute')
        .format("YYYY-MM-DDTHH:mm:ssZ");

      endISO = moment.tz(`${end_date} ${end_time}`, "YYYY-MM-DD HH:mm", TZ)
        .endOf('minute')
        .format("YYYY-MM-DDTHH:mm:ssZ");

      // Move end to next day if same or before start
      if (moment(endISO).isSameOrBefore(moment(startISO))) {
        endISO = moment.tz(`${end_date} ${end_time}`, "YYYY-MM-DD HH:mm", TZ)
          .add(1, 'day')
          .endOf('minute')
          .format("YYYY-MM-DDTHH:mm:ssZ");
      }
    } else {
      // Default 6AM → 6AM next day
      startISO = moment.tz(`${start_date} 06:00:00`, "YYYY-MM-DD HH:mm:ss", TZ)
        .format("YYYY-MM-DDTHH:mm:ssZ");

      endISO = moment.tz(`${start_date} 06:00:00`, "YYYY-MM-DD HH:mm:ss", TZ)
        .add(1, 'day')
        .set({ second: 59, millisecond: 999 })
        .format("YYYY-MM-DDTHH:mm:ssZ");
    }

    // console.log('📌 startISO:', startISO);
    // console.log('📌 endISO:', endISO);


    const areaKeys = area === 'ALL' ? ['Unit_4', 'Unit_5'] : [area];

    // -------------------------------
    // Initialize accumulators
    // -------------------------------
    const Card_BreakerMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const AutoConeMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };

    const CardingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const ComberandunilapMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const BlowRoomMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const AutoCone_Winding10to18Map: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const B_CardandComberFilterMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const AC_BackProcessMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const AC_RingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const AC_AutoCone_WindingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const Conditioning_MachineMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const Power_House2ndSourceGasMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const Power_House2ndSourceHFOMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };

    const WorkshopMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const DrawingFinisherand2BreakerMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const DrawingFinisher1to8BreakerMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const DrawingSimplexMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const DrawingSimplex_BreakerMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };

    const WaterChillerMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };

    const RTransportSystemMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const RingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const AirCompressorMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const Deep_Well_TurbineMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const BailingPressMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const ResidentialcolonyMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const Mills_LightingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const Lab_and_OfficesMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    const SpareMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const WindingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const BypassMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const PackingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const SimplexMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const FrameFinisherMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const ACPlantMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const FiberdepositMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const YarnMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };

    // const HFO2ndSourceMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const AuxUnit5Map: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
    // const CapacitorbankMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };



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
        result[`${areaKey.toLowerCase()}Card_Breaker_consumption`] = 0;
        // result[`${areaKey.toLowerCase()}AutoCone_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Carding_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Comberandunilap_consumption`] = 0;
        result[`${areaKey.toLowerCase()}BlowRoom_consumption`] = 0;
        result[`${areaKey.toLowerCase()}AutoCone_Winding10to18_consumption`] = 0;
        result[`${areaKey.toLowerCase()}B_CardandComberFilter_consumption`] = 0;
        result[`${areaKey.toLowerCase()}AC_BackProcess_consumption`] = 0;
        result[`${areaKey.toLowerCase()}AC_Ring_consumption`] = 0;
        result[`${areaKey.toLowerCase()}AC_AutoCone_Winding_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Conditioning_Machine_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Power_House2ndSourceGas_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Power_House2ndSourceHFO_consumption`] = 0;

        result[`${areaKey.toLowerCase()}Workshop_consumption`] = 0;
        result[`${areaKey.toLowerCase()}DrawingFinisherand2Breaker_consumption`] = 0;
        result[`${areaKey.toLowerCase()}DrawingFinisher1to8Breaker_consumption`] = 0;
        result[`${areaKey.toLowerCase()}DrawingSimplex_consumption`] = 0;
        result[`${areaKey.toLowerCase()}DrawingSimplex_Breaker_consumption`] = 0;




        result[`${areaKey.toLowerCase()}Simplex_consumption`] = 0;
        result[`${areaKey.toLowerCase()}RTransportSystem_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Ring_consumption`] = 0;
        result[`${areaKey.toLowerCase()}AirCompressor_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Deep_Well_Turbine_consumption`] = 0;
        result[`${areaKey.toLowerCase()}BailingPress_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Residentialcolony_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Spare_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Winding_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Bypass_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Packing_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Lab_and_Offices_consumption`] = 0;
        result[`${areaKey.toLowerCase()}FrameFinisher_consumption`] = 0;
        result[`${areaKey.toLowerCase()}ACPlant_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Fiberdeposit_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Yarn_consumption`] = 0;
        result[`${areaKey.toLowerCase()}WaterChiller_consumption`] = 0;
        result[`${areaKey.toLowerCase()}HFO2ndSource_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Mills_Lighting_consumption`] = 0;
        result[`${areaKey.toLowerCase()}AuxUnit5_consumption`] = 0;
        result[`${areaKey.toLowerCase()}Capacitorbank_consumption`] = 0;


      }
      return [result];
    }

    // -------------------------------
    // Fetch all field meter docs for AutoCone, Card, Comberandunilap
    // -------------------------------
    const allFieldMeters = [
      // ...AutoConeMapping.Unit_4, ...AutoConeMapping.Unit_5,
      // ...CardMapping.Unit_4, ...CardMapping.Unit_5,
      // ...ComberandunilapMapping.Unit_4, ...ComberandunilapMapping.Unit_5,
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

      // --- CardBreaker ---
      // for (const meterId of Card_BreakerMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;

      //   // If this meter is U18_GW02, treat like BlowRoom (start & end snapshot)
      //  if (['U5_GW01', 'U9_GW01'].includes(meterId)) {
      //     const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //     const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //     const consumption = this.sanitizeValue(endVal - startVal);
      //     Card_BreakerMap[key] += consumption;
      //     // console.log(`AutoCone Meter (cumulative): ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      //   } else {
      //     // Normal AutoCone logic
      //     const meterVals = fieldMeterDocs.map((doc) => doc.toObject()[meterKey]?.CONS ?? 0);
      //     const sum = meterVals.reduce((sum, val) => sum + this.sanitizeValue(val), 0);
      //     Card_BreakerMap[key] += sum;
      //     // console.log(`AutoCone Meter: ${meterKey} | Values: ${meterVals} | Sum: ${sum}`);
      //   }
      // }

      // --- AutoCone ---
      // for (const meterId of AutoCone_Winding10to18Mapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;

      //   // If this meter is U18_GW02, treat like BlowRoom (start & end snapshot)
      //  if (['U18_GW02', 'U10_GW03', 'U9_PLC', 'U10_GW01'].includes(meterId)) {
      //     const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //     const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //     const consumption = this.sanitizeValue(endVal - startVal);
      //     AutoCone_Winding10to18Map[key] += consumption;
      //     // console.log(`AutoCone Meter (cumulative): ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      //   } else {
      //     // Normal AutoCone logic
      //     const meterVals = fieldMeterDocs.map((doc) => doc.toObject()[meterKey]?.CONS ?? 0);
      //     const sum = meterVals.reduce((sum, val) => sum + this.sanitizeValue(val), 0);
      //     AutoCone_Winding10to18Map[key] += sum;
      //     // console.log(`AutoCone Meter: ${meterKey} | Values: ${meterVals} | Sum: ${sum}`);
      //   }
      // }

      // --- Card ---
      for (const key of areaKeys) {
        // console.log(`\n--- Area: ${key} ---`);

        // --- Carding ---
        for (const meterId of CardMapping[key] || []) {
          const meterKey = `${meterId}_${suffix}`;

          // Special meters that need first-last snapshot (cumulative)
          if (['U19_GW02', 'U17_GW02'].includes(meterId)) {
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
        }
      }

      // --- Comberandunilap ---
      for (const meterId of ComberandunilapMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;

        // Special meters that need first-last snapshot (cumulative)
        if (['U13_PLC'].includes(meterId)) {
          const startVal = this.sanitizeValue(firstDoc[meterKey]);
          const endVal = this.sanitizeValue(lastDoc[meterKey]);
          const consumption = this.sanitizeValue(endVal - startVal);
          ComberandunilapMap[key] += consumption;
          // console.log(`Comberandunilap Meter (cumulative): ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
        } else {
          // Normal Comberandunilap logic
          const meterVals = fieldMeterDocs.map((doc) => doc.toObject()[meterKey]?.CONS ?? 0);
          const sum = meterVals.reduce((sum, val) => sum + this.sanitizeValue(val), 0);
          ComberandunilapMap[key] += sum;
          // console.log(`Comberandunilap Meter: ${meterKey} | Values: ${meterVals} | Sum: ${sum}`);
        }
      }


      // --- BlowRoom (firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of BlowRoomMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        BlowRoomMap[key] += consumption;

        // console.log(`Card_Breaker Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      for (const meterId of Card_BreakerMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        Card_BreakerMap[key] += consumption;

        // console.log(`Card_Breaker Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }


      ///....DrawingFinisherand2Breaker (firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of DrawingFinisherand2BreakerMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        DrawingFinisherand2BreakerMap[key] += consumption;

        // console.log(`DrawingFinisherand2Breaker Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }

      ///....DrawingFinisher1to8Breaker(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of DrawingFinisher1to8BreakerMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        DrawingFinisher1to8BreakerMap[key] += consumption;

        // console.log(`DrawingFinisherand2Breaker Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      ///....DrawingSimplex(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of DrawingSimplex_BreakerMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        DrawingSimplex_BreakerMap[key] += consumption;

        // console.log(`DrawingFinisherand2Breaker Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }

      ///....DrawingSimplex(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of DrawingSimplexMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        DrawingSimplexMap[key] += consumption;

        // console.log(`DrawingFinisherand2Breaker Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }


      ///....AutoCone_Winding10to18(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of AutoCone_Winding10to18Mapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        AutoCone_Winding10to18Map[key] += consumption;

        // console.log(`AutoCone_Winding10to18 Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }

      ///....B_CardandComberFilter(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of B_CardandComberFilterMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        B_CardandComberFilterMap[key] += consumption;

        // console.log(`B_CardandComberFilter Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      ///....AC_BackProcess(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of AC_BackProcessMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        AC_BackProcessMap[key] += consumption;

        // console.log(`AC_BackProcess Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      ///....AC_BackProcess(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of AC_RingMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        AC_RingMap[key] += consumption;

        // console.log(`AC_BackProcess Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      for (const meterId of AC_AutoCone_WindingMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        AC_AutoCone_WindingMap[key] += consumption;

        // console.log(`Conditioning_Machine Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      for (const meterId of Conditioning_MachineMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        Conditioning_MachineMap[key] += consumption;

        // console.log(`Conditioning_Machine Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      for (const meterId of Power_House2ndSourceGasMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        Power_House2ndSourceGasMap[key] += consumption;

        // console.log(`Power_House2ndSourceHFO Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      for (const meterId of Power_House2ndSourceHFOMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        Power_House2ndSourceHFOMap[key] += consumption;

        // console.log(`Power_House2ndSourceHFO Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      for (const meterId of WorkshopMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        WorkshopMap[key] += consumption;

        // console.log(`WorkshopMeter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }



      //  ///....Simplex (firstDoc & lastDoc direct values, no .CONS) ---
      //   for (const meterId of SimplexMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //   SimplexMap[key] += consumption;

      //   // console.log(`Simplex Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }
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
      ///.... Deep_Well_Turbine(firstDoc & lastDoc direct values, no .CONS) ---

      for (const meterId of Deep_Well_TurbineMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        Deep_Well_TurbineMap[key] += consumption;

        // console.log(`Deep_Well_Turbine Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
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
      //     for (const meterId of WindingMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //  WindingMap[key] += consumption;

      //   // console.log(`Winding Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }

      ///.... Bypass(firstDoc & lastDoc direct values, no .CONS) ---
      //     for (const meterId of BypassMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //  BypassMap[key] += consumption;

      //   // console.log(`Bypass Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }

      ///.... Packing(firstDoc & lastDoc direct values, no .CONS) ---
      //   for (const meterId of PackingMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //  PackingMap[key] += consumption;

      //   // console.log(`Packing Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }

      ///.... Lab_and_Offices(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of Lab_and_OfficesMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        Lab_and_OfficesMap[key] += consumption;

        // console.log(`Lab_and_Offices Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }

      ///.... FrameFinisher(firstDoc & lastDoc direct values, no .CONS) ---
      //   for (const meterId of FrameFinisherMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //   FrameFinisherMap[key] += consumption;

      //   // console.log(`FrameFinisher Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }


      ///.... ACPlant(firstDoc & lastDoc direct values, no .CONS) ---
      //   for (const meterId of ACPlantMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //   ACPlantMap[key] += consumption;

      //   // console.log(`ACPlant Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }


      ///.... Fiberdeposit(firstDoc & lastDoc direct values, no .CONS) ---
      //   for (const meterId of FiberdepositMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //   FiberdepositMap[key] += consumption;

      //   // console.log(`Fiberdeposit Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }

      ///.... Yarn(firstDoc & lastDoc direct values, no .CONS) ---
      //   for (const meterId of YarnMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //   YarnMap[key] += consumption;

      //   // console.log(`Yarn Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }

      // /.... WaterChiller(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of WaterChillerMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        WaterChillerMap[key] += consumption;

        // console.log(`WaterChiller Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }


      ///.... HFO2ndSource(firstDoc & lastDoc direct values, no .CONS) ---
      //   for (const meterId of HFO2ndSourceMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //   HFO2ndSourceMap[key] += consumption;

      //   // console.log(`HFO2ndSource Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }

      ///.... Mills_Lighting(firstDoc & lastDoc direct values, no .CONS) ---
      for (const meterId of Mills_LightingMapping[key] || []) {
        const meterKey = `${meterId}_${suffix}`;
        const startVal = this.sanitizeValue(firstDoc[meterKey]);
        const endVal = this.sanitizeValue(lastDoc[meterKey]);
        const consumption = this.sanitizeValue(endVal - startVal);
        Mills_LightingMap[key] += consumption;

        // console.log(`Mills_Lighting Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      }
      ///.... AuxUnit5(firstDoc & lastDoc direct values, no .CONS) ---
      //   for (const meterId of AuxUnit5Mapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //   AuxUnit5Map[key] += consumption;

      //   // console.log(`AuxUnit5 Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }

      //     for (const meterId of  CapacitorbankMapping[key] || []) {
      //   const meterKey = `${meterId}_${suffix}`;
      //   const startVal = this.sanitizeValue(firstDoc[meterKey]);
      //   const endVal = this.sanitizeValue(lastDoc[meterKey]);
      //   const consumption = this.sanitizeValue(endVal - startVal);
      //    CapacitorbankMap[key] += consumption;

      //   console.log(`AuxUnit5 Meter: ${meterKey} | Start: ${startVal} | End: ${endVal} | Consumption: ${consumption}`);
      // }
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
      result[`${areaKey.toLowerCase()}BlowRoom_consumption`] = +BlowRoomMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Card_Breaker_consumption`] = +Card_BreakerMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Carding_consumption`] = +CardingMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Comberandunilap_consumption`] = +ComberandunilapMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}DrawingFinisherand2Breaker_consumption`] = +DrawingFinisherand2BreakerMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}DrawingFinisher1to8Breaker_consumption`] = +DrawingFinisher1to8BreakerMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}DrawingSimplex_consumption`] = +DrawingSimplexMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}DrawingSimplex_Breaker_consumption`] = +DrawingSimplex_BreakerMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}RTransportSystem_consumption`] = +RTransportSystemMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Ring_consumption`] = +RingMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}AutoCone_Winding10to18_consumption`] = +AutoCone_Winding10to18Map[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}B_CardandComberFilter_consumption`] = +B_CardandComberFilterMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}AC_BackProcess_consumption`] = +AC_BackProcessMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}AC_Ring_consumption`] = +AC_RingMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}AC_AutoCone_Winding_consumption`] = +AC_AutoCone_WindingMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}AirCompressor_consumption`] = +AirCompressorMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Deep_Well_Turbine_consumption`] = +Deep_Well_TurbineMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}BailingPress_consumption`] = +BailingPressMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Mills_Lighting_consumption`] = +Mills_LightingMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Residentialcolony_consumption`] = +ResidentialcolonyMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Conditioning_Machine_consumption`] = +Conditioning_MachineMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Workshop_consumption`] = +WorkshopMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Lab_and_Offices_consumption`] = +Lab_and_OfficesMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Power_House2ndSourceHFO_consumption`] = +Power_House2ndSourceHFOMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Power_House2ndSourceGas_consumption`] = +Power_House2ndSourceGasMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}WaterChiller_consumption`] = +WaterChillerMap[areaKey].toFixed(2);
      result[`${areaKey.toLowerCase()}Spare_consumption`] = +SpareMap[areaKey].toFixed(2);

      // result[`${areaKey.toLowerCase()}Simplex_consumption`] = +SimplexMap[areaKey].toFixed(2);


      // result[`${areaKey.toLowerCase()}Winding_consumption`] = +WindingMap[areaKey].toFixed(2);
      // result[`${areaKey.toLowerCase()}Bypass_consumption`] = +BypassMap[areaKey].toFixed(2);
      // result[`${areaKey.toLowerCase()}Packing_consumption`] = +PackingMap[areaKey].toFixed(2);
      // result[`${areaKey.toLowerCase()}FrameFinisher_consumption`] = +FrameFinisherMap[areaKey].toFixed(2);
      // result[`${areaKey.toLowerCase()}ACPlant_consumption`] = +ACPlantMap[areaKey].toFixed(2);
      // result[`${areaKey.toLowerCase()}Fiberdeposit_consumption`] = +FiberdepositMap[areaKey].toFixed(2);
      // result[`${areaKey.toLowerCase()}Yarn_consumption`] = +YarnMap[areaKey].toFixed(2);
      // result[`${areaKey.toLowerCase()}HFO2ndSource_consumption`] = +HFO2ndSourceMap[areaKey].toFixed(2);
      // result[`${areaKey.toLowerCase()}AuxUnit5_consumption`] = +AuxUnit5Map[areaKey].toFixed(2);
      // result[`${areaKey.toLowerCase()}Capacitorbank_consumption`] = +CapacitorbankMap[areaKey].toFixed(2);

    }

    return [result];
  }



}
