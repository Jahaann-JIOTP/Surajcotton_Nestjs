import { BadRequestException, Injectable, InternalServerErrorException, Logger} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeterToggle, MeterToggleDocument } from './schemas/meter-toggle.schema';
import { MeterConfiguration, MeterConfigurationDocument } from './schemas/meter-configuration.schema';
import { ToggleMeterDto } from './dto/toggle-meter.dto';
import { FieldMeterRawData } from './schemas/field-meter-raw-data.schema';
import {
  FieldMeterProcessData,FieldMeterProcessDataSchema} from './schemas/field_meter_process_data';
import axios from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as moment from "moment-timezone";
// add this import at the top with the others:
import type { AnyBulkWriteOperation as MongooseBulkOp } from 'mongoose';
import { Meter5Min, Meter5MinDocument } from './schemas/meter-5min.schema';



@Injectable()
export class MeterService {
  //  Structured logger instead of console.log
  private readonly logger = new Logger(MeterService.name);
  //  Allowed target areas (strict)
  private static readonly ALLOWED_AREAS = new Set(['unit4', 'unit5']);
  /**
   *   Linked meter groups:
   * - Any key resolves to the full group it belongs to.
   * - Singles map to themselves and remain independent.
   */

  private static readonly LINKED_GROUPS: Record<string, string[]> = {
    'U1_GW02': ['U1_GW02'], 
    'U4_GW02': ['U4_GW02'],

    'U3_GW02': ['U3_GW02'], 
    'U2_GW02': ['U2_GW02'],

    'U23_GW03': ['U23_GW03'],
    'U22_GW03': ['U22_GW03'],
  }
  constructor(
  @InjectModel(MeterToggle.name, 'surajcotton') private readonly toggleModel: Model<MeterToggleDocument>,
  @InjectModel(MeterConfiguration.name, 'surajcotton') private readonly configModel: Model<MeterConfigurationDocument>,
  @InjectModel(Meter5Min, 'surajcotton') private readonly meter5MinModel: Model<Meter5MinDocument>,
  private readonly httpService: HttpService,
  @InjectModel(FieldMeterRawData.name, 'surajcotton') private fieldMeterRawDataModel: Model<FieldMeterRawData>,
  @InjectModel(FieldMeterProcessData.name, 'surajcotton')
  private readonly fieldMeterProcessDataModel: Model<FieldMeterProcessData>,
) {}

// This is generic function for time-zone conversion to asia karachi
  private nowAsKarachiUtcDate(): Date {
    return new Date(Date.now() + 5 * 60 * 60 * 1000);
  }

/**
   * POST /meter/toggle
   * - No transactions (works on standalone MongoDB)
   * - Flips linked meters using bulkWrite
   * - Response remains: { meterId, area, message }
   */
  async toggleMeter(dto: ToggleMeterDto) {
    const { meterId, area, email, username } = dto;

    // 1) Validate input early (fast 400)
    if (!MeterService.ALLOWED_AREAS.has(area)) {
      throw new BadRequestException(`Invalid area "${area}". Allowed: unit4 | unit5`);
    }
    const group = MeterService.LINKED_GROUPS[meterId];
    if (!group) {
      throw new BadRequestException(
        `Unknown meterId "${meterId}". Allowed: ${Object.keys(MeterService.LINKED_GROUPS).join(', ')}`
      );
    }

    // 2) Snapshot current state of the whole group (single query)
    const existingDocs = await this.toggleModel
      .find({ meterId: { $in: group } })
      .lean()
      .catch((e) => {
        this.logger.error(`Read toggles failed: ${e?.message || e}`);
        throw new InternalServerErrorException('Unable to read current meter states.');
      });

    const now = this.nowAsKarachiUtcDate();

    // 3) Decide what to upsert/update for each meter
    type Change = { meterId: string; action: 'create' | 'update' | 'noop' };
    const changes: Change[] = [];

    const existingMap = new Map(existingDocs.map(d => [d.meterId, d]));
    for (const mId of group) {
      const doc = existingMap.get(mId);
      if (!doc) {
        changes.push({ meterId: mId, action: 'create' });
      } else if (doc.area === area) {
        changes.push({ meterId: mId, action: 'noop' });
      } else {
        changes.push({ meterId: mId, action: 'update' });
      }
    }

    // 4) Build a compact bulkWrite (no sessions/transactions) — strongly typed
// const ops: AnyBulkWriteOperation<any>[] = []; // or <MeterToggleDocument> if your doc type is compatible
const ops: MongooseBulkOp[] = [];

for (const c of changes) {
  if (c.action === 'create') {
    ops.push({
      insertOne: {
        document: {
          meterId: c.meterId,
          area,
          startDate: now,
          endDate: now,
        },
      },
    });
  } else if (c.action === 'update') {
    ops.push({
      updateOne: {
        filter: { meterId: c.meterId },
        update: { $set: { area, startDate: now, endDate: now } },
      },
    });
  }
}

// 5) Apply changes in one go (fast & simple)
if (ops.length > 0) {
  try {
    await this.toggleModel.bulkWrite(ops, { ordered: true });
  } catch (e: any) {
    this.logger.error(`bulkWrite(toggles) failed: ${e?.message || e}`);
    throw new InternalServerErrorException('Failed to toggle meters.');
  }
}



    // 6) Create config logs only for "create" or "update"
    const configDocs = changes
      .filter(c => c.action !== 'noop')
      .map(c => ({
        meterId: c.meterId,
        area,
        email,
        username,
        assignedAt: now,
      }));

    if (configDocs.length > 0) {
      try {
        await this.configModel.insertMany(configDocs, { ordered: false });
      } catch (e: any) {
        // Don’t fail the API if logs fail; just warn (state is already updated)
        this.logger.warn(`insertMany(config) failed: ${e?.message || e}`);
      }
    }

    // 7) Compute the primary meter's message to keep response identical
    let message = 'Toggled successfully.';
    const primaryChange = changes.find(c => c.meterId === meterId);
    if (primaryChange?.action === 'create') message = 'Initialized and activated.';
    if (primaryChange?.action === 'noop')   message = 'Already active in this area.';

    this.logger.log(
      `Toggle OK (no-txn) → area=${area}, group=[${group.join(', ')}], primary=${meterId}, msg="${message}"`
    );

    // 8) EXACT same response format as before
    return { meterId, area, message };
  }



// To get all the meters status in the meter configurations tab  
async getAllToggleData() {
  try {
    const data = await this.toggleModel.find().lean();
    if (!data.length) {
      return { message: 'No toggle data found.' };
    }
    return data;
  } catch (error) {
    return { message: 'Something went wrong' };  // Just the response
  }
}

// To get the log configuration for Meter Configuration Tab 
async getLatestConfig() {
  try {
    const configs = await this.configModel
      .find()
      .sort({ assignedAt: -1 }) // optional: latest on top
      .lean();

    if (!configs.length) {
      return { message: 'No configurations found.'};
    }

    return configs;
  } catch (err) {
    console.error('❌ Error fetching config:', err.message);
    return { message: 'Something went wrong' };
  }
}

//... These are the field meter ids ...
private readonly METER_UNIT_MAP: Record<string, string[]> = {
  'U23_GW03_Del_ActiveEnergy': ['Unit_4', 'Unit_5'], // PDB 010
  'U22_GW03_Del_ActiveEnergy': ['Unit_4', 'Unit_5'], // PDB 07
  'U3_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],  //Card PDB 01
  'U1_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],  // PDB1 CD1
  'U2_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],  // PDB2 CD2 
  'U4_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],  // PDB 08
};


async getToggleBasedRealTime() {
  try {
    const toggles = await this.toggleModel.find().lean();
    if (!toggles.length) {
      return { message: 'No toggle data found.' };
    }

    // 🔹 External API call
    const apiRes = await axios.get('http://43.204.118.114:6881/surajcotton');
    const apiData = apiRes.data || {};

    // 🔹 Timestamp unique by minute
    const utcNow = new Date();
utcNow.setSeconds(0, 0);
const timestampNow = new Date(utcNow.getTime() + 5 * 60 * 60 * 1000)
  .toISOString()
  .replace('Z', '+05:00');

    // 🔹 Base doc (ensure exists)
    let doc = await this.fieldMeterRawDataModel.findOne({
      timestamp: timestampNow,
      source: 'toggle',
    });

    if (!doc) {
      doc = await this.fieldMeterRawDataModel.create({
        timestamp: timestampNow,
        source: 'toggle',
      });
    }

  //   // 🔹 Update each meter individually
  //   for (const toggle of toggles) {
  //     const meterId = toggle.meterId;
  //     const fullId = `${meterId}_Del_ActiveEnergy`;

  //     const apiValue =
  //       apiData[fullId] ??
  //       apiData[meterId] ??
  //       0;

  //     const roundedValue = Math.round(apiValue * 100) / 100;

  //     // ✅ Update only this meter key in existing doc
  //     await this.fieldMeterRawDataModel.updateOne(
  //       { _id: doc._id },
  //       {
  //         $set: {
  //           [`${fullId}`]: {
  //             area: toggle.area,
  //             value: roundedValue,
  //           },
  //         },
  //       }
  //     );
  //   }

  //   // 🔹 Return fresh doc
  //   return await this.fieldMeterRawDataModel.findById(doc._id).lean();
  // } 
  
  // write all meters first (parallel = faster + consistent)
  const ops = toggles.map(t => {
    const fullId = `${t.meterId}_Del_ActiveEnergy`;
    const apiValue = apiData[fullId] ?? apiData[t.meterId] ?? 0;
    const value = Math.round(apiValue * 100) / 100;
    return this.fieldMeterRawDataModel.updateOne(
      { _id: doc._id },
      { $set: { [fullId]: { area: t.area, value } } }
    );
  });
  await Promise.all(ops);

  // ✅ process exactly this raw toggle doc
  await this.calculateConsumption(String(doc._id));

  return await this.fieldMeterRawDataModel.findById(doc._id).lean();
}
  catch (error) {
    console.error('❌ Error fetching toggle based real time:', error.message);
    return { message: 'Something went wrong' };
  }
}

// @Cron('0 */3 * * * *') 
// async storeEvery15Minutes() {
//   try {
//  // 🔹 Get all unprocessed 5-min docs in order
//     const pendingDocs = await this.meter5MinModel
//       .find({ isProcessed: false })
//       .sort({ timestamp: 1 })
//       .lean();


//     if (pendingDocs.length === 0) {
//       console.log("❌ No 5-minute record found in 5min_historical");
//       return;
//     }
  
//      //🔸Get current areas from toggles as fallback when there's no process/raw doc
//     const toggles = await this.toggleModel.find().lean();
//     const areaMap: Record<string, string> = {};
//     for (const t of toggles) {
//       areaMap[`${t.meterId}_Del_ActiveEnergy`] = t.area; // same key shape as raw
//     }
//     let lastInsertedDoc: any = null;  // optional, just to return something at the end

//     // 🔁 Process each pending 5-min doc one by one
//     for (const latest5MinDoc of pendingDocs) {
//     const fieldTimestamp = (latest5MinDoc as any).timestamp;
//     // This matches EXACTLY the same as apiData from Node-RED
//     const apiData = latest5MinDoc;

//     // console.log("API DATA ££££££££££££££££££",apiData);

//     // 3️⃣ Check last doc
//     const lastDoc = await this.fieldMeterRawDataModel.findOne().sort({ timestamp: -1 });

//     const realTimeValuesObj: Record<string, { area: string; value: number }> = {};
//     for (const meterId of Object.keys(this.METER_UNIT_MAP)) {
//       const shortId = meterId.replace('_Del_ActiveEnergy', '');
//       const apiValue = apiData[meterId] ?? apiData[shortId] ?? 0;

//       realTimeValuesObj[meterId] = {
//         area: (lastDoc as any)?.[meterId]?.area || areaMap[meterId] || 'unit4',
//         value: Math.round(apiValue * 100) / 100,
//       };
//     }

//     // 4️⃣ Insert with upsert (only one cron doc per minute)
//       const newDoc = await this.fieldMeterRawDataModel.findOneAndUpdate(
//         { timestamp: fieldTimestamp, source: 'cron' },
//         {
//           $setOnInsert: {
//             timestamp: fieldTimestamp,   // 🟢 PLC timestamp preserved
//             insertedAt: new Date(),      // 🟢 System insertion time
//             source: 'cron'
//           },
//           $set: {
//             ...realTimeValuesObj         // 🟢 SAME structure as before
//           }
//         },
//         { upsert: true, new: true }
//       );


//     console.log(`✅ Cron insert complete for ${fieldTimestamp}`);
//     lastInsertedDoc = newDoc;
//     // After storing the real-time data, now call the calculateConsumption function
//     await this.calculateConsumption(String(newDoc._id)); // Calling calculateConsumption after storing data

//           // 🔹 Mark this 5min doc as processed
//       await this.meter5MinModel.updateOne(
//         { _id: latest5MinDoc._id },
//         { $set: { isProcessed: true } },
//       );
//     }
//     return lastInsertedDoc;

//   } catch (err) {
//     console.error('❌ Cron error:', err.message);
//   }
// }

async calculateConsumption(rawId?: string) {
  const meterKeys = [
    "U23_GW03_Del_ActiveEnergy",
    "U22_GW03_Del_ActiveEnergy",
    "U3_GW02_Del_ActiveEnergy",
    "U1_GW02_Del_ActiveEnergy",
    "U2_GW02_Del_ActiveEnergy",
    "U4_GW02_Del_ActiveEnergy",
  ];
  // Installed Load 
  const installedLoad: Record<string, number> = {
  'U23_GW03_Del_ActiveEnergy': 8, // not confirm // ((600*1.8*400)/1000)/60
  'U22_GW03_Del_ActiveEnergy': 8, // ((600*1.8*400)/1000)/60
  'U3_GW02_Del_ActiveEnergy': 5,  // ((400*1.8*400)/1000)/60
  'U1_GW02_Del_ActiveEnergy': 5,  // ((400*1.8*400)/1000)/60 
  'U2_GW02_Del_ActiveEnergy': 5,  // ((400*1.8*400)/1000)/60 
  'U4_GW02_Del_ActiveEnergy': 10, // ((800*1.8*400)/1000)/60
};

  // 🔹 Last processDoc (for previous state of flatMeters)
  const prevProcessDoc = await this.fieldMeterProcessDataModel
    .findOne({})
    .sort({ timestamp: -1 });

  // 🔹 Latest rawDoc (toggle OR cron)
  // const lastRawDoc = await this.fieldMeterRawDataModel
  //   .findOne({})
  //   .sort({ timestamp: -1 });
    const rawQuery = rawId ? { _id: rawId } : {};
    const lastRawDoc = await this.fieldMeterRawDataModel
    .findOne(rawQuery)
    .sort({ timestamp: -1, _id: -1 });




  if (!lastRawDoc) {
    // console.log("⏹ No raw data found in field_meter_raw_data");
    return { msg: "No raw data found" };
  }

  // --- CRON CASE ---

if (lastRawDoc.source === "cron") {
  const latestCron = await this.fieldMeterRawDataModel
    .findOne({ source: "cron" })
    .sort({ timestamp: -1 })
    .lean();

  if (!latestCron) {
    return { msg: "No cron doc found" };
  }

  const flatMeters: Record<string, { fV: number; lV: number; CONS: number; cumulative_con: number }> = {};

    // Calculate adjusted timestamp once
  const adjustedTimestamp = new Date(
    new Date(latestCron.timestamp).getTime() + 5 * 60 * 60 * 1000
  );

  // const adjustedTimestamp = new Date(lastRawDoc.timestamp);
  for (const meterId of meterKeys) {
    const latestMeter = latestCron[meterId];
    if (!latestMeter) continue;

    const currentArea = latestMeter.area?.toLowerCase(); // normalize (unit4 / unit5)
    let currentValue = latestMeter.value;

    // Fetch previous values
    const prevFlatU4 = prevProcessDoc?.[`U4_${meterId}`];
    const prevFlatU5 = prevProcessDoc?.[`U5_${meterId}`];
    const prevLastArea = prevProcessDoc?.[`lastArea_${meterId}`];

    let u4 = prevFlatU4 ? { ...prevFlatU4 } : { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };
    let u5 = prevFlatU5 ? { ...prevFlatU5 } : { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };
    
    const lastLV = prevLastArea === "unit4" ? prevFlatU4?.lV : prevFlatU5?.lV;

       //  ----------------- Step 1: Garbage / invalid value filter ---------------------
    
    if (
      isNaN(currentValue) || 
      currentValue === Infinity || 
      currentValue === -Infinity || 
      currentValue <= 0 || 
      currentValue < lastLV || 
      currentValue > 1e12
    ) {
      currentValue = lastLV || 0;
    }

//  ------------------ Step 2: Zero-to-first-value fix -------------------

    if (currentArea === "unit4" && prevFlatU4 && prevFlatU4?.lV === 0 && currentValue > 0) {
        u4.fV = currentValue;
    }
    if (currentArea === "unit5" && prevFlatU5 && prevFlatU5?.lV === 0 && currentValue > 0) {
        u5.fV = currentValue;
    }

 // ----------------- Step 3: HIGH-SPIKE protection (add here) -------------

//  Step 1: Find minutes since last non-zero consumption
const lastNonZeroLV = prevLastArea === "unit4" ? prevFlatU4?.lV : prevFlatU5?.lV;
const lastNonZeroTimestamp = prevLastArea === "unit4" ? prevFlatU4?.lastNonZeroTime : prevFlatU5?.lastNonZeroTime;

// Compute minutes since last non-zero reading
let minutesDiff = 3; // default 1 minute if no previous
if (lastNonZeroTimestamp) {
  console.log("--------- Last non Zero Value TimeStamp ------------")
  console.log(lastNonZeroTimestamp);
    minutesDiff = (adjustedTimestamp.getTime() - new Date(lastNonZeroTimestamp).getTime()) / (1000 * 60);
}

// Step 2: Calculate maximum spike and check
const maxSpike = (installedLoad[meterId]) * minutesDiff;

  if (currentValue  > (lastNonZeroLV + maxSpike + 20)) {
    console.log("----------MAX SPIKE -----------------");
    console.log(maxSpike);
    console.log(`High spike detected on ${meterId}, replacing  ${currentValue} value with ${lastNonZeroLV}`);
    currentValue = lastNonZeroLV || currentValue; // I WILL DISCUSS THIS WITH AUTOMATION / IF HIGH VALUE COME FIRST TIME AND THERE IS NO NORMAL VALUE THEN ? ACCEPT IT OR REPLACE IT WITH 0 
}

// ---- Per-meter first-time detection (CRON) ----
const isFirstForThisMeter = !prevFlatU4 && !prevFlatU5 && !prevLastArea;

if (isFirstForThisMeter) {
  if (currentArea === "unit4") {
    u4 = { fV: currentValue, lV: currentValue, CONS: 0, cumulative_con: 0 };
    u5 = { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };
  } else {
    u5 = { fV: currentValue, lV: currentValue, CONS: 0, cumulative_con: 0 };
    u4 = { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };
  }
} else {
  // ---- Existing logic: toggle vs same-area ----
  if (prevLastArea && prevLastArea !== currentArea) {
    // TOGGLE path
    if (currentArea === "unit4") {
      // finalize unit5
      u5.fV = prevFlatU5?.lV ?? u5.lV;
      u5.lV = currentValue;
      u5.CONS = u5.lV - u5.fV;
      u5.cumulative_con += u5.CONS;

      // start unit4 at current
      u4.fV = currentValue;
      u4.lV = currentValue;
      u4.CONS = u4.lV - u4.fV;
      u4.cumulative_con += u4.CONS;
    } else {
      // finalize unit4
      u4.fV = prevFlatU4?.lV ?? u4.lV;
      u4.lV = currentValue;
      u4.CONS = u4.lV - u4.fV;
      u4.cumulative_con += u4.CONS;

      // start unit5 at current
      u5.fV = currentValue;
      u5.lV = currentValue;
      u5.CONS = u5.lV - u5.fV;
      u5.cumulative_con += u5.CONS;
    }
  } else {
    // SAME-AREA path
    if (currentArea === "unit4") {
      u4.fV = prevFlatU4?.lV ?? u4.lV;
      u4.lV = currentValue;
      u4.CONS = currentValue - u4.fV;
      u4.cumulative_con += u4.CONS;
    } else {
      u5.fV = prevFlatU5?.lV ?? u5.lV;
      u5.lV = currentValue;
      u5.CONS = currentValue - u5.fV;
      u5.cumulative_con += u5.CONS;
    }
  }
}


      // ✅ Update lastNonZeroTime based on CONS, not raw value
  if (u4.CONS > 0) u4.lastNonZeroTime = adjustedTimestamp;
  if (u5.CONS > 0) u5.lastNonZeroTime = adjustedTimestamp;
  

    // 🔹 Save into flatMeters
    flatMeters[`U4_${meterId}`] = u4;
    flatMeters[`U5_${meterId}`] = u5;
    flatMeters[`lastArea_${meterId}`] = currentArea;
  }


    const orderedDoc: Record<string, any> = {
      timestamp: adjustedTimestamp,
      source: "cron",
    };

  for (const meterId of meterKeys) {
    if (!flatMeters[`U4_${meterId}`]) continue;
    orderedDoc[`U4_${meterId}`] = flatMeters[`U4_${meterId}`];
    orderedDoc[`U5_${meterId}`] = flatMeters[`U5_${meterId}`];
    orderedDoc[`lastArea_${meterId}`] = flatMeters[`lastArea_${meterId}`];
  }

  await this.fieldMeterProcessDataModel.updateOne(
    { timestamp: adjustedTimestamp },
    {
      $setOnInsert: {
        insertedAt: new Date()
      },
      $set: orderedDoc
    },
    { upsert: true }
  );


  console.log("💾 Cron processDoc inserted successfully");
  // console.log("📊 Final Consumption (cron):", JSON.stringify(flatMeters, null, 2));

  return { data: flatMeters };
}


// --- TOGGLE CASE ---
let processDoc = new this.fieldMeterProcessDataModel({});
const flatMeters: Record<string, { fV: number; lV: number; CONS: number; cumulative_con: number}> = {};
 // ✅ Save ordered doc
const adjustedTimestamp = new Date(
  new Date(lastRawDoc.timestamp).getTime() + 5 * 60 * 60 * 1000
);

for (const meterId of meterKeys) {
  const meterObj = lastRawDoc[meterId];
  if (!meterObj) continue;

  const currentArea = meterObj.area?.toLowerCase(); // "Unit_4" / "Unit_5"
  let currentValue = meterObj.value;

  // Fetch previous values
  const prevFlatU4 = prevProcessDoc?.[`U4_${meterId}`];
  const prevFlatU5 = prevProcessDoc?.[`U5_${meterId}`];
  const prevLastArea = prevProcessDoc?.[`lastArea_${meterId}`];

let u4 = prevFlatU4 ? { ...prevFlatU4 } : { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };
let u5 = prevFlatU5 ? { ...prevFlatU5 } : { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };


  const lastLV = prevLastArea === "unit4" ? prevFlatU4?.lV : prevFlatU5?.lV;

         //  ----------------- Step 1: Garbage / invalid value filter ---------------------
        
        if (
          isNaN(currentValue) || 
          currentValue === Infinity || 
          currentValue === -Infinity || 
          currentValue <= 0 || 
          currentValue < lastLV || 
          currentValue > 1e12
        ) {
          currentValue = lastLV || 0;
        }

    //  ------------------ Step 2: Zero-to-first-value fix -------------------

        if (currentArea === "unit4" && prevFlatU4 && prevFlatU4?.lV === 0 && currentValue > 0) {
            u4.fV = currentValue;
        }
        if (currentArea === "unit5" && prevFlatU5 && prevFlatU5?.lV === 0 && currentValue > 0) {
            u5.fV = currentValue;
        }

    // ----------------- Step 3: HIGH-SPIKE protection (add here) -------------

    //  Step 1: Find minutes since last non-zero consumption
    const lastNonZeroLV = prevLastArea === "unit4" ? prevFlatU4?.lV : prevFlatU5?.lV;
    const lastNonZeroTimestamp = prevLastArea === "unit4" ? prevFlatU4?.lastNonZeroTime : prevFlatU5?.lastNonZeroTime;

    // Compute minutes since last non-zero reading
    let minutesDiff = 3; // default 1 minute if no previous
    if (lastNonZeroTimestamp) {
      console.log("--------- Last non Zero Value TimeStamp ------------")
      console.log(lastNonZeroTimestamp);
        minutesDiff = (adjustedTimestamp.getTime() - new Date(lastNonZeroTimestamp).getTime()) / (1000 * 60);
        console.log("minutesDiff");
    }

    // Step 2: Calculate maximum spike and check
    const maxSpike = (installedLoad[meterId]) * minutesDiff;
    console.log("----------MAX SPIKE -----------------");
    console.log(maxSpike);
    console.log("----------Minutes calculation -----------------");
    console.log(minutesDiff);
    if (currentValue  > (lastNonZeroLV + maxSpike + 20)) {
        console.log(`High spike detected on ${meterId}, replacing value ${currentValue} with ${lastNonZeroLV}`);
        currentValue = lastNonZeroLV || currentValue; // I WILL DISCUSS THIS WITH AUTOMATION / IF HIGH VALUE COME FIRST TIME AND THERE IS NO NORMAL VALUE THEN ? ACCEPT IT OR REPLACE IT WITH 0 
        
      }
  
// ---- Per-meter first-time detection (TOGGLE) ----
const isFirstForThisMeter = !prevFlatU4 && !prevFlatU5 && !prevLastArea;

if (isFirstForThisMeter) {
  if (currentArea === "unit4") {
    u4 = { fV: currentValue, lV: currentValue, CONS: 0, cumulative_con: 0 };
    u5 = { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };
  } else {
    u5 = { fV: currentValue, lV: currentValue, CONS: 0, cumulative_con: 0 };
    u4 = { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };
  }
} else {
  // ---- Existing logic: toggle vs same-area ----
  if (prevLastArea && prevLastArea !== currentArea) {
    if (currentArea === "unit4") {
      u5.fV = prevFlatU5?.lV ?? u5.lV;
      u5.lV = currentValue;
      u5.CONS = u5.lV - u5.fV;
      u5.cumulative_con += u5.CONS;

      u4.fV = currentValue;
      u4.lV = currentValue;
      u4.CONS = u4.lV - u4.fV;
      u4.cumulative_con += u4.CONS;
    } else {
      u4.fV = prevFlatU4?.lV ?? u4.lV;
      u4.lV = currentValue;
      u4.CONS = u4.lV - u4.fV;
      u4.cumulative_con += u4.CONS;

      u5.fV = currentValue;
      u5.lV = currentValue;
      u5.CONS = u5.lV - u5.fV;
      u5.cumulative_con += u5.CONS;
    }
  } else {
    if (currentArea === "unit4") {
      u4.fV = prevFlatU4?.lV ?? u4.lV;
      u4.lV = currentValue;
      u4.CONS = currentValue - u4.fV;
      u4.cumulative_con += u4.CONS;
    } else {
      u5.fV = prevFlatU5?.lV ?? u5.lV;
      u5.lV = currentValue;
      u5.CONS = currentValue - u5.fV;
      u5.cumulative_con += u5.CONS;
    }
  }
}


        // ✅ Update lastNonZeroTime based on CONS, not raw value
  if (u4.CONS > 0) u4.lastNonZeroTime = adjustedTimestamp;
  if (u5.CONS > 0) u5.lastNonZeroTime = adjustedTimestamp;

  // Save into flatMeters
  flatMeters[`U4_${meterId}`] = u4;
  flatMeters[`U5_${meterId}`] = u5;
  flatMeters[`lastArea_${meterId}`] = currentArea;
}

  const orderedDoc: Record<string, any> = {
    timestamp: adjustedTimestamp,
    source: 'toggle',
  };

for (const meterId of meterKeys) {
  if (!flatMeters[`U4_${meterId}`]) continue;

  orderedDoc[`U4_${meterId}`] = flatMeters[`U4_${meterId}`];
  orderedDoc[`U5_${meterId}`] = flatMeters[`U5_${meterId}`];
  orderedDoc[`lastArea_${meterId}`] = flatMeters[`lastArea_${meterId}`];
}

await this.fieldMeterProcessDataModel.updateOne(
  { timestamp: adjustedTimestamp, source: 'toggle' },
  { $set: orderedDoc },
  { upsert: true }
);

console.log("💾 New processDoc inserted successfully");
console.log("📊 Final Consumption (toggle):", JSON.stringify(flatMeters, null, 2));

return { data: flatMeters };
}

// Get per-meter total consumption sum

async getMeterWiseConsumption(
  startDate: string,
  endDate: string,
  opts?: { startTime?: string; endTime?: string }
) {
  try {

    const TZ = 'Asia/Karachi';
// ---- Build start/end Date objects in Asia/Karachi ----
let start: Date;
let end: Date;

if (opts?.startTime && opts?.endTime) {
  // Custom time window (e.g., 2025-09-28 08:30 → 2025-09-29 03:15)
  const startMoment = moment
    .tz(`${startDate} ${opts.startTime}`, 'YYYY-MM-DD HH:mm', TZ)
    .startOf('minute')
    .add(5, 'hours');   // ⬅️ Add 5 hours here

  const endMoment = moment
    .tz(`${endDate} ${opts.endTime}`, 'YYYY-MM-DD HH:mm', TZ)
    .endOf('minute')
    .add(5, 'hours');   // ⬅️ Add 5 hours here

  start = startMoment.toDate();
  end = endMoment.toDate();
  
    } else {
      // Default: 6:00 AM (startDate) → next day 6:00 AM
      // const fixedDate = "2025-09-27"; 
      const startMoment = moment.tz(`${startDate} 11:00`, 'YYYY-MM-DD HH:mm', TZ);
      const endMoment = moment.tz(`${endDate} 11:00`, 'YYYY-MM-DD HH:mm', TZ)
        .add(1, 'day')

      start = startMoment.toDate();
      end = endMoment.toDate();
    }


    // console.log("📅 start:", start);
    // console.log("📅 end  :", end);

    const result = await this.fieldMeterProcessDataModel.aggregate([
      {
        $match: {
        timestamp: {
  $gte: new Date(start),
  $lte: new Date(end),
}

        },
      },
      { $sort: { timestamp: 1 } },
      {
        $group: {
          _id: null,
          first: { $first: "$$ROOT" },
          last: { $last: "$$ROOT" },
        },
      },
      {
        $project: {
          _id: 0,
          // ✅ Timestamps properly Asia/Karachi timezone ke sath dikhayenge
      firstTimestamp: {
      $dateToString: {
        format: "%Y-%m-%d %H:%M:%S",
        date: "$first.timestamp",
        timezone: "Asia/Karachi",
      },
    },
    lastTimestamp: {
      $dateToString: {
        format: "%Y-%m-%d %H:%M:%S",
        date: "$last.timestamp",
        timezone: "Asia/Karachi",
      },
    },

          // ✅ Har meter ke liye subtraction
          U4_U1_GW02_Del_ActiveEnergy: {
            $subtract: [
              "$last.U4_U1_GW02_Del_ActiveEnergy.cumulative_con",
              "$first.U4_U1_GW02_Del_ActiveEnergy.cumulative_con",
            ],
          },

          first_U4_U22_GW03_cum: "$first.U4_U22_GW03_Del_ActiveEnergy.cumulative_con",
          last_U4_U22_GW03_cum:  "$last.U4_U22_GW03_Del_ActiveEnergy.cumulative_con",
          first_raw_ts:          "$first.timestamp",
          last_raw_ts:           "$last.timestamp",


          U4_U22_GW03_Del_ActiveEnergy: {
            $subtract: [
              "$last.U4_U22_GW03_Del_ActiveEnergy.cumulative_con",
              "$first.U4_U22_GW03_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U4_U23_GW03_Del_ActiveEnergy: {
            $subtract: [
              "$last.U4_U23_GW03_Del_ActiveEnergy.cumulative_con",
              "$first.U4_U23_GW03_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U4_U2_GW02_Del_ActiveEnergy: {
            $subtract: [
              "$last.U4_U2_GW02_Del_ActiveEnergy.cumulative_con",
              "$first.U4_U2_GW02_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U4_U3_GW02_Del_ActiveEnergy: {
            $subtract: [
              "$last.U4_U3_GW02_Del_ActiveEnergy.cumulative_con",
              "$first.U4_U3_GW02_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U4_U4_GW02_Del_ActiveEnergy: {
            $subtract: [
              "$last.U4_U4_GW02_Del_ActiveEnergy.cumulative_con",
              "$first.U4_U4_GW02_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U5_U1_GW02_Del_ActiveEnergy: {
            $subtract: [
              "$last.U5_U1_GW02_Del_ActiveEnergy.cumulative_con",
              "$first.U5_U1_GW02_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U5_U22_GW03_Del_ActiveEnergy: {
            $subtract: [
              "$last.U5_U22_GW03_Del_ActiveEnergy.cumulative_con",
              "$first.U5_U22_GW03_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U5_U23_GW03_Del_ActiveEnergy: {
            $subtract: [
              "$last.U5_U23_GW03_Del_ActiveEnergy.cumulative_con",
              "$first.U5_U23_GW03_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U5_U2_GW02_Del_ActiveEnergy: {
            $subtract: [
              "$last.U5_U2_GW02_Del_ActiveEnergy.cumulative_con",
              "$first.U5_U2_GW02_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U5_U3_GW02_Del_ActiveEnergy: {
            $subtract: [
              "$last.U5_U3_GW02_Del_ActiveEnergy.cumulative_con",
              "$first.U5_U3_GW02_Del_ActiveEnergy.cumulative_con",
            ],
          },
          U5_U4_GW02_Del_ActiveEnergy: {
            $subtract: [
              "$last.U5_U4_GW02_Del_ActiveEnergy.cumulative_con",
              "$first.U5_U4_GW02_Del_ActiveEnergy.cumulative_con",
            ],
          },
        },
      },
    ]);

    if (result.length > 0) {
      const r =  result[0];
      // console.log("first_ts:", r.firstTimestamp, "raw:", r.first_raw_ts);
      // console.log("last_ts :", r.lastTimestamp,  "raw:", r.last_raw_ts);
      // console.log("U4_U22 first cumulative:", r.first_U4_U22_GW03_cum);
      // console.log("U4_U22 last  cumulative:", r.last_U4_U22_GW03_cum);
      // console.log("U4_U22 diff (projected):", r.U4_U22_GW03_Del_ActiveEnergy);
      return result[0];
    }
    return {};
  } catch (err) {
    console.error("❌ Error in getMeterWiseConsumption:", err.message);
    return {};
  }
}

}





















































