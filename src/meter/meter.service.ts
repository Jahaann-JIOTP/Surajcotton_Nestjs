
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

  async toggleMeter(dto: ToggleMeterDto) {
    const { meterId, area, email, username } = dto;
    const now = new Date();

    if (!['unit4', 'unit5'].includes(area)) {
      return { message: `Invalid area: ${area}` };
    }

    const existing = await this.toggleModel.findOne({ meterId });

    if (!existing) {
      // ✅ First time create
      await this.toggleModel.create({
        meterId,
        area,
        startDate: now,
        endDate: now,
      });

      await this.configModel.create({
        meterId,
        area,
        email,
        username,
        assignedAt: now,
      });

      return { meterId, area, message: 'Initialized and activated.' };
    }

    if (existing.area === area) {
      return { meterId, area, message: 'Already active in this area.' };
    }

    // ✅ Update existing and save config
    existing.area = area;
    existing.startDate = now;
    existing.endDate = now;
    await existing.save();

    await this.configModel.create({
      meterId,
      area,
      email,
      username,
      assignedAt: now,
    });

    return { meterId, area, message: 'Toggled successfully.' };
  }

  async getAllToggleData() {
    try {
      const data = await this.toggleModel.find().lean();
      if (!data.length) {
        return { message: 'No toggle data found.' };
      }
      return data;
    } catch (error) {
      console.error('❌ Error fetching toggle data:', error.message);
      return { message: 'Something went wrong' };
    }
  }

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

////... These are the feild meter ids ...///
private readonly METER_UNIT_MAP: Record<string, string[]> = {
  'U23_GW03_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U22_GW03_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U3_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U1_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U2_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U4_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
};




/////..... this one logic for toggle area from unit 4 to unit 5...../////
// async fetchAndStoreRealTime(body: { unit: string; meterIds: string[] }) {
//   const { unit, meterIds } = body;

//   const apiRes = await axios.get('http://13.234.241.103:1880/surajcotton');
//   const apiData = apiRes.data;

//   let realTimeValuesObj: Record<string, { area: string; value: number }> = {};

//   for (const meterId of Object.keys(this.METER_UNIT_MAP)) {
//     const shortId = meterId.replace('_Del_ActiveEnergy', '');
//     const apiValue = apiData[meterId] ?? apiData[shortId] ?? 0;

//     realTimeValuesObj[meterId] = {
//       area: meterIds.includes(shortId) ? unit : 'Unit_4',
//       value: Math.round(apiValue * 100) / 100,
//     };
//   }

//     // 🔹 Step 1: timestamp banaya
//   const timestampNow = new Date();
//   timestampNow.setSeconds(0, 0); // seconds & ms zero to avoid duplicates

//   // 🔹 Step 2: agar toggle se aaya hai to +1 second shift kar diya
//   // if (body?.unit) {
//   //   timestampNow.setSeconds(timestampNow.getSeconds() + 1);
//   // }

//   // ✅ Insert or update (upsert) toggle record
// const newDoc = await this.fieldMeterRawDataModel.findOneAndUpdate(
//   { timestamp: timestampNow, source: 'toggle' }, // unique condition
//   {
//     $setOnInsert: {
//       ...realTimeValuesObj,
//       timestamp: timestampNow,
//       source: 'toggle',
//     },
//   },
//   { upsert: true, new: true } // new: true => return the doc
// );

