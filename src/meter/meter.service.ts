
import { Injectable} from '@nestjs/common';
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

@Injectable()
export class MeterService {
  constructor(
    @InjectModel(MeterToggle.name, 'surajcotton') private readonly toggleModel: Model<MeterToggleDocument>,
    @InjectModel(MeterConfiguration.name, 'surajcotton') private readonly configModel: Model<MeterConfigurationDocument>,
      
  private readonly httpService: HttpService,
  @InjectModel(FieldMeterRawData.name, 'surajcotton') private fieldMeterRawDataModel: Model<FieldMeterRawData>,
@InjectModel(FieldMeterProcessData.name, 'surajcotton')
private readonly fieldMeterProcessDataModel: Model<FieldMeterProcessData>,
) {}

// This is generic function for time-zone conversion to asia karachi
  private nowAsKarachiUtcDate(): Date {
    return new Date(Date.now() + 5 * 60 * 60 * 1000);
  }

  // This Api Handles the meter Toggle functionality and its configurations logs. It inserts data in  meterconfigurations collection and metertoggle collection  - (POST + UPDATE)
  async toggleMeter(dto: ToggleMeterDto) {
  const { meterId, area, email, username } = dto;

  if (!['unit4', 'unit5'].includes(area)) {
    return { message: `Invalid area: ${area}` };
  }

  const karachiAsUtc = this.nowAsKarachiUtcDate();
  const existing = await this.toggleModel.findOne({ meterId });

  if (!existing) {
    await this.toggleModel.create({
      meterId,
      area,
      startDate: karachiAsUtc, // ✅ Date shows Karachi time in Z
      endDate: karachiAsUtc,
    });

    await this.configModel.create({
      meterId,
      area,
      email,
      username,
      assignedAt: karachiAsUtc,
    });

    return { meterId, area, message: 'Initialized and activated.' };
  }

  if (existing.area === area) {
    return { meterId, area, message: 'Already active in this area.' };
  }

    existing.area = area;
    existing.startDate = karachiAsUtc;
    existing.endDate = karachiAsUtc;
    await existing.save();

  await this.configModel.create({
    meterId,
    area,
    email,
    username,
    assignedAt: karachiAsUtc,
  });

  return { meterId, area, message: 'Toggled successfully.' };
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
    const apiRes = await axios.get('http://13.234.241.103:1880/surajcotton');
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

    // 🔹 Update each meter individually
    for (const toggle of toggles) {
      const meterId = toggle.meterId;
      const fullId = `${meterId}_Del_ActiveEnergy`;

      const apiValue =
        apiData[fullId] ??
        apiData[meterId] ??
        0;

      const roundedValue = Math.round(apiValue * 100) / 100;

      // ✅ Update only this meter key in existing doc
      await this.fieldMeterRawDataModel.updateOne(
        { _id: doc._id },
        {
          $set: {
            [`${fullId}`]: {
              area: toggle.area,
              value: roundedValue,
            },
          },
        }
      );
    }

    // 🔹 Return fresh doc
    return await this.fieldMeterRawDataModel.findById(doc._id).lean();
  } catch (error) {
    console.error('❌ Error fetching toggle based real time:', error.message);
    return { message: 'Something went wrong' };
  }
}

// 🔹 har 15 min baad yeh cron job chalegi or doc db may jay ga //
// @Cron('0 */15 * * * *') 
// async storeEvery15Minutes() {
//   try {
//     // 1️⃣ API call
//     const apiRes = await axios.get('http://13.234.241.103:1880/surajcotton');
//     const apiData = apiRes.data;

//     // 2️⃣ Round current time to nearest 1-minute slot
//   // 2️⃣ Round current time to nearest 15-minute slot in UTC
// const now = new Date();
// const roundedMinutes = Math.floor(now.getMinutes() / 15) * 15;
// const timestamp15UTC = new Date(now);
// timestamp15UTC.setMinutes(roundedMinutes, 0, 0);

// // 🔹 Convert UTC → Karachi (+05:00)
// const timestamp15 = new Date(timestamp15UTC.getTime() + 5 * 60 * 60 * 1000)
//   .toISOString()
//   .replace('Z', '+05:00');

//     // 3️⃣ Check last doc
//     const lastDoc = await this.fieldMeterRawDataModel.findOne().sort({ timestamp: -1 });

//     const realTimeValuesObj: Record<string, { area: string; value: number }> = {};
//     for (const meterId of Object.keys(this.METER_UNIT_MAP)) {
//       const shortId = meterId.replace('_Del_ActiveEnergy', '');
//       const apiValue = apiData[meterId] ?? apiData[shortId] ?? 0;

