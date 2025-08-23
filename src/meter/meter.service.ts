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
private readonly METER_UNIT_MAP: Record<string, string[]> = {
  'U23_GW03_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U22_GW03_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U3_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U1_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U2_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
  'U4_GW02_Del_ActiveEnergy': ['Unit_4', 'Unit_5'],
};






async fetchAndStoreRealTime(body: { unit: string; meterIds: string[] }) {
  const { unit, meterIds } = body;

  const apiRes = await axios.get('http://13.234.241.103:1880/surajcotton');
  const apiData = apiRes.data;

  let realTimeValuesObj: Record<string, { area: string; value: number }> = {};

  for (const meterId of Object.keys(this.METER_UNIT_MAP)) {
    const shortId = meterId.replace('_Del_ActiveEnergy', '');
    const apiValue = apiData[meterId] ?? apiData[shortId] ?? 0;

    realTimeValuesObj[meterId] = {
      area: meterIds.includes(shortId) ? unit : 'Unit_4',
      value: Math.round(apiValue * 100) / 100,
    };
  }

    // 🔹 Step 1: timestamp banaya
  const timestampNow = new Date();
  timestampNow.setSeconds(0, 0); // seconds & ms zero to avoid duplicates

  // 🔹 Step 2: agar toggle se aaya hai to +1 second shift kar diya
  if (body?.unit) {
    timestampNow.setSeconds(timestampNow.getSeconds() + 1);
  }

  // ✅ Insert or update (upsert) toggle record
const newDoc = await this.fieldMeterRawDataModel.findOneAndUpdate(
  { timestamp: timestampNow, source: 'toggle' }, // unique condition
  {
    $setOnInsert: {
      ...realTimeValuesObj,
      timestamp: timestampNow,
      source: 'toggle',
    },
  },
  { upsert: true, new: true } // new: true => return the doc
);

return newDoc;
}




  