// return newDoc;
// }
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
    const timestampNow = new Date();
    timestampNow.setSeconds(0, 0);

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
@Cron('0 */15 * * * *') 
async storeEvery15Minutes() {
  try {
    // 1️⃣ API call
    const apiRes = await axios.get('http://13.234.241.103:1880/surajcotton');
    const apiData = apiRes.data;

    // 2️⃣ Round current time to nearest 1-minute slot
    const now = new Date();
    const roundedMinutes = Math.floor(now.getMinutes() / 15) * 15;
    const timestamp15 = new Date(now);
    timestamp15.setMinutes(roundedMinutes, 0, 0); // seconds & ms = 0

    // 3️⃣ Check last doc
    const lastDoc = await this.fieldMeterRawDataModel.findOne().sort({ timestamp: -1 });

    const realTimeValuesObj: Record<string, { area: string; value: number }> = {};
    for (const meterId of Object.keys(this.METER_UNIT_MAP)) {
      const shortId = meterId.replace('_Del_ActiveEnergy', '');
      const apiValue = apiData[meterId] ?? apiData[shortId] ?? 0;

      realTimeValuesObj[meterId] = {
        area: lastDoc?.[meterId]?.area || 'Unit_4', // keep last area or default
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

    console.log(`✅ Cron insert complete for ${timestamp15.toISOString()}`);

    // After storing the real-time data, now call the calculateConsumption function
    await this.calculateConsumption(); // Calling calculateConsumption after storing data

    return newDoc;

  } catch (err) {
    console.error('❌ Cron error:', err.message);
  }
}

////....... thid one logic help to calculate consumption for cron and toggles docs and save consumption in process data....///////
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

  const flatMeters: Record<string, { fV: number; lV: number; CONS: number }> = {};

  for (const meterId of meterKeys) {
    const latestMeter = latestCron[meterId];
    if (!latestMeter) continue;

    const currentArea = latestMeter.area?.toLowerCase(); // ✅ normalize (unit4 / unit5)
    const currentValue = latestMeter.value;

    // 🔹 Fetch previous values
    const prevFlatU4 = prevProcessDoc?.[`U4_${meterId}`];
    const prevFlatU5 = prevProcessDoc?.[`U5_${meterId}`];
    const prevLastArea = prevProcessDoc?.[`lastArea_${meterId}`];

    let u4 = prevFlatU4 ? { ...prevFlatU4 } : { fV: 0, lV: 0, CONS: 0 };
    let u5 = prevFlatU5 ? { ...prevFlatU5 } : { fV: 0, lV: 0, CONS: 0 };

    // 🔹 First-time init
    if (!prevProcessDoc) {
      if (currentArea === "unit4") {
        u4 = { fV: currentValue, lV: currentValue, CONS: 0 };
        u5 = { fV: 0, lV: 0, CONS: 0 }; // keep other empty
      } else if (currentArea === "unit5") {
        u5 = { fV: currentValue, lV: currentValue, CONS: 0 };
        u4 = { fV: 0, lV: 0, CONS: 0 };
      }
    } else {
      // 🔹 Toggle detection
      if (prevLastArea && prevLastArea !== currentArea) {
        if (currentArea === "unit4") {
          // finalize Unit_5
          u5.lV = currentValue;
          u5.CONS = u5.lV - u5.fV;

          // reset Unit_4
          u4 = { fV: currentValue, lV: currentValue, CONS: 0 };
        } else if (currentArea === "unit5") {
          // finalize Unit_4
          u4.lV = currentValue;
          u4.CONS = u4.lV - u4.fV;

          // reset Unit_5
          u5 = { fV: currentValue, lV: currentValue, CONS: 0 };
        }
      } else {
        // 🔹 Same area update
        if (currentArea === "unit4") {
          u4.lV = currentValue;
          u4.CONS = currentValue - u4.fV;
        } else if (currentArea === "unit5") {
          u5.lV = currentValue;
          u5.CONS = currentValue - u5.fV;
        }
      }
    }

    // 🔹 Save into flatMeters
    flatMeters[`U4_${meterId}`] = u4;
    flatMeters[`U5_${meterId}`] = u5;
    flatMeters[`lastArea_${meterId}`] = currentArea;
  }

  // ✅ Save ordered doc
  const orderedDoc: Record<string, any> = {
    timestamp: latestCron.timestamp,
    source: "cron",
  };

  for (const meterId of meterKeys) {
    if (!flatMeters[`U4_${meterId}`]) continue;
    orderedDoc[`U4_${meterId}`] = flatMeters[`U4_${meterId}`];
    orderedDoc[`U5_${meterId}`] = flatMeters[`U5_${meterId}`];
    orderedDoc[`lastArea_${meterId}`] = flatMeters[`lastArea_${meterId}`];
  }

  await this.fieldMeterProcessDataModel.updateOne(
    { timestamp: latestCron.timestamp },
    { $set: orderedDoc },
    { upsert: true }
  );

  console.log("💾 Cron processDoc inserted successfully");
  console.log("📊 Final Consumption (cron):", JSON.stringify(flatMeters, null, 2));

  return { data: flatMeters };
}




  // --- TOGGLE CASE ---
  let processDoc = new this.fieldMeterProcessDataModel({});
  const flatMeters: Record<string, { fV: number; lV: number; CONS: number }> = {};

  for (const meterId of meterKeys) {
    const meterObj = lastRawDoc[meterId];
    if (!meterObj) continue;

    const currentArea = meterObj.area?.toLowerCase();// "Unit_4" / "Unit_5"
    const currentValue = meterObj.value;

    // Fetch previous values
    const prevFlatU4 = prevProcessDoc?.[`U4_${meterId}`];
    const prevFlatU5 = prevProcessDoc?.[`U5_${meterId}`];
    const prevLastArea = prevProcessDoc?.[`lastArea_${meterId}`];

    let u4 = prevFlatU4 ? { ...prevFlatU4 } : { fV: 0, lV: 0, CONS: 0 };
    let u5 = prevFlatU5 ? { ...prevFlatU5 } : { fV: 0, lV: 0, CONS: 0 };

    // First-time init
    if (!prevProcessDoc) {
  if (currentArea === "unit4") {
    u4 = { fV: currentValue, lV: currentValue, CONS: 0 };
    u5 = { fV: 0, lV: 0, CONS: 0 }; // ensure other side stays empty
  } else if (currentArea === "unit5") {
    u5 = { fV: currentValue, lV: currentValue, CONS: 0 };
    u4 = { fV: 0, lV: 0, CONS: 0 };
  }
} else {
      // 🔄 Toggle event
     if (prevLastArea && prevLastArea !== currentArea) {
  if (currentArea === "unit4") {
    // finalize Unit_5
    u5.lV = currentValue;
    u5.CONS = u5.lV - u5.fV;

    // reset Unit_4
    u4 = { fV: currentValue, lV: currentValue, CONS: 0 };
  } else if (currentArea === "unit5") {
    // finalize Unit_4
    u4.lV = currentValue;
    u4.CONS = u4.lV - u4.fV;

    // reset Unit_5
    u5 = { fV: currentValue, lV: currentValue, CONS: 0 };
  }
}


      // ➡ Same area update
      else {
        if (currentArea === "Unit_4") {
          u4.lV = currentValue;
          u4.CONS = currentValue - u4.fV;
        } else {
          u5.lV = currentValue;
          u5.CONS = currentValue - u5.fV;
        }
      }
    }

    // Save into flatMeters
    flatMeters[`U4_${meterId}`] = u4;
    flatMeters[`U5_${meterId}`] = u5;
    flatMeters[`lastArea_${meterId}`] = currentArea;
  }

  // ✅ Save ordered doc
  const orderedDoc: Record<string, any> = { timestamp: lastRawDoc.timestamp };

  for (const meterId of meterKeys) {
    if (!flatMeters[`U4_${meterId}`]) continue;

    orderedDoc[`U4_${meterId}`] = flatMeters[`U4_${meterId}`];
    orderedDoc[`U5_${meterId}`] = flatMeters[`U5_${meterId}`];
    orderedDoc[`lastArea_${meterId}`] = flatMeters[`lastArea_${meterId}`];
  }
  // ✨ ADD THIS after orderedDoc is filled in TOGGLE case
// const totals = updateTotals(flatMeters, prevProcessDoc, meterKeys);
// for (const key in totals) {
//   orderedDoc[key] = totals[key];
// }


  await this.fieldMeterProcessDataModel.updateOne(
    { timestamp: lastRawDoc.timestamp },
    { $set: orderedDoc },
    { upsert: true }
  );

  console.log("💾 New processDoc inserted successfully");
  console.log("📊 Final Consumption:", JSON.stringify(flatMeters, null, 2));

  return { data: flatMeters };
}


