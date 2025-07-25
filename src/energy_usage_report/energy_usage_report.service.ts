import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GetEnergyCostDto } from './dto/get-energy-usage_report.dto';
import { Energyusagereport } from './schemas/energy-usage_report.schema';
import { DailyProduction } from './schemas/daily-production.schema';
import * as moment from 'moment-timezone';

@Injectable()
export class EnergyUsageReportService {
  constructor(
    @InjectModel(Energyusagereport.name, 'surajcotton') private costModel: Model<Energyusagereport>,
    @InjectModel(DailyProduction.name, 'surajcotton') private dailyModel: Model<DailyProduction>,
  ) {}
  private sanitizeValue(value: number): number {
    if (!isFinite(value) || isNaN(value)) return 0;
    const minThreshold = 1e-6;
    const maxThreshold = 1e+12;
    if (Math.abs(value) < minThreshold || Math.abs(value) > maxThreshold) {
      return 0;
    }
    return value;
  }

async getConsumptionData(dto: GetEnergyCostDto) {
  const { start_date, end_date, suffixes, area } = dto;
  const suffix = suffixes?.[0] || 'Del_ActiveEnergy';

  const blowRoomMapping: Record<string, string[]> = {
    Unit_4: ['U8_GW01','U14_GW01', 'U5_GW01'],
    Unit_5: ['U12_GW02'],
  };

  const cardMapping: Record<string, string[]> = {
    Unit_4: ['U5_GW01', 'U9_GW01'],
    Unit_5: ['U3_GW02','U1_GW02', 'U2_GW02', 'U19_GW02', 'U17_GW02', 'U11_GW02'],
  };
   const comberMapping: Record<string, string[]> = {
    Unit_4: ['U13_PLC'],
    Unit_5: ['U6_GW03', 'U4_GW02'],
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
  };
   const RingMapping: Record<string, string[]> = {
    Unit_4: ['U10_PLC', 'U11_PLC', 'U12_PLC', 'U17_PLC', 'U15_GW01', 'U17_GW01', 'U16_GW01'],
    Unit_5: ['U10_GW02', 'U7_GW02', 'U1_GW03','U5_GW03', 'U9_GW03', 'U12_GW03'],
  };
  const AutoConeMapping: Record<string, string[]> = {
    Unit_5: ['U18_GW02', 'U10_GW03', 'U23_GW03', 'U22_GW03'],
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
    Unit_4: ['U2_GW01']
    
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
    Unit_4: ['U5_PLC']
    
  };
  const LightningMapping: Record<string, string[]> = {
    Unit_4: ['U4_PLC', 'U3_PLC']
  };
   const AuxUnit5Mapping: Record<string, string[]> = {
    Unit_4: ['U2_PLC']
  };

  const startISO = moment.tz(start_date, 'YYYY-MM-DD', 'Asia/Karachi').startOf('day').toISOString(true);
  const endISO = moment.tz(end_date, 'YYYY-MM-DD', 'Asia/Karachi').endOf('day').toISOString(true);

  const areaKeys = area === 'ALL' ? ['Unit_4', 'Unit_5'] : [area];

  const blowRoomMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const cardMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const comberMap: Record<string, number> = { Unit_4: 0, Unit_5: 0 };
  const DrawingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const SimplexMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const RTransportSystemMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const RingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const AutoConeMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const AirCompressorMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const TurbineMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const BailingPressMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const ResidentialcolonyMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const SpareMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const WindingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const BypassMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const PackingMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const LabMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const FrameFinisherMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const ACPlantMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const FiberdepositMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const YarnMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const WaterChillerMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const HFO2ndSourceMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const LightningMap: Record<string, number> = { Unit_4: 0, Unit_5: 0};
  const AuxUnit5Map: Record<string, number> = { Unit_4: 0, Unit_5: 0};



  const [docs] = await this.costModel.aggregate([
    {
      $match: {
        timestamp: { $gte: startISO, $lte: endISO },
      },
    },
    { $sort: { timestamp: 1 } },
    {
      $group: {
        _id: null,
        first: { $first: '$$ROOT' },
        last: { $last: '$$ROOT' },
      },
    },
  ]);

  const firstDoc = docs?.first;
  const lastDoc = docs?.last;

  if (!firstDoc || !lastDoc) {
    const result = {
      date: start_date,
      startTimestamp: null,
      endTimestamp: null,
    };

    if (area === 'ALL') {
      return [
        {
          ...result,
          unit_4blowroom_consumption: 0,
          unit_5blowroom_consumption: 0,
          unit_4card_consumption: 0,
          unit_5card_consumption: 0,
          unit_4comber_consumption: 0,
          unit_5comber_consumption: 0,
          unit_4Drawing_consumption: 0,
          unit_4Simplex_consumption: 0,
          unit_5Simplex_consumption: 0,
          unit_5RTransportSystem_consumption: 0,
          unit_4Ring_consumption: 0,
          unit_5Ring_consumption: 0,
          unit_4AutoCone_consumption: 0,
          unit_5AutoCone_consumption: 0,
          unit_4AirCompressor_consumption: 0,
          unit_5AirCompressor_consumption: 0,
          unit_4Turbine_consumption: 0,
          unit_5Turbine_consumption: 0,
          unit_4BailingPress_consumption: 0,
          unit_5BailingPress_consumption: 0,
          unit_4Residentialcolony_consumption: 0,
          unit_5Residentialcolony_consumption: 0,
          unit_4Spare_consumption: 0,
          unit_5Spare_consumption: 0,
          unit_4Winding_consumption: 0,
          unit_5Winding_consumption: 0,
          unit_4Bypass_consumption: 0,
          unit_5Bypass_consumption: 0,
          unit_4Packing_consumption: 0,
          unit_5Packing_consumption: 0,
          unit_4Lab_consumption: 0,
          unit_5Lab_consumption: 0,
          unit_4FrameFinisher_consumption: 0,
          unit_5FrameFinisher_consumption: 0,
          unit_4ACPlant_consumption: 0,
          unit_5ACPlantFinisher_consumption: 0,
          unit_4Fiberdeposit_consumption: 0,
          unit_5Fiberdeposit_consumption: 0,
          unit_4Yarn_consumption: 0,
          unit_5Yarn_consumption: 0,
          unit_4WaterChiller_consumption: 0,
          unit_5WaterChiller_consumption: 0,
          unit_4HFO2ndSource_consumption: 0,
          unit_5HFO2ndSource_consumption: 0,
          unit_4Lightning_consumption: 0,
          unit_5Lightning_consumption: 0,
          unit_4AuxUnit5_consumption: 0,
          unit_5AuxUnit5_consumption: 0,
 
        },
      ];
    } else {
      return [
        {
          ...result,
          [`${area.toLowerCase()}blowroom_consumption`]: 0,
          [`${area.toLowerCase()}card_consumption`]: 0,
          [`${area.toLowerCase()}comber_consumption`]: 0,
          [`${area.toLowerCase()}Drawing_consumption`]: 0,
          [`${area.toLowerCase()}Simplex_consumption`]: 0,
          [`${area.toLowerCase()}RTransportSystem_consumption`]: 0,
          [`${area.toLowerCase()}Ring_consumption`]: 0,
          [`${area.toLowerCase()}AutoCone_consumption`]: 0,
          [`${area.toLowerCase()}AirCompressor_consumption`]: 0,
          [`${area.toLowerCase()}Turbine_consumption`]: 0,
          [`${area.toLowerCase()}BailingPress_consumption`]: 0,
          [`${area.toLowerCase()}Residentialcolony_consumption`]: 0,
          [`${area.toLowerCase()}Spare_consumption`]: 0,
          [`${area.toLowerCase()}Winding_consumption`]: 0,
          [`${area.toLowerCase()}Bypass_consumption`]: 0,
          [`${area.toLowerCase()}Packing_consumption`]: 0,
          [`${area.toLowerCase()}Lab_consumption`]: 0,
          [`${area.toLowerCase()}FrameFinisher_consumption`]: 0,
          [`${area.toLowerCase()}ACPlant_consumption`]: 0,
          [`${area.toLowerCase()}Fiberdeposit_consumption`]: 0,
          [`${area.toLowerCase()}Yarn_consumption`]: 0,
          [`${area.toLowerCase()}WaterChiller_consumption`]: 0,
          [`${area.toLowerCase()}HFO2ndSource_consumption`]: 0,
          [`${area.toLowerCase()}Lightning_consumption`]: 0,
          [`${area.toLowerCase()}AuxUnit5_consumption`]: 0,
        },
      ];
    }
  }

  for (const key of areaKeys) {
    // Blow Room
    for (const meterId of blowRoomMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      blowRoomMap[key] += consumption;
    }

    // Card Room
    for (const meterId of cardMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      cardMap[key] += consumption;
    }
     for (const meterId of comberMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      comberMap[key] += consumption;
    }
     for (const meterId of DrawingMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      DrawingMap[key] += consumption;
    }
     for (const meterId of SimplexMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      SimplexMap[key] += consumption;
    }
       for (const meterId of RTransportSystemMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      RTransportSystemMap[key] += consumption;
    }
 
      for (const meterId of RingMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      RingMap[key] += consumption;
    }
      for (const meterId of AutoConeMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      AutoConeMap[key] += consumption;
    }
        for (const meterId of AirCompressorMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      AirCompressorMap[key] += consumption;
    }
       for (const meterId of TurbineMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      TurbineMap[key] += consumption;
    }
        for (const meterId of BailingPressMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      BailingPressMap[key] += consumption;
    }
       for (const meterId of ResidentialcolonyMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      ResidentialcolonyMap[key] += consumption;
    }
     for (const meterId of SpareMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      SpareMap[key] += consumption;
    }
     for (const meterId of WindingMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      WindingMap[key] += consumption;
    }
      for (const meterId of BypassMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      BypassMap[key] += consumption;
    }
        for (const meterId of PackingMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      PackingMap[key] += consumption;
    }
          for (const meterId of LabMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      LabMap[key] += consumption;
    }
             for (const meterId of FrameFinisherMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      FrameFinisherMap[key] += consumption;
    }
      for (const meterId of ACPlantMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      ACPlantMap[key] += consumption;
    }
       for (const meterId of FiberdepositMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      FiberdepositMap[key] += consumption;
    }
      for (const meterId of YarnMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      YarnMap[key] += consumption;
    }
       for (const meterId of WaterChillerMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      WaterChillerMap[key] += consumption;
    }
         for (const meterId of HFO2ndSourceMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      HFO2ndSourceMap[key] += consumption;
    }
      for (const meterId of LightningMapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      LightningMap[key] += consumption;
    }
    for (const meterId of AuxUnit5Mapping[key] || []) {
      const meterKey = `${meterId}_${suffix}`;
      const startVal = this.sanitizeValue(firstDoc[meterKey]);
      const endVal = this.sanitizeValue(lastDoc[meterKey]);
      const consumption = this.sanitizeValue(endVal - startVal);
      AuxUnit5Map[key] += consumption;
    }

  }

  if (area === 'ALL') {
    return [
      {
        date: start_date,
        startTimestamp: firstDoc.timestamp,
        endTimestamp: lastDoc.timestamp,
        unit_4blowroom_consumption: +blowRoomMap.Unit_4.toFixed(2),
        unit_5blowroom_consumption: +blowRoomMap.Unit_5.toFixed(2),
        unit_4card_consumption: +cardMap.Unit_4.toFixed(2),
        unit_5card_consumption: +cardMap.Unit_5.toFixed(2),
        unit_4comber_consumption: +comberMap.Unit_4.toFixed(2),
        unit_5comber_consumption: +comberMap.Unit_5.toFixed(2),
        unit_4Drawing_consumption: +DrawingMap.Unit_4.toFixed(2),
        unit_5Drawing_consumption: +DrawingMap.Unit_5.toFixed(2),
        unit_4Simplex_consumption: +SimplexMap.Unit_5.toFixed(2),
        unit_5Simplex_consumption: +SimplexMap.Unit_5.toFixed(2),
        unit_4RTransportSystem_consumption: +RTransportSystemMap.Unit_4.toFixed(2),
        unit_5RTransportSystem_consumption: +RTransportSystemMap.Unit_5.toFixed(2),
        unit_4Ring_consumption: +RingMap.Unit_4.toFixed(2),
        unit_5Ring_consumption: +RingMap.Unit_5.toFixed(2),
        unit_4AutoCone_consumption: +AutoConeMap.Unit_4.toFixed(2),
        unit_5AutoCone_consumption: +AutoConeMap.Unit_5.toFixed(2),
        unit_4AirCompressor_consumption: +AirCompressorMap.Unit_4.toFixed(2),
        unit_5AirCompressor_consumption: +AirCompressorMap.Unit_5.toFixed(2),
        unit_4Turbine_consumption: +TurbineMap.Unit_4.toFixed(2),
        unit_5Turbine_consumption: +TurbineMap.Unit_5.toFixed(2),
        unit_4BailingPress_consumption: +BailingPressMap.Unit_4.toFixed(2),
        unit_5BailingPress_consumption: +BailingPressMap.Unit_5.toFixed(2),
        unit_4Residentialcolony_consumption: +ResidentialcolonyMap.Unit_4.toFixed(2),
        unit_5Residentialcolony_consumption: +ResidentialcolonyMap.Unit_5.toFixed(2),
        unit_4Spare_consumption: +SpareMap.Unit_4.toFixed(2),
        unit_5Spare_consumption: +SpareMap.Unit_5.toFixed(2),
        unit_4Winding_consumption: +WindingMap.Unit_4.toFixed(2),
        unit_5Winding_consumption: +WindingMap.Unit_5.toFixed(2),
        unit_4Bypass_consumption: +BypassMap.Unit_4.toFixed(2),
        unit_5Bypass_consumption: +BypassMap.Unit_5.toFixed(2), 
        unit_4Packing_consumption: +PackingMap.Unit_4.toFixed(2), 
        unit_5Packing_consumption: +PackingMap.Unit_5.toFixed(2), 
        unit_4Lab_consumption: +LabMap.Unit_4.toFixed(2), 
        unit_5Lab_consumption: +LabMap.Unit_5.toFixed(2), 
        unit_4FrameFinisher_consumption: +FrameFinisherMap.Unit_4.toFixed(2), 
        unit_5FrameFinisher_consumption: +FrameFinisherMap.Unit_5.toFixed(2), 
        unit_4ACPlant_consumption: +ACPlantMap.Unit_4.toFixed(2), 
        unit_5ACPlant_consumption: +ACPlantMap.Unit_5.toFixed(2),
        unit_4Fiberdeposit_consumption: +FiberdepositMap.Unit_5.toFixed(2), 
        unit_5Fiberdeposit_consumption: +FiberdepositMap.Unit_5.toFixed(2), 
        unit_4Yarn_consumption: +YarnMap.Unit_4.toFixed(2), 
        unit_5Yarn_consumption: +YarnMap.Unit_5.toFixed(2), 
        unit_4WaterChiller_consumption: +WaterChillerMap.Unit_4.toFixed(2),
        unit_5WaterChiller_consumption: +WaterChillerMap.Unit_5.toFixed(2),
        unit_4HFO2ndSource_consumption: +HFO2ndSourceMap.Unit_4.toFixed(2), 
        unit_5HFO2ndSource_consumption: +HFO2ndSourceMap.Unit_5.toFixed(2), 
        unit_4Lightning_consumption: +LightningMap.Unit_4.toFixed(2), 
        unit_5Lightning_consumption: +LightningMap.Unit_5.toFixed(2),
        unit_4AuxUnit5_consumption: +AuxUnit5Map.Unit_4.toFixed(2), 
        unit_5AuxUnit5_consumption: +AuxUnit5Map.Unit_5.toFixed(2), 
      },
    ];
  } else {
    return [
      {
        date: start_date,
        startTimestamp: firstDoc.timestamp,
        endTimestamp: lastDoc.timestamp,
        [`${area.toLowerCase()}blowroom_consumption`]: +blowRoomMap[area].toFixed(2),
        [`${area.toLowerCase()}card_consumption`]: +cardMap[area].toFixed(2),
        [`${area.toLowerCase()}comber_consumption`]: +comberMap[area].toFixed(2),
        [`${area.toLowerCase()}Drawing_consumption`]: +DrawingMap[area].toFixed(2),
        [`${area.toLowerCase()}Simplex_consumption`]: +SimplexMap[area].toFixed(2),
        [`${area.toLowerCase()}RTransportSystem_consumption`]: +RTransportSystemMap[area].toFixed(2),
        [`${area.toLowerCase()}Ring_consumption`]: +RingMap[area].toFixed(2),
        [`${area.toLowerCase()}AutoCone_consumption`]: +AutoConeMap[area].toFixed(2), 
        [`${area.toLowerCase()}AirCompressor_consumption`]: +AirCompressorMap[area].toFixed(2),
        [`${area.toLowerCase()}Turbine_consumption`]: +TurbineMap[area].toFixed(2),
        [`${area.toLowerCase()}BailingPress_consumption`]: +BailingPressMap[area].toFixed(2),
        [`${area.toLowerCase()}Residentialcolony_consumption`]: +ResidentialcolonyMap[area].toFixed(2),
        [`${area.toLowerCase()}Spare_consumption`]: +SpareMap[area].toFixed(2),
        [`${area.toLowerCase()}Winding_consumption`]: +WindingMap[area].toFixed(2),
        [`${area.toLowerCase()}Bypass_consumption`]: +BypassMap[area].toFixed(2),
        [`${area.toLowerCase()}Packing_consumption`]: +PackingMap[area].toFixed(2),
        [`${area.toLowerCase()}Lab_consumption`]: +LabMap[area].toFixed(2),
        [`${area.toLowerCase()}FrameFinisher_consumption`]: +FrameFinisherMap[area].toFixed(2),
        [`${area.toLowerCase()}ACPlant_consumption`]: +ACPlantMap[area].toFixed(2),
        [`${area.toLowerCase()}Fiberdeposit_consumption`]: +FiberdepositMap[area].toFixed(2),
        [`${area.toLowerCase()}Yarn_consumption`]: +YarnMap[area].toFixed(2),
        [`${area.toLowerCase()}WaterChiller_consumption`]: +WaterChillerMap[area].toFixed(2),
        [`${area.toLowerCase()}HFO2ndSource_consumption`]: +HFO2ndSourceMap[area].toFixed(2),
        [`${area.toLowerCase()}Lightning_consumption`]: +LightningMap[area].toFixed(2),
        [`${area.toLowerCase()}AuxUnit5_consumption`]: +AuxUnit5Map[area].toFixed(2),
      },
    ];
  }
}







}