// 🔹 har 1 min baad yeh cron job chalegi
@Cron('0 */15 * * * *') 
 async calculateConsumption() {
  const meterKeys = [
    "U23_GW03_Del_ActiveEnergy",
    "U22_GW03_Del_ActiveEnergy",
    "U3_GW02_Del_ActiveEnergy",
    "U1_GW02_Del_ActiveEnergy",
    "U2_GW02_Del_ActiveEnergy",
    "U4_GW02_Del_ActiveEnergy",
  ];

  const prevProcessDoc = await this.fieldMeterProcessDataModel
    .findOne({})
    .sort({ timestamp: -1 });

  let processDoc = new this.fieldMeterProcessDataModel({ flatMeters: {} });

  // 🔹 Last raw doc (toggle OR cron, whichever latest is available)
  const lastRawDoc = await this.fieldMeterRawDataModel
    .findOne({})
    .sort({ timestamp: -1 });

  if (!lastRawDoc) {
    console.log("⏹ No raw data found in field_meter_raw_data");
    return { msg: "No raw data found" };
  }

  const allConsumption: Record<string, { activeArea: string; consumption: number }> = {};
  const flatMeters: Record<string, { fV: number; lV: number; CONS: number }> = {};

  for (const meterId of meterKeys) {
    const meterObj = lastRawDoc[meterId];
    if (!meterObj) continue;

    const currentArea = meterObj.area;
    const currentValue = meterObj.value;

    if (!prevProcessDoc || !prevProcessDoc.meters[meterId]) {
      // 🆕 First-time init
      processDoc.meters[meterId] = {
        Unit_4: { firstValue: currentValue, lastValue: currentValue, consumption: 0 },
        Unit_5: { firstValue: 0, lastValue: 0, consumption: 0 },
        lastArea: currentArea,
      };
    } else {
      const prevState = prevProcessDoc.meters[meterId];
      const prevArea = prevState.lastArea;

      processDoc.meters[meterId] = JSON.parse(JSON.stringify(prevState));

      // 🔄 Case 1: Toggle hua → existing logic
      if (prevArea !== currentArea && lastRawDoc.source === "toggle") {
        console.log(`🔄 TOGGLE: ${meterId} ${prevArea} → ${currentArea}`);

        processDoc.meters[meterId][prevArea].lastValue = currentValue;
        processDoc.meters[meterId][prevArea].consumption =
          currentValue - processDoc.meters[meterId][prevArea].firstValue;

        processDoc.meters[meterId][currentArea].firstValue = currentValue;
        processDoc.meters[meterId][currentArea].lastValue = currentValue;
        processDoc.meters[meterId][currentArea].consumption = 0;
      } else {
        // 🔄 Case 2: Cron doc aya (15 min interval)
        // Yahan firstValue = prevProcessDoc ka lastValue
        // aur lastValue = currentValue
        if (lastRawDoc.source === "cron") {
          const firstVal = prevState[meterObj.area].lastValue;
          processDoc.meters[meterId][currentArea].firstValue = firstVal;
          processDoc.meters[meterId][currentArea].lastValue = currentValue;
          processDoc.meters[meterId][currentArea].consumption = currentValue - firstVal;
        } else {
          // 🔄 Case 3: Same area + toggle record
          processDoc.meters[meterId][currentArea].lastValue = currentValue;
          processDoc.meters[meterId][currentArea].consumption =
            currentValue - processDoc.meters[meterId][currentArea].firstValue;
        }
      }

      processDoc.meters[meterId].lastArea = currentArea;
    }

    // Aggregate consumption
    allConsumption[meterId] = {
      activeArea: currentArea,
      consumption:
        processDoc.meters[meterId].Unit_4.consumption +
        processDoc.meters[meterId].Unit_5.consumption,
    };

    flatMeters[`U4_${meterId}`] = {
      fV: processDoc.meters[meterId].Unit_4.firstValue,
      lV: processDoc.meters[meterId].Unit_4.lastValue,
      CONS: processDoc.meters[meterId].Unit_4.consumption,
    };

    flatMeters[`U5_${meterId}`] = {
      fV: processDoc.meters[meterId].Unit_5.firstValue,
      lV: processDoc.meters[meterId].Unit_5.lastValue,
      CONS: processDoc.meters[meterId].Unit_5.consumption,
    };
  }

  // Save
  processDoc.flatMeters = flatMeters;
  processDoc.timestamp = lastRawDoc.timestamp; // ⏰ Save interval-wise timestamp
  await processDoc.save();

  console.log("💾 New processDoc inserted successfully");
  console.log("📊 Final Consumption:", JSON.stringify(flatMeters, null, 2));

  return { data: flatMeters };
}
async storeEvery15Minutes() {
  try {
    // 1️⃣ API call
    const apiRes = await axios.get('http://13.234.241.103:1880/surajcotton');
    const apiData = apiRes.data;

    // 2️⃣ Round current time to nearest 15-min slot
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

    // 4️⃣ Insert with upsert (only one cron doc per 15-min slot)
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
    return newDoc;

  } catch (err) {
    console.error('❌ Cron error:', err.message);
  }
}

//  async calculateConsumption() {
//   const meterKeys = [
//     "U23_GW03_Del_ActiveEnergy",
//     "U22_GW03_Del_ActiveEnergy",
//     "U3_GW02_Del_ActiveEnergy",
//     "U1_GW02_Del_ActiveEnergy",
//     "U2_GW02_Del_ActiveEnergy",
//     "U4_GW02_Del_ActiveEnergy",
//   ];

//   const prevProcessDoc = await this.fieldMeterProcessDataModel
//     .findOne({})
//     .sort({ timestamp: -1 });

//   let processDoc = new this.fieldMeterProcessDataModel({ flatMeters: {} });

//   // 🔹 Last raw doc (toggle OR cron, whichever latest is available)
//   const lastRawDoc = await this.fieldMeterRawDataModel
//     .findOne({})
//     .sort({ timestamp: -1 });

