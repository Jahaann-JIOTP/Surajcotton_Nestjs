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
  // if (body?.unit) {
  //   timestampNow.setSeconds(timestampNow.getSeconds() + 1);
  // }

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

  // 🔹 Last processed doc
  const prevProcessDoc = await this.fieldMeterProcessDataModel
    .findOne({})
    .sort({ timestamp: -1 });

  // 🔹 Latest rawDoc
  const lastRawDoc = await this.fieldMeterRawDataModel
    .findOne({})
    .sort({ timestamp: -1 });

  if (!lastRawDoc) {
    return { msg: "No raw data found" };
  }

  // ===========================================================
  // 🔹 CORE LOGIC FUNCTION (toggle + cron)
  // ===========================================================
  const processMeters = (
    rawDoc: any,
    prevProcessDoc: any,
    meterKeys: string[]
  ) => {
    const flatMeters: Record<string, any> = {};

    for (const meterId of meterKeys) {
      const meterObj = rawDoc[meterId];
      if (!meterObj) continue;

      const currentArea = meterObj.area; // "Unit_4" / "Unit_5"
      const currentValue = meterObj.value;

      const prevFlatU4 = prevProcessDoc?.[`U4_${meterId}`];
      const prevFlatU5 = prevProcessDoc?.[`U5_${meterId}`];

      let u4 = prevFlatU4 ? { ...prevFlatU4 } : { fV: 0, lV: 0, CONS: 0 };
      let u5 = prevFlatU5 ? { ...prevFlatU5 } : { fV: 0, lV: 0, CONS: 0 };

      // First time initialize
      if (!prevProcessDoc) {
        if (currentArea === "Unit_4") {
          u4 = { fV: currentValue, lV: currentValue, CONS: 0 };
        } else {
          u5 = { fV: currentValue, lV: currentValue, CONS: 0 };
        }
      } else {
        // Toggle logic
        if (currentArea === "Unit_4") {
          // Unit_4 freeze, Unit_5 update
          if (u5.fV === 0) u5.fV = currentValue;
          u5.lV = currentValue;
          u5.CONS = u5.lV - u5.fV;
          u4 = { ...u4 }; // freeze
        } else {
          // Unit_5 freeze, Unit_4 update
          if (u4.fV === 0) u4.fV = currentValue;
          u4.lV = currentValue;
          u4.CONS = u4.lV - u4.fV;
          u5 = { ...u5 }; // freeze
        }
      }

      flatMeters[`U4_${meterId}`] = u4;
      flatMeters[`U5_${meterId}`] = u5;
      flatMeters[`lastArea_${meterId}`] = currentArea;
    }

    return flatMeters;
  };

  // ===========================================================
  // 🔹 Totals with aggregation (no more double increment!)
  // ===========================================================
  const calculateTotals = async () => {
    const pipeline: any[] = [
      {
        $group: {
          _id: null,
          ...meterKeys.reduce((acc, meterId) => {
            acc[`total_U4_${meterId}`] = { $sum: `$U4_${meterId}.CONS` };
            acc[`total_U5_${meterId}`] = { $sum: `$U5_${meterId}.CONS` };
            return acc;
          }, {} as Record<string, any>),
        },
      },
    ];

    const result = await this.fieldMeterProcessDataModel.aggregate(pipeline);
    const totals = result[0] || {};

    // AllMeters sum
    totals["total_U4_AllMeters"] = Object.keys(totals)
      .filter((k) => k.startsWith("total_U4_") && k !== "total_U4_AllMeters")
      .reduce((acc, k) => acc + (totals[k] || 0), 0);

    totals["total_U5_AllMeters"] = Object.keys(totals)
      .filter((k) => k.startsWith("total_U5_") && k !== "total_U5_AllMeters")
      .reduce((acc, k) => acc + (totals[k] || 0), 0);

    return totals;
  };

  // ===========================================================
  // 🔹 CRON CASE
  // ===========================================================
  if (lastRawDoc.source === "cron") {
    const cronDocs = await this.fieldMeterRawDataModel
      .find({ source: "cron" })
      .sort({ timestamp: -1 })
      .limit(1)
      .lean();

    const latestCron = cronDocs[0];
    const flatMeters = processMeters(latestCron, prevProcessDoc, meterKeys);

    const orderedDoc: Record<string, any> = {
      timestamp: latestCron.timestamp,
      source: "cron",
    };
    for (const meterId of meterKeys) {
      orderedDoc[`U4_${meterId}`] = flatMeters[`U4_${meterId}`];
      orderedDoc[`U5_${meterId}`] = flatMeters[`U5_${meterId}`];
      orderedDoc[`lastArea_${meterId}`] = flatMeters[`lastArea_${meterId}`];
    }

    const totals = await calculateTotals();
    for (const key in totals) orderedDoc[key] = totals[key];

    await this.fieldMeterProcessDataModel.updateOne(
      { timestamp: latestCron.timestamp },
      { $set: orderedDoc },
      { upsert: true }
    );

    return { data: flatMeters, totals };
  }

  // ===========================================================
  // 🔹 TOGGLE CASE
  // ===========================================================
  const flatMeters = processMeters(lastRawDoc, prevProcessDoc, meterKeys);

  const orderedDoc: Record<string, any> = { timestamp: lastRawDoc.timestamp };
  for (const meterId of meterKeys) {
    orderedDoc[`U4_${meterId}`] = flatMeters[`U4_${meterId}`];
    orderedDoc[`U5_${meterId}`] = flatMeters[`U5_${meterId}`];
    orderedDoc[`lastArea_${meterId}`] = flatMeters[`lastArea_${meterId}`];
  }

  const totals = await calculateTotals();
  for (const key in totals) orderedDoc[key] = totals[key];

  await this.fieldMeterProcessDataModel.updateOne(
    { timestamp: lastRawDoc.timestamp },
    { $set: orderedDoc },
    { upsert: true }
  );

  return { data: flatMeters, totals };
}





































}














