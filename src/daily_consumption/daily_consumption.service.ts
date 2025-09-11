import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Historical } from './schemas/historical.schema';
import { ConsumptionDto } from './dto/consumption.dto';
import * as moment from 'moment-timezone';

@Injectable()
export class DailyConsumptionService {
  constructor(
    @InjectModel(Historical.name, 'surajcotton')
    private historicalModel: Model<Historical>,
  ) {}

  // 🔹 Department wise meters (Energy + Power + PowerFactor + Voltage tags)
  private departmentMeters: Record<
    string,
    { energy: string; power: string; powerFactor: string; voltage: string }[]
  > = {
    Ring: [
      {
        energy: 'U10_PLC_Del_ActiveEnergy',
        power: 'U10_PLC_ActivePower_Total',
        powerFactor: 'U10_PLC_PowerFactor_Avg',
        voltage: 'U10_PLC_Voltage_Avg',
      },
      {
        energy: 'U11_PLC_Del_ActiveEnergy',
        power: 'U11_PLC_ActivePower_Total',
        powerFactor: 'U11_PLC_PowerFactor_Avg',
        voltage: 'U11_PLC_Voltage_Avg',
      },
      {
        energy: 'U12_PLC_Del_ActiveEnergy',
        power: 'U12_PLC_ActivePower_Total',
        powerFactor: 'U12_PLC_PowerFactor_Avg',
        voltage: 'U12_PLC_Voltage_Avg',
      },
    ],

    // 🔹 New Department: AC Ring
    'AC_Ring': [
      {
        energy: 'U17_PLC_Del_ActiveEnergy',
        power: 'U17_PLC_ActivePower_Total',
        powerFactor: 'U17_PLC_PowerFactor_Avg',
        voltage: 'U17_PLC_Voltage_Avg',
      },
      {
        energy: 'U18_PLC_Del_ActiveEnergy',
        power: 'U18_PLC_ActivePower_Total',
        powerFactor: 'U18_PLC_PowerFactor_Avg',
        voltage: 'U18_PLC_Voltage_Avg',
      },
    ],
  // 🔹 New Department: Deep Velve Turbine 
    'Deep_Velve_Turbine': [
      {
        energy: 'U6_PLC_Del_ActiveEnergy',
        power: 'U6_PLC_ActivePower_Total',
        powerFactor: 'U6_PLC_PowerFactor_Avg',
        voltage: 'U6_PLC_Voltage_Avg',
      },
    
    ],
  };

 async calculateConsumption(dto: ConsumptionDto) {
  const { department, startDate, endDate, startTime, endTime } = dto;

  let startISO: string;
  let endISO: string;

  if (startTime && endTime) {
    // ✅ User defined time range
    startISO = `${startDate}T${startTime}:00.000+05:00`;
    endISO = `${endDate}T${endTime}:59.999+05:00`;
  } else {
    // ✅ Default: 6am to next day 6am
    startISO = `${startDate}T06:00:00.000+05:00`;
    const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');
    endISO = `${nextDay}T06:00:00.000+05:00`;
  }

  console.log('📌 Querying range:', startISO, '->', endISO);

  // ✅ Agar "all" bheja ho to sari departments ko iterate karenge
  const departmentsToProcess =
    department === 'all' ? Object.keys(this.departmentMeters) : [department];

  const finalResults: any = {};

  for (const dept of departmentsToProcess) {
    const meters = this.departmentMeters[dept];
    if (!meters) {
      finalResults[dept] = { message: `⚠️ Department ${dept} not configured` };
      continue;
    }

    const results: any[] = [];

    for (const { energy, power, powerFactor, voltage } of meters) {
      // ---------- Consumption Calculation ----------
      const firstDoc = await this.historicalModel
        .findOne({ [energy]: { $exists: true }, timestamp: { $gte: startISO } })
        .sort({ timestamp: 1 })
        .lean();

      const lastDoc = await this.historicalModel
        .findOne({ [energy]: { $exists: true }, timestamp: { $lte: endISO } })
        .sort({ timestamp: -1 })
        .lean();

      let consumption = 0;
      if (firstDoc && lastDoc) {
        consumption = parseFloat(
          ((lastDoc[energy] || 0) - (firstDoc[energy] || 0)).toFixed(2),
        );
      }

      // ---------- Average Power ----------
       const powerProjection: any = {};
      powerProjection[power] = 1;

      const powerDocs = await this.historicalModel
        .find(
          { [power]: { $exists: true }, timestamp: { $gte: startISO, $lte: endISO } },
          powerProjection,
        )
        .lean();

      let avgPower = 0;
      if (powerDocs.length > 0) {
        const totalPower = powerDocs.reduce((sum, d) => sum + (d[power] || 0), 0);
        avgPower = parseFloat((totalPower / powerDocs.length).toFixed(2));
      }

      // ---------- Average PowerFactor ----------
   const pfProjection: any = {};
      pfProjection[powerFactor] = 1;

      const pfDocs = await this.historicalModel
        .find(
          { [powerFactor]: { $exists: true }, timestamp: { $gte: startISO, $lte: endISO } },
          pfProjection,
        )
        .lean();

      let avgPF = 0;
      if (pfDocs.length > 0) {
        const totalPF = pfDocs.reduce((sum, d) => sum + (d[powerFactor] || 0), 0);
        avgPF = parseFloat((totalPF / pfDocs.length).toFixed(2));
      }


      // ---------- Average Voltage ----------
      const voltProjection: any = {};
      voltProjection[voltage] = 1;

      const voltDocs = await this.historicalModel
        .find(
          { [voltage]: { $exists: true }, timestamp: { $gte: startISO, $lte: endISO } },
          voltProjection,
        )
        .lean();

      let avgVoltage = 0;
      if (voltDocs.length > 0) {
        const totalVolt = voltDocs.reduce((sum, d) => sum + (d[voltage] || 0), 0);
        avgVoltage = parseFloat((totalVolt / voltDocs.length).toFixed(2));
      }

      // ---------- Push formatted response ----------
      const baseName = energy.replace('_Del_ActiveEnergy', '');
      results.push({
        [`${baseName}_energy_consumption`]: consumption,
        [`${baseName}_avgPower`]: avgPower,
        [`${baseName}_avgPowerFactor`]: avgPF,
        [`${baseName}_avgVoltage`]: avgVoltage,
      });
    }

    // ✅ Har department ka result alag object me save hoga
    finalResults[dept] = {
      startISO,
      endISO,
      meters: results,
    };
  }

  return finalResults;
}

}
