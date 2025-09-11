import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { Historical } from './schemas/historical.schema';
import { ConsumptionDto } from './dto/consumption.dto';

@Injectable()
export class DailyConsumptionService {
  constructor(
    @InjectModel(Historical.name, 'surajcotton')
    private historicalModel: Model<Historical>,
  ) {}

  private metersConfig = [
    {
      energy: 'U10_PLC_Del_ActiveEnergy',
      power: 'U10_PLC_ActivePower_Total',
      powerFactor: 'U10_PLC_PowerFactor_Avg',
      voltage: 'U10_PLC_Voltage_Avg',
      metername: 'Ring Db 01',
      deptname: 'Ring',
      MCS: '24',
      installedLoad: '80',
    },
    {
      energy: 'U11_PLC_Del_ActiveEnergy',
      power: 'U11_PLC_ActivePower_Total',
      powerFactor: 'U11_PLC_PowerFactor_Avg',
      voltage: 'U11_PLC_Voltage_Avg',
      metername: 'Ring Db 02',
      deptname: 'Ring',
      MCS: '24',
      installedLoad: '80',
    },
    {
      energy: 'U12_PLC_Del_ActiveEnergy',
      power: 'U12_PLC_ActivePower_Total',
      powerFactor: 'U12_PLC_PowerFactor_Avg',
      voltage: 'U12_PLC_Voltage_Avg',
      metername: 'Ring Db 03',
      deptname: 'Ring',
      MCS: '24',
      installedLoad: '80',
    },
    {
      energy: 'U17_PLC_Del_ActiveEnergy',
      power: 'U17_PLC_ActivePower_Total',
      powerFactor: 'U17_PLC_PowerFactor_Avg',
      voltage: 'U17_PLC_Voltage_Avg',
      metername: 'AC_Ring Db 01',
      deptname: 'AC_Ring',
      MCS: '0',
      installedLoad: '347.5',
    },
    {
      energy: 'U18_PLC_Del_ActiveEnergy',
      power: 'U18_PLC_ActivePower_Total',
      powerFactor: 'U18_PLC_PowerFactor_Avg',
      voltage: 'U18_PLC_Voltage_Avg',
      metername: 'AC_Ring Db 02',
      deptname: 'AC_Ring',
      MCS: '0',
      installedLoad: '347.5',
    },
    {
      energy: 'U6_PLC_Del_ActiveEnergy',
      power: 'U6_PLC_ActivePower_Total',
      powerFactor: 'U6_PLC_PowerFactor_Avg',
      voltage: 'U6_PLC_Voltage_Avg',
      metername: 'Deep Velve Turbine',
      deptname: 'Turbine',
      MCS: '1',
      installedLoad: '22',
    },
  ];