// Get total consumption sum (U4, U5, grand total)
// Get per-meter total consumption sum
async getMeterWiseConsumption() {
  try {
    const pipeline = [
      {
        $group: {
          _id: null,
          U4_U1_GW02_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U4_U1_GW02_Del_ActiveEnergy.CONS", 0] },
          },
          U4_U22_GW03_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U4_U22_GW03_Del_ActiveEnergy.CONS", 0] },
          },
          U4_U23_GW03_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U4_U23_GW03_Del_ActiveEnergy.CONS", 0] },
          },
          U4_U2_GW02_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U4_U2_GW02_Del_ActiveEnergy.CONS", 0] },
          },
          U4_U3_GW02_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U4_U3_GW02_Del_ActiveEnergy.CONS", 0] },
          },
          U4_U4_GW02_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U4_U4_GW02_Del_ActiveEnergy.CONS", 0] },
          },
          U5_U1_GW02_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U5_U1_GW02_Del_ActiveEnergy.CONS", 0] },
          },
          U5_U22_GW03_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U5_U22_GW03_Del_ActiveEnergy.CONS", 0] },
          },
          U5_U23_GW03_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U5_U23_GW03_Del_ActiveEnergy.CONS", 0] },
          },
          U5_U2_GW02_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U5_U2_GW02_Del_ActiveEnergy.CONS", 0] },
          },
          U5_U3_GW02_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U5_U3_GW02_Del_ActiveEnergy.CONS", 0] },
          },
          U5_U4_GW02_Del_ActiveEnergy: {
            $sum: { $ifNull: ["$U5_U4_GW02_Del_ActiveEnergy.CONS", 0] },
          },
        },
      },
      {
        $project: { _id: 0 },
      },
    ];

    const result = await this.fieldMeterProcessDataModel.aggregate(pipeline);
    return result.length ? result[0] : {};
  } catch (err) {
    console.error("❌ Error in getMeterWiseConsumption:", err.message);
    return {};
  }
}







































}