//       realTimeValuesObj[meterId] = {
//         area: lastDoc?.[meterId]?.area || 'unit4', // keep last area or default
//         value: Math.round(apiValue * 100) / 100,
//       };
//     }

//     // 4️⃣ Insert with upsert (only one cron doc per minute)
//     const newDoc = await this.fieldMeterRawDataModel.findOneAndUpdate(
//       { timestamp: timestamp15, source: 'cron' }, // unique condition
     
//       {
//         $setOnInsert: {
//           ...realTimeValuesObj,
//           timestamp: timestamp15,
//           source: 'cron',
//         },
//       },
//       { upsert: true, new: true }
//     );

//     // console.log(`✅ Cron insert complete for ${timestamp15.toISOString()}`);

//     // After storing the real-time data, now call the calculateConsumption function
//     await this.calculateConsumption(); // Calling calculateConsumption after storing data

//     return newDoc;

//   } catch (err) {
//     console.error('❌ Cron error:', err.message);
//   }
// }

// for 3 minutes interval 
@Cron('0 */3 * * * *') 
async storeEvery15Minutes() {
  try {
    // 1️⃣ API call
    const apiRes = await axios.get('http://13.234.241.103:1880/surajcotton');
    const apiData = apiRes.data;

    // 2️⃣ Round current time to nearest 1-minute slot
  // 2️⃣ Round current time to nearest 15-minute slot in UTC
const now = new Date();
const roundedMinutes = Math.floor(now.getMinutes() / 3) * 3;
const timestamp15UTC = new Date(now);
timestamp15UTC.setMinutes(roundedMinutes, 0, 0);

// 🔹 Convert UTC → Karachi (+05:00)
const timestamp15 = new Date(timestamp15UTC.getTime() + 5 * 60 * 60 * 1000)
  .toISOString()
  .replace('Z', '+05:00');

    // 3️⃣ Check last doc
    const lastDoc = await this.fieldMeterRawDataModel.findOne().sort({ timestamp: -1 });

    const realTimeValuesObj: Record<string, { area: string; value: number }> = {};
    for (const meterId of Object.keys(this.METER_UNIT_MAP)) {
      const shortId = meterId.replace('_Del_ActiveEnergy', '');
      const apiValue = apiData[meterId] ?? apiData[shortId] ?? 0;

      realTimeValuesObj[meterId] = {
        area: lastDoc?.[meterId]?.area || 'unit4', // keep last area or default
        value: Math.round(apiValue * 100) / 100,
      };
    }

    // 4️⃣ Insert with upsert (only one cron doc per minute)
    const newDoc = await this.fieldMeterRawDataModel.findOneAndUpdate(
      { timestamp: timestamp15, source: 'cron' }, // unique condition
     
      {
        $setOnInsert: {
          ...realTimeValuesObj,
          timestamp: timestamp15,
          source: 'cron',
        },
      },
      { upsert: true, new: true }
    );

    // console.log(`✅ Cron insert complete for ${timestamp15.toISOString()}`);

    // After storing the real-time data, now call the calculateConsumption function
    await this.calculateConsumption(); // Calling calculateConsumption after storing data

    return newDoc;

  } catch (err) {
    console.error('❌ Cron error:', err.message);
  }
}


