import * as moment from 'moment-timezone';
import { Model } from 'mongoose';
import { Historical } from './schemas/historical.schema';

/* -------------------- Helpers -------------------- */

// Bucket timestamp into 15-minute slot
function bucket15min(ts: string) {
  const m = moment(ts).tz('Asia/Karachi');
  const minutes = Math.round(m.minutes() / 15) * 15;
  return m.clone().minutes(minutes).seconds(0).milliseconds(0).toISOString();
}

// Generate expected 15-minute time slots
function generateTimeSlots(startISO: string, endISO: string): string[] {
  const slots: string[] = [];
  let cursor = moment(startISO).tz('Asia/Karachi');
  const end = moment(endISO).tz('Asia/Karachi');

  while (cursor.isSameOrBefore(end)) {
    slots.push(cursor.toISOString());
    cursor.add(15, 'minutes');
  }
  return slots;
}

// Sanitize raw numeric values
function sanitizeValue(val: number | null): number {
  if (val === null || !Number.isFinite(val) || val > 1e12 || val < -1e12) return 0;
  return val;
}

// Align documents to time slots
function alignAllSlots(docs: any[], slots: string[], fields: string[]) {
  const map = new Map<string, any>();

  docs.forEach(d => {
    const bucket = bucket15min(d.timestamp);
    if (!map.has(bucket)) {
      const base: any = { timestamp: bucket };
      fields.forEach(f => (base[f] = null));
      map.set(bucket, base);
    }

    fields.forEach(f => {
      if (d[f] !== undefined && d[f] !== null) {
        map.get(bucket)[f] = sanitizeValue(d[f]);
      }
    });
  });

  return slots.map(slot => map.get(slot) || Object.fromEntries([['timestamp', slot], ...fields.map(f => [f, null])]));
}

/* -------------------- Main Function -------------------- */

export async function calculateConsumptionCore(
  dto: any,
  metersConfig: any[],
  historicalModel: Model<Historical>,
  debug = false, // optional debug flag
) {
  const { startDate, endDate, startTime, endTime } = dto;

  // Build start/end ISO timestamps in Asia/Karachi
  let startISO: string;
  let endISO: string;

   /* -------------------- Updated Logic -------------------- */
  if (startTime && endTime) {
    // User provided custom times — use exactly as given.
    startISO = moment.tz(`${startDate}T${startTime}`, 'Asia/Karachi').toISOString();
    endISO = moment.tz(`${endDate}T${endTime}`, 'Asia/Karachi').add(2, 'minutes').format();

    // ❌ No auto +1 day for same date/time
    // Only add +1 day when END is earlier than START AND times are different.
    if (
      moment(endISO).isSameOrBefore(moment(startISO)) &&
      !(startDate === endDate && startTime === endTime)
    ) {
      endISO = moment(endISO).add(1, 'day').toISOString();
    }
  } else {
    // Default 06:00 → 06:00 window (always +1 day)
    startISO = moment.tz(`${startDate}T06:00:00`, 'Asia/Karachi').toISOString();
    endISO = moment.tz(`${endDate}T06::00`, 'Asia/Karachi').add(1, 'day').toISOString();
  }

  const totalHours = Math.max(moment(endISO).diff(moment(startISO), 'milliseconds') / 3600000, 0);
  console.log(totalHours);

  const slots = generateTimeSlots(startISO, endISO);

  const meters = await Promise.all(
    metersConfig.map(async meter => {
      const { energy, power, powerFactor, voltage, metername, deptname, MCS, installedLoad, lt } = meter;

      let rawDocs = await historicalModel.find(
      {
        $expr: {
          $and: [
            { $gte: [{ $dateFromString: { dateString: '$timestamp' } }, { $dateFromString: { dateString: startISO } }] },
            { $lte:  [{ $dateFromString: { dateString: '$timestamp' } }, { $dateFromString: { dateString: endISO } }] },
          ],
        },
      },
      { [energy]: 1, [power]: 1, [powerFactor]: 1, [voltage]: 1, timestamp: 1 } as any,
    )
      .sort({ timestamp: 1 })
      .lean();
       // Debugging: Log first and last document for U17_GW02 meter
      // if (metername === 'Card 8-14') {  // Adjust this to match the correct meter name for U17_GW02
      //   console.log("👉 First RawDoc for U17_GW02:", rawDocs[0]);
      //   console.log("👉 Last RawDoc for U17_GW02:", rawDocs[rawDocs.length - 1]);
      // }
      

    
        // console.log("👉 Query Window:", startISO, "-", endISO);
        // console.log("📌 RawDocs Count:", rawDocs.length);
      
        //   console.log("⏳ First Timestamp:", rawDocs[0].timestamp);
        //   console.log("⌛ Last Timestamp:", rawDocs[rawDocs.length - 1].timestamp);
        
      

      const aligned = alignAllSlots(rawDocs, slots, [energy, power, powerFactor, voltage]);
      
      const totalSlots = aligned.length;

      // First and last valid energy readings
      const firstDoc = aligned.find(d => d[energy] !== null);
      const lastDoc = [...aligned].reverse().find(d => d[energy] !== null);
      const consumption = firstDoc && lastDoc ? sanitizeValue(lastDoc[energy] - firstDoc[energy]) : 0;
      

      // Average calculations (ignore nulls)
      const avg = (field: string) => {
        const values = aligned.map(d => d[field]).filter(v => v !== null);
        return values.length ? sanitizeValue(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      };

      const baseName = energy.replace('_Del_ActiveEnergy', '');

      return {
        [`${baseName}_energy_consumption`]: consumption,
        [`${baseName}_avgPower`]: avg(power),
        [`${baseName}_avgPower_count`]: totalSlots,
        [`${baseName}_avgPowerFactor`]: avg(powerFactor),
        [`${baseName}_avgPowerFactor_count`]: totalSlots,
        [`${baseName}_avgVoltage`]: avg(voltage),
        [`${baseName}_avgVoltage_count`]: totalSlots,

        metername,
        deptname,
        MCS,
        installedLoad,
        lt,
      };
    }),
  );

  return { startISO, endISO, totalHours, meters };
}
