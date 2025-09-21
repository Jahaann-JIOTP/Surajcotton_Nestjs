import * as moment from 'moment-timezone';
import { Model } from 'mongoose';
import { Historical } from './schemas/historical.schema';

// helper functions
function bucket15min(ts: string) {
  const m = moment(ts);
  const minutes = Math.floor(m.minutes() / 15) * 15;
  return m.clone().minutes(minutes).seconds(0).milliseconds(0).toISOString();
}
function generateTimeSlots(startISO: string, endISO: string): string[] {
  const slots: string[] = [];
  let cursor = moment(startISO);
  const end = moment(endISO);
  while (cursor.isBefore(end)) {
    slots.push(cursor.toISOString());
    cursor.add(15, 'minutes');
  }
  return slots;
}
function alignSlots(docs: any[], field: string, slots: string[]) {
  const seen = new Map<string, any>();
  for (const d of docs) {
    const bucket = bucket15min(d.timestamp);
    if (!seen.has(bucket)) seen.set(bucket, d);
  }
  return slots.map(slot => seen.get(slot) || { timestamp: slot, [field]: null });
}

// ✅ Helper: Round huge / invalid numbers to 0
function sanitizeValue(val: number | null): number {
  if (val === null || !Number.isFinite(val) || val > 1e12 || val < -1e12) return 0;
  return val;
}


// ✅ Core function (reusable for LT1 and LT2)
export async function calculateConsumptionCore(
  dto: any,
  metersConfig: any[],
  historicalModel: Model<Historical>,
) {
  const { startDate, endDate, startTime, endTime } = dto;

  let startISO: string;
  let endISO: string;

  if (startTime && endTime) {
    startISO = `${startDate}T${startTime}:00.000+05:00`;
    endISO   = `${endDate}T${endTime}:00.000+05:00`;

    if (moment(endISO).isSameOrBefore(moment(startISO))) {
      endISO = moment(endISO).add(1, 'day').toISOString();
    }
  } else {
    startISO = `${startDate}T06:00:00.000+05:00`;
    const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');
    endISO = `${nextDay}T06:00:00.000+05:00`;
  }

  // console.log('📌 Querying range [start, end):', startISO, '->', endISO);

  const expectedSlots = generateTimeSlots(startISO, endISO);
  // console.log(`📌 Expected slots = ${expectedSlots.length}`);

  const meters: any[] = [];

  for (const meter of metersConfig) {
    const { energy, power, powerFactor, voltage, metername, deptname, MCS, installedLoad } = meter;

    // console.log(`\n================= Meter: ${metername} (${energy}) =================`);

    // Fetch raw docs
    let rawDocs = await historicalModel.find(
      {
        $expr: {
          $and: [
            { $gte: [{ $dateFromString: { dateString: '$timestamp' } }, { $dateFromString: { dateString: startISO } }] },
            { $lt:  [{ $dateFromString: { dateString: '$timestamp' } }, { $dateFromString: { dateString: endISO } }] },
          ],
        },
      },
      { [energy]: 1, [power]: 1, [powerFactor]: 1, [voltage]: 1, timestamp: 1 } as any,
    )
      .sort({ timestamp: 1 })
      .lean();

    // console.log(`   [RawDocs] fetched = ${rawDocs.length}`);

    // Align slots
    const energyDocs = alignSlots(rawDocs, energy, expectedSlots);
    const powerDocs  = alignSlots(rawDocs, power, expectedSlots);
    const pfDocs     = alignSlots(rawDocs, powerFactor, expectedSlots);
    const voltDocs   = alignSlots(rawDocs, voltage, expectedSlots);

    

    // console.log(`   [Aligned] slots = ${energyDocs.length}`);

    // Energy consumption
    const firstDoc = energyDocs.find(d => d[energy] !== null);
    const lastDoc  = [...energyDocs].reverse().find(d => d[energy] !== null);

    let consumption = 0;
    if (firstDoc && lastDoc) {
     consumption = sanitizeValue(parseFloat(((lastDoc[energy] || 0) - (firstDoc[energy] || 0)).toFixed(2)));

      // console.log(`   [Energy] First=${firstDoc[energy]} (${firstDoc.timestamp})`);
      // console.log(`   [Energy] Last =${lastDoc[energy]} (${lastDoc.timestamp})`);
      // console.log(`   [Energy] Consumption = ${consumption}`);
    } else {
      // console.log(`   [Energy] ❌ No data in range`);
    }

    // Avg Power
    const powerVals = powerDocs.map(d => d[power]).filter(v => v !== null);
   const avgPower = sanitizeValue(powerVals.length ? parseFloat((powerVals.reduce((a,b)=>a+b,0)/powerVals.length).toFixed(2)) : 0);
    // console.log(`   [Power] Count=${powerVals.length}, Avg=${avgPower}`);

    // Avg PF
    const pfVals = pfDocs.map(d => d[powerFactor]).filter(v => v !== null);
   const avgPF = sanitizeValue(pfVals.length ? parseFloat((pfVals.reduce((a,b)=>a+b,0)/pfVals.length).toFixed(2)) : 0);
    // console.log(`   [PF]    Count=${pfVals.length}, Avg=${avgPF}`);

    // Avg Voltage
    const voltVals = voltDocs.map(d => d[voltage]).filter(v => v !== null);
   const avgVolt = sanitizeValue(voltVals.length ? parseFloat((voltVals.reduce((a,b)=>a+b,0)/voltVals.length).toFixed(2)) : 0);
    // console.log(`   [Volt]  Count=${voltVals.length}, Avg=${avgVolt}`);

    // Push result
    const baseName = energy.replace('_Del_ActiveEnergy', '');
    const result = {
      [`${baseName}_energy_consumption`]: consumption,
      [`${baseName}_avgPower`]: avgPower,
      [`${baseName}_avgPower_count`]: powerDocs.length,
      [`${baseName}_avgPowerFactor`]: avgPF,
      [`${baseName}_avgPowerFactor_count`]: pfDocs.length,
      [`${baseName}_avgVoltage`]: avgVolt,
      [`${baseName}_avgVoltage_count`]: voltDocs.length,
      metername,
      deptname,
      MCS,
      installedLoad,
    };

    meters.push(result);
    // console.log('✅ Final Result:', result);
  }

  return { startISO, endISO, meters };
}