async calculateConsumption() {
  const meterKeys = [
    "U23_GW03_Del_ActiveEnergy",
    "U22_GW03_Del_ActiveEnergy",
    "U3_GW02_Del_ActiveEnergy",
    "U1_GW02_Del_ActiveEnergy",
    "U2_GW02_Del_ActiveEnergy",
    "U4_GW02_Del_ActiveEnergy",
  ];

  // 🔹 Last processDoc (for previous state of flatMeters)
  const prevProcessDoc = await this.fieldMeterProcessDataModel
    .findOne({})
    .sort({ timestamp: -1 });

  // 🔹 Latest rawDoc (toggle OR cron)
  const lastRawDoc = await this.fieldMeterRawDataModel
    .findOne({})
    .sort({ timestamp: -1 });

  if (!lastRawDoc) {
    console.log("⏹ No raw data found in field_meter_raw_data");
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
  // ✅ Step 1: Garbage / invalid value filter
    
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

    //  Step 2: Zero-to-first-value fix
    if (currentArea === "unit4" && prevFlatU4?.lV === 0 && currentValue > 0) {
        u4.fV = currentValue;
    }
    if (currentArea === "unit5" && prevFlatU5?.lV === 0 && currentValue > 0) {
        u5.fV = currentValue;
    }

// Calculate the consumption and cumulative consumption
    if (!prevProcessDoc) {
      // Initialize first-time data
      if (currentArea === "unit4") {
        u4 = { fV: currentValue, lV: currentValue, CONS: 0, cumulative_con: 0 };
        u5 = { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 }; // keep other empty
      } else if (currentArea === "unit5") {
        u5 = { fV: currentValue, lV: currentValue, CONS: 0, cumulative_con: 0 };
        u4 = { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };
      }
    } else {
      // Handle area toggle (change from unit4 to unit5 or vice versa)
      if (prevLastArea && prevLastArea !== currentArea) {
        // Reset previous area and calculate new values
        if (currentArea === "unit4") {
              // Finalize Unit_5 consumption
            u5.fV = prevFlatU5?.lV ?? u5.lV;
            u5.lV = currentValue;
            u5.CONS = u5.lV - u5.fV;
            u5.cumulative_con += u5.CONS  // Update cumulative consumption

            // Set FV for Unit_4 from the last value of Unit_5 (not currentValue)
            u4.fV = currentValue; // Set unit5's fV from unit4's last value (lV)
            u4.lV = currentValue; // Set unit5's last value (lV) to the current value
            u4.CONS = u4.lV - u4.fV; // Calculate consumption for unit5
            u4.cumulative_con += u4.CONS;

        } else if (currentArea === "unit5") {
            console.log("finalizing unit 4 and i am toggle to unit5 now");
            u4.fV = prevFlatU4?.lV ?? u4.lV; // Ensure fV for unit4 is the last value of unit4
            u4.lV = currentValue; // Set unit4's last value to current value
            u4.CONS = u4.lV - u4.fV; // Calculate consumption for unit4
            u4.cumulative_con += u4.CONS;

            // Set FV for Unit_5 from the last value of Unit_4 (not currentValue)
            u5.fV = currentValue; // Set unit5's fV from unit4's last value (lV)
            u5.lV = currentValue; // Set unit5's last value (lV) to the current value
            u5.CONS = u5.lV - u5.fV; // Calculate consumption for unit5
            u5.cumulative_con += u5.CONS;

        }
      } else {
        // 🔹 Same area update
        if (currentArea === "unit4") {
          u4.fV = prevFlatU4?.lV ?? u4.lV;
          u4.lV = currentValue;
          u4.CONS = currentValue - u4.fV;
          u4.cumulative_con += u4.CONS;

        } else if (currentArea === "unit5") {
          u5.fV = prevFlatU5?.lV ?? u5.lV;
          u5.lV = currentValue;
          u5.CONS = currentValue - u5.fV;
          u5.cumulative_con += u5.CONS;
        }
      }
    }

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
    { timestamp: adjustedTimestamp },   // ✅ yahan bhi
    { $set: orderedDoc },
    { upsert: true }
  );

  console.log("💾 Cron processDoc inserted successfully");
  console.log("📊 Final Consumption (cron):", JSON.stringify(flatMeters, null, 2));

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

  let u4 = prevFlatU4 ? { ...prevFlatU4 } : { fV: 0, lV: 0, CONS: 0 };
  let u5 = prevFlatU5 ? { ...prevFlatU5 } : { fV: 0, lV: 0, CONS: 0 };


  const lastLV = prevLastArea === "unit4" ? prevFlatU4?.lV : prevFlatU5?.lV;

    // ✅ Step 1: Garbage / invalid value filter
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

    // ✅ Step 2: Zero-to-first-value fix
    if (currentArea === "unit4" && prevFlatU4?.lV === 0 && currentValue > 0) {
        u4.fV = currentValue;
    }
    if (currentArea === "unit5" && prevFlatU5?.lV === 0 && currentValue > 0) {
        u5.fV = currentValue;
    }
  // First-time init
  if (!prevProcessDoc) {
    if (currentArea === "unit4") {
      u4 = { fV: currentValue, lV: currentValue, CONS: 0 , cumulative_con: 0};
      u5 = { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 }; // ensure other side stays empty
    } else if (currentArea === "unit5") {
      u5 = { fV: currentValue, lV: currentValue, CONS: 0, cumulative_con: 0 };
      u4 = { fV: 0, lV: 0, CONS: 0, cumulative_con: 0 };
    }
  } else {
    // 🔄 Toggle event
    if (prevLastArea && prevLastArea !== currentArea) {
      // If the area has changed, finalize the previous area’s consumption and reset FV for the new area
      if (currentArea === "unit4") {
        // Finalize Unit_5 consumption
        u5.fV = prevFlatU5?.lV ?? u5.lV;
        u5.lV = currentValue;
        u5.CONS = u5.lV - u5.fV;
        u5.cumulative_con += u5.CONS;  

        // Set FV for Unit_4 from the last value of Unit_5 (not currentValue)
        u4.fV = currentValue; // Set unit5's fV from unit4's last value (lV)
        u4.lV = currentValue; // Set unit5's last value (lV) to the current value
        u4.CONS = u4.lV - u4.fV; // Calculate consumption for unit5
        u4.cumulative_con += u4.CONS;

      } else if (currentArea === "unit5") {
                // Finalize Unit_4 consumption
            console.log("finalizing unit 4 and i am toggle to unit5 now");
            u4.fV = prevFlatU4?.lV ?? u4.lV; // Ensure fV for unit4 is the last value of unit4
            u4.lV = currentValue; // Set unit4's last value to current value
            u4.CONS = u4.lV - u4.fV; // Calculate consumption for unit4
            u4.cumulative_con += u4.CONS;

            // Set FV for Unit_5 from the last value of Unit_4 (not currentValue)
            u5.fV = currentValue; // Set unit5's fV from unit4's last value (lV)
            u5.lV = currentValue; // Set unit5's last value (lV) to the current value
            u5.CONS = u5.lV - u5.fV; // Calculate consumption for unit5
            u5.cumulative_con += u5.CONS; 
      }
    } else {
      // Same area update, calculate consumption as usual
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

  // Save into flatMeters
  flatMeters[`U4_${meterId}`] = u4;
  flatMeters[`U5_${meterId}`] = u5;
  flatMeters[`lastArea_${meterId}`] = currentArea;
}

const orderedDoc: Record<string, any> = {
  timestamp: adjustedTimestamp,
};

for (const meterId of meterKeys) {
  if (!flatMeters[`U4_${meterId}`]) continue;

  orderedDoc[`U4_${meterId}`] = flatMeters[`U4_${meterId}`];
  orderedDoc[`U5_${meterId}`] = flatMeters[`U5_${meterId}`];
  orderedDoc[`lastArea_${meterId}`] = flatMeters[`lastArea_${meterId}`];
}

await this.fieldMeterProcessDataModel.updateOne(
  { timestamp: adjustedTimestamp },
  { $set: orderedDoc },
  { upsert: true }
);

console.log("💾 New processDoc inserted successfully");
console.log("📊 Final Consumption (toggle):", JSON.stringify(flatMeters, null, 2));

return { data: flatMeters };
}

// Get total consumption sum (U4, U5, grand total)
// Get per-meter total consumption sum
async getMeterWiseConsumption() {
  try {
    
    // Run the aggregation query on the collection
    const result = await this.fieldMeterProcessDataModel.aggregate([
      // Step 1: Sort by timestamp to get the latest document
      {
        $sort: { timestamp: -1 } // Sorting by timestamp in descending order
      },
      // Step 2: Limit to only the most recent document
      {
        $limit: 1 // Only the most recent document
      },
      // Step 3: Project the fields you want to include in the output (cumulative_con for each meter)
      {
        $project: {
          _id: 0, // Exclude the _id field
          U4_U1_GW02_Del_ActiveEnergy: "$U4_U1_GW02_Del_ActiveEnergy.cumulative_con",
          U4_U22_GW03_Del_ActiveEnergy: "$U4_U22_GW03_Del_ActiveEnergy.cumulative_con",
          U4_U23_GW03_Del_ActiveEnergy: "$U4_U23_GW03_Del_ActiveEnergy.cumulative_con",
          U4_U2_GW02_Del_ActiveEnergy: "$U4_U2_GW02_Del_ActiveEnergy.cumulative_con",
          U4_U3_GW02_Del_ActiveEnergy: "$U4_U3_GW02_Del_ActiveEnergy.cumulative_con",
          U4_U4_GW02_Del_ActiveEnergy: "$U4_U4_GW02_Del_ActiveEnergy.cumulative_con",
          U5_U1_GW02_Del_ActiveEnergy: "$U5_U1_GW02_Del_ActiveEnergy.cumulative_con",
          U5_U22_GW03_Del_ActiveEnergy: "$U5_U22_GW03_Del_ActiveEnergy.cumulative_con",
          U5_U23_GW03_Del_ActiveEnergy: "$U5_U23_GW03_Del_ActiveEnergy.cumulative_con",
          U5_U2_GW02_Del_ActiveEnergy: "$U5_U2_GW02_Del_ActiveEnergy.cumulative_con",
          U5_U3_GW02_Del_ActiveEnergy: "$U5_U3_GW02_Del_ActiveEnergy.cumulative_con",
          U5_U4_GW02_Del_ActiveEnergy: "$U5_U4_GW02_Del_ActiveEnergy.cumulative_con"
        }
      }
    ]);

    // Check if we got any results
    if (result.length > 0) {
      return result[0]; // Return the first (and only) document as it's the most recent one
    }

    // If no results, return an empty object
    return {};

  } catch (err) {
    console.error("❌ Error in getMeterWiseConsumption:", err.message);
    return {};
  }
}







































}















