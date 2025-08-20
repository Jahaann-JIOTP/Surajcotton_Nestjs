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

  // ✅ toggle insert ke liye source = 'toggle'
  const newDoc = await this.fieldMeterRawDataModel.create({
    ...realTimeValuesObj,
    timestamp: new Date(),
    source: 'toggle',
  });

  return newDoc;
}

// 🔹 har 5 min baad yeh cron job chalegi
@Cron('0 */15 * * * *') // har 2 minute me run
async storeEvery15Minutes() {
  try {
    // API call
    const apiRes = await axios.get('http://13.234.241.103:1880/surajcotton');
    const apiData = apiRes.data;

    // last document
    const lastDoc = await this.fieldMeterRawDataModel.findOne().sort({ timestamp: -1 });
    if (!lastDoc) {
      console.log('⏹ No previous document found, cron will insert first record');
    }

    const now = new Date();
    let skipCron = false;

    // check: agar last doc toggle se aaya aur abhi same minute me hai → skip
    if (lastDoc) {
      const lastTime = new Date(lastDoc.timestamp);
      const sameMinute =
        lastTime.getFullYear() === now.getFullYear() &&
        lastTime.getMonth() === now.getMonth() &&
        lastTime.getDate() === now.getDate() &&
        lastTime.getHours() === now.getHours() &&
        lastTime.getMinutes() === now.getMinutes() &&
        lastDoc.source === 'toggle';

      if (sameMinute) {
        skipCron = true;
      }
    }

    if (skipCron) {
      console.log('⏩ Cron skipped: toggle record already inserted this minute');
      return;
    }

    // prepare document
    const realTimeValuesObj: Record<string, { area: string; value: number }> = {};
    for (const meterId of Object.keys(this.METER_UNIT_MAP)) {
      const shortId = meterId.replace('_Del_ActiveEnergy', '');
      const apiValue = apiData[meterId] ?? apiData[shortId] ?? 0;

      realTimeValuesObj[meterId] = {
        area: lastDoc?.[meterId]?.area || 'Unit_4', // last area use karo
        value: Math.round(apiValue * 100) / 100,
      };
    }

    // insert document with source = 'cron'
    await this.fieldMeterRawDataModel.create({
      ...realTimeValuesObj,
      timestamp: now,
      source: 'cron',
    });

    console.log('✅ Cron 2-min insert complete');
  } catch (err) {
    console.error('❌ Cron error:', err.message);
  }
}

/// for reports logic
async calculateConsumption() {
  const meterKeys = [
    "U23_GW03_Del_ActiveEnergy",
    "U22_GW03_Del_ActiveEnergy",
    "U3_GW02_Del_ActiveEnergy",
    "U1_GW02_Del_ActiveEnergy",
    "U2_GW02_Del_ActiveEnergy",
    "U4_GW02_Del_ActiveEnergy",
  ];

  // 🔹 Pichla process doc (toggle detection ke liye)
  const prevProcessDoc = await this.fieldMeterProcessDataModel
    .findOne({})
    .sort({ createdAt: -1 });

  // 🔹 Har call pe naya doc banao (insert only)
  let processDoc = new this.fieldMeterProcessDataModel({ meters: {} });

  const lastRawDoc = await this.fieldMeterRawDataModel
    .findOne({ source: "toggle" })
    .sort({ timestamp: -1 });

  if (!lastRawDoc) {
    console.log("⏹ No toggle data found in field_meter_raw_data");
    return { msg: "No toggle data found" };
  }

  console.log("📌 Last Raw Toggle Doc:", JSON.stringify(lastRawDoc, null, 2));

  const allConsumption: Record<
    string,
    { activeArea: string; consumption: number }
  > = {};

  for (const meterId of meterKeys) {
    const meterObj = lastRawDoc[meterId];
    if (!meterObj) continue;

    const currentArea = meterObj.area; // "Unit_4" / "Unit_5"
    const currentValue = meterObj.value;

    // 🆕 First time init
    if (!prevProcessDoc || !prevProcessDoc.meters[meterId]) {
      processDoc.meters[meterId] = {
        Unit_4: { firstValue: 0, lastValue: 0, consumption: 0 },
        Unit_5: { firstValue: 0, lastValue: 0, consumption: 0 },
        lastArea: currentArea,
      };

      processDoc.meters[meterId][currentArea].firstValue = currentValue;
      processDoc.meters[meterId][currentArea].lastValue = currentValue;
      // processDoc.meters[meterId][currentArea].consumption = 0;

      console.log(`🆕 Init meter ${meterId} at ${currentArea} = ${currentValue}`);
    } else {
      // 🔹 Pichle state lo
      const prevState = prevProcessDoc.meters[meterId];
      const prevArea = prevState.lastArea;

      // Purana copy kar lo
      processDoc.meters[meterId] = JSON.parse(JSON.stringify(prevState));

      if (prevArea !== currentArea) {
        console.log(`🔄 TOGGLE: ${meterId} ${prevArea} → ${currentArea}`);

        // ✅ Toggle hone par naye area ka firstValue = prev doc ka lastValue
        processDoc.meters[meterId][currentArea].firstValue =
          prevState[prevArea].lastValue;

        processDoc.meters[meterId][currentArea].lastValue = currentValue;
        processDoc.meters[meterId][currentArea].consumption =
          currentValue - processDoc.meters[meterId][currentArea].firstValue;

        // Inactive area ka consumption reset
        // processDoc.meters[meterId][prevArea].consumption = 0;
      } else {
        // ✅ Same area, continue values
        processDoc.meters[meterId][currentArea].lastValue = currentValue;
        processDoc.meters[meterId][currentArea].consumption =
          currentValue - processDoc.meters[meterId][currentArea].firstValue;

        // Dusre area ka consumption hamesha 0
        const otherArea = currentArea === "Unit_4" ? "Unit_5" : "Unit_4";
        processDoc.meters[meterId][otherArea].consumption = 0;
      }

      processDoc.meters[meterId].lastArea = currentArea;
    }

    // ✅ Aggregation
    allConsumption[meterId] = {
      activeArea: currentArea,
      consumption: processDoc.meters[meterId][currentArea].consumption,
    };

    console.log(
      `✅ ${meterId} | Active: ${currentArea} | Consumption: ${allConsumption[meterId].consumption}`
    );
  }

  // 🔹 Always insert
  await processDoc.save();
  console.log("💾 New processDoc inserted successfully");
  console.log("📊 Final Consumption:", JSON.stringify(allConsumption, null, 2));

  return { data: allConsumption };
}













}














