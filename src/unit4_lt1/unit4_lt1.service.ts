import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { Unit4LT1 } from './schemas/unit4_LT1.schema';
import { MeterService } from 'src/meter/meter.service';

@Injectable()
export class Unit4LT1Service {
  constructor(
    @InjectModel(Unit4LT1.name, 'surajcotton')
    private readonly unitModel: Model<Unit4LT1>,
    private readonly meterService: MeterService,
  ) {}

  async getSankeyData(payload: { startDate: string; endDate: string; startTime?: string; endTime?: string }) {
    const TZ = 'Asia/Karachi';
    let startISO: string;
    let endISO: string;

    // ---------------- Determine start & end ISO ----------------
    if (payload.startTime && payload.endTime) {
      const startMoment = moment
        .tz(`${payload.startDate} ${payload.startTime}`, 'YYYY-MM-DD HH:mm', TZ)
        .startOf('minute')
        .toDate();
      const endMoment = moment
        .tz(`${payload.endDate} ${payload.endTime}`, 'YYYY-MM-DD HH:mm', TZ)
        .endOf('minute')
        .toDate();

      startISO = startMoment.toISOString();
      endISO = endMoment.toISOString();
    } else {
      // Default 6AM → 6AM next day
      startISO = `${payload.startDate}T06:00:00.000+05:00`;
      const nextDay = moment(payload.endDate).add(1, 'day').format('YYYY-MM-DD');
      endISO = `${nextDay}T06:00:59.999+05:00`;
    }

    console.log('📌 Start ISO:', startISO);
    console.log('📌 End ISO:', endISO);

    // -------------------- Fetch PDB07 (from MeterService) ---------------------
    const fmCons = await this.meterService.getMeterWiseConsumption(
      payload.startDate,
      payload.endDate,
      { startTime: payload.startTime, endTime: payload.endTime },
    );

    const PDB07_U4 = +(Number(fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0).toFixed(2));

    // ---------------- Meter setup ----------------
    const meterMap: Record<string, string> = {
      U1_PLC: 'Transport',
      U2_PLC: 'Unit 05 Lighting',
      U3_PLC: 'Light Outside',
      U4_PLC: 'Light Inside',
      U5_PLC: 'Power House (2nd Source Gas)',
      U6_PLC: 'Turbine',
      U8_PLC: 'Drawing Finisher 1~6+2 Breaker',
      U9_PLC: 'Winding 7~9',
      U10_PLC: 'Ring 1~4',
      U11_PLC: 'Ring 16~20',
      U12_PLC: 'Ring 21~24',
      U13_PLC: 'Comber 1~10+ Uni Lap 1-2',
      U14_PLC: 'Compressor 119kw',
      U15_PLC: 'Simplex 1~6',
      U16_PLC: 'Compressor 303kw',
      U17_PLC: 'Ring AC',
      U20_PLC: 'Compressor 119kw',
    };

    const meterFields = [
      'U21_PLC_Del_ActiveEnergy', // TF1 (Wapda+HFO+JMS)
      'U19_PLC_Del_ActiveEnergy', // LT Gen (Diesel+JGS)
      ...Object.keys(meterMap).map((m) => `${m}_Del_ActiveEnergy`),
    ];

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

    // ---------------- Calculate consumption totals ----------------
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

    // ---------------- Adjust Ring 21~24 (subtract PDB07) ----------------
    const ring2124Raw = +(Number(consumptionTotals['U12_PLC_Del_ActiveEnergy'] || 0).toFixed(2));
    const ring2124Adj = Math.max(0, +(ring2124Raw - PDB07_U4).toFixed(2));

    // ---------------- Prepare Sankey Data ----------------
    const tf1 = +consumptionTotals['U21_PLC_Del_ActiveEnergy'].toFixed(2); // Wapda+HFO+JMS
    const ltGen = +consumptionTotals['U19_PLC_Del_ActiveEnergy'].toFixed(2); // Diesel+JGS

    const totalGeneration = tf1 + ltGen;
     console.log(totalGeneration);

    // total consumption (sum of all meters except generation)
    let totalConsumption = 0;
    Object.keys(meterMap).forEach((m) => {
      const key = `${m}_Del_ActiveEnergy`;
      const val = +(Number(consumptionTotals[key] || 0).toFixed(2));
      totalConsumption += m === 'U12_PLC' ? ring2124Adj : val;
    });
     totalConsumption += PDB07_U4;
    console.log(totalConsumption);

    // compute unaccounted energy
    const unaccountedEnergy = +(totalGeneration - totalConsumption).toFixed(2);

    // ---------------- Construct Sankey Data ----------------
    const sankeyData = [
      { from: 'Wapda+HFO+JMS Incoming', to: 'TotalLT1', value: tf1 },
      { from: 'Diesel+JGS Incomming', to: 'TotalLT1', value: ltGen },
      ...Object.entries(meterMap).map(([meter, label]) => {
        const key = `${meter}_Del_ActiveEnergy`;
        const baseVal = +(Number(consumptionTotals[key] || 0).toFixed(2));
        const value = meter === 'U12_PLC' ? ring2124Adj : baseVal;
        return { from: 'TotalLT1', to: label, value };
      }),
      {
        from: 'TotalLT1',
        to: 'PDB07->To U5LT1(AutoCone1-9)',
        value: Math.max(0, +PDB07_U4.toFixed(2)),
      },
      {
        from: 'TotalLT1',
        to: 'Unaccounted Energy',
        value: unaccountedEnergy,
      },
    ];

    return sankeyData;
  }
}