//   if (!lastRawDoc) {
//     console.log("⏹ No raw data found in field_meter_raw_data");
//     return { msg: "No raw data found" };
//   }

//   const allConsumption: Record<string, { activeArea: string; consumption: number }> = {};
//   const flatMeters: Record<string, { fV: number; lV: number; CONS: number }> = {};

//   for (const meterId of meterKeys) {
//     const meterObj = lastRawDoc[meterId];
//     if (!meterObj) continue;

//     const currentArea = meterObj.area;
//     const currentValue = meterObj.value;

//     if (!prevProcessDoc || !prevProcessDoc.meters[meterId]) {
//       // 🆕 First-time init
//       processDoc.meters[meterId] = {
//         Unit_4: { firstValue: currentValue, lastValue: currentValue, consumption: 0 },
//         Unit_5: { firstValue: 0, lastValue: 0, consumption: 0 },
//         lastArea: currentArea,
//       };
//     } else {
//       const prevState = prevProcessDoc.meters[meterId];
//       const prevArea = prevState.lastArea;

//       processDoc.meters[meterId] = JSON.parse(JSON.stringify(prevState));

//       // 🔄 Case 1: Toggle hua → existing logic
//       if (prevArea !== currentArea && lastRawDoc.source === "toggle") {
//         console.log(`🔄 TOGGLE: ${meterId} ${prevArea} → ${currentArea}`);

//         processDoc.meters[meterId][prevArea].lastValue = currentValue;
//         processDoc.meters[meterId][prevArea].consumption =
//           currentValue - processDoc.meters[meterId][prevArea].firstValue;

//         processDoc.meters[meterId][currentArea].firstValue = currentValue;
//         processDoc.meters[meterId][currentArea].lastValue = currentValue;
//         processDoc.meters[meterId][currentArea].consumption = 0;
//       } else {
//         // 🔄 Case 2: Cron doc aya (15 min interval)
//         // Yahan firstValue = prevProcessDoc ka lastValue
//         // aur lastValue = currentValue
//         if (lastRawDoc.source === "cron") {
//           const firstVal = prevState[meterObj.area].lastValue;
//           processDoc.meters[meterId][currentArea].firstValue = firstVal;
//           processDoc.meters[meterId][currentArea].lastValue = currentValue;
//           processDoc.meters[meterId][currentArea].consumption = currentValue - firstVal;
//         } else {
//           // 🔄 Case 3: Same area + toggle record
//           processDoc.meters[meterId][currentArea].lastValue = currentValue;
//           processDoc.meters[meterId][currentArea].consumption =
//             currentValue - processDoc.meters[meterId][currentArea].firstValue;
//         }
//       }

//       processDoc.meters[meterId].lastArea = currentArea;
//     }

//     // Aggregate consumption
//     allConsumption[meterId] = {
//       activeArea: currentArea,
//       consumption:
//         processDoc.meters[meterId].Unit_4.consumption +
//         processDoc.meters[meterId].Unit_5.consumption,
//     };

//     flatMeters[`U4_${meterId}`] = {
//       fV: processDoc.meters[meterId].Unit_4.firstValue,
//       lV: processDoc.meters[meterId].Unit_4.lastValue,
//       CONS: processDoc.meters[meterId].Unit_4.consumption,
//     };

//     flatMeters[`U5_${meterId}`] = {
//       fV: processDoc.meters[meterId].Unit_5.firstValue,
//       lV: processDoc.meters[meterId].Unit_5.lastValue,
//       CONS: processDoc.meters[meterId].Unit_5.consumption,
//     };
//   }

//   // Save
//   processDoc.flatMeters = flatMeters;
//   processDoc.timestamp = lastRawDoc.timestamp; // ⏰ Save interval-wise timestamp
//   await processDoc.save();

//   console.log("💾 New processDoc inserted successfully");
//   console.log("📊 Final Consumption:", JSON.stringify(flatMeters, null, 2));

//   return { data: flatMeters };
// }


/// for reports logic
 
















}