 async calculateConsumption(dto: ConsumptionDto) {
  const { startDate, endDate, startTime, endTime } = dto;

  let startISO: string;
  let endISO: string;

  if (startTime && endTime) {
    startISO = `${startDate}T${startTime}:00.000+05:00`;
    endISO = `${endDate}T${endTime}:59.999+05:00`;
  } else {
    startISO = `${startDate}T06:00:00.000+05:00`;
    const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');
    endISO = `${nextDay}T06:00:00.000+05:00`;
  }

  console.log('📌 Querying range:', startISO, '->', endISO);

  const meters: any[] = [];

  for (const meter of this.metersConfig) {
    const { energy, power, powerFactor, voltage, metername, deptname, MCS, installedLoad } = meter;

    console.log(`\n🔎 Processing meter: ${metername} (${energy})`);

    // ---------- Energy ----------
    const firstDoc = await this.historicalModel.findOne({
      [energy]: { $exists: true },
      $expr: {
        $gte: [
          { $dateFromString: { dateString: "$timestamp" } },
          { $dateFromString: { dateString: startISO } }
        ]
      }
    })
      .sort({ timestamp: 1 })
      .lean();

    const lastDoc = await this.historicalModel.findOne({
      [energy]: { $exists: true },
      $expr: {
        $lte: [
          { $dateFromString: { dateString: "$timestamp" } },
          { $dateFromString: { dateString: endISO } }
        ]
      }
    })
      .sort({ timestamp: -1 })
      .lean();

    console.log('   ➡️ firstDoc:', firstDoc?.timestamp, firstDoc?.[energy]);
    console.log('   ➡️ lastDoc :', lastDoc?.timestamp, lastDoc?.[energy]);

    let consumption = 0;
    if (firstDoc && lastDoc) {
      consumption = parseFloat(
        ((lastDoc[energy] || 0) - (firstDoc[energy] || 0)).toFixed(2),
      );
    }

    // ---------- Avg Power ----------
    const powerDocs = await this.historicalModel.find(
      {
        [power]: { $exists: true },
        $expr: {
          $and: [
            {
              $gte: [
                { $dateFromString: { dateString: "$timestamp" } },
                { $dateFromString: { dateString: startISO } }
              ]
            },
            {
              $lte: [
                { $dateFromString: { dateString: "$timestamp" } },
                { $dateFromString: { dateString: endISO } }
              ]
            }
          ]
        }
      },
      { [power]: 1, timestamp: 1 } as any
    ).lean();

    console.log(`   ⚡ powerDocs count: ${powerDocs.length}`);

    let avgPower = 0;
    if (powerDocs.length) {
      const total = powerDocs.reduce((sum, d) => sum + (d[power] || 0), 0);
      avgPower = parseFloat((total / powerDocs.length).toFixed(2));
    }

    // ---------- Avg PF ----------
    const pfDocs = await this.historicalModel.find(
      {
        [powerFactor]: { $exists: true },
        $expr: {
          $and: [
            {
              $gte: [
                { $dateFromString: { dateString: "$timestamp" } },
                { $dateFromString: { dateString: startISO } }
              ]
            },
            {
              $lte: [
                { $dateFromString: { dateString: "$timestamp" } },
                { $dateFromString: { dateString: endISO } }
              ]
            }
          ]
        }
      },
      { [powerFactor]: 1, timestamp: 1 } as any
    ).lean();

    console.log(`   📐 pfDocs count: ${pfDocs.length}`);

    let avgPF = 0;
    if (pfDocs.length) {
      const total = pfDocs.reduce((sum, d) => sum + (d[powerFactor] || 0), 0);
      avgPF = parseFloat((total / pfDocs.length).toFixed(2));
    }

    // ---------- Avg Voltage ----------
    const voltDocs = await this.historicalModel.find(
      {
        [voltage]: { $exists: true },
        $expr: {
          $and: [
            {
              $gte: [
                { $dateFromString: { dateString: "$timestamp" } },
                { $dateFromString: { dateString: startISO } }
              ]
            },
            {
              $lte: [
                { $dateFromString: { dateString: "$timestamp" } },
                { $dateFromString: { dateString: endISO } }
              ]
            }
          ]
        }
      },
      { [voltage]: 1, timestamp: 1 } as any
    ).lean();

    console.log(`   🔌 voltDocs count: ${voltDocs.length}`);

    let avgVoltage = 0;
    if (voltDocs.length) {
      const total = voltDocs.reduce((sum, d) => sum + (d[voltage] || 0), 0);
      avgVoltage = parseFloat((total / voltDocs.length).toFixed(2));
    }

    const baseName = energy.replace('_Del_ActiveEnergy', '');
    meters.push({
      [`${baseName}_energy_consumption`]: consumption,
      [`${baseName}_avgPower`]: avgPower,
      [`${baseName}_avgPowerFactor`]: avgPF,
      [`${baseName}_avgVoltage`]: avgVoltage,
      metername,
      deptname,
      MCS,
      installedLoad,
    });

    console.log(`✅ Result for ${metername}:`, meters[meters.length - 1]);
  }

  return {
    startISO,
    endISO,
    meters,
  };
}


}
