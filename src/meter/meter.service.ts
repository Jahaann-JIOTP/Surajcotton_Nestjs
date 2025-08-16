import { Injectable} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeterToggle, MeterToggleDocument } from './schemas/meter-toggle.schema';
import { MeterConfiguration, MeterConfigurationDocument } from './schemas/meter-configuration.schema';
import { ToggleMeterDto } from './dto/toggle-meter.dto';
import { FieldMeterRawData } from './schemas/field-meter-raw-data.schema';
import axios from 'axios';


@Injectable()
export class MeterService {
  constructor(
    @InjectModel(MeterToggle.name, 'surajcotton') private readonly toggleModel: Model<MeterToggleDocument>,
    @InjectModel(MeterConfiguration.name, 'surajcotton') private readonly configModel: Model<MeterConfigurationDocument>,
      
  private readonly httpService: HttpService,
  @InjectModel(FieldMeterRawData.name, 'surajcotton') private fieldMeterRawDataModel: Model<FieldMeterRawData>,
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

  // --- Step 1: API call karke realtime data lao
  const apiRes = await axios.get("http://13.234.241.103:1880/surajcotton");
  const apiData = apiRes.data;

  // --- Step 2: Ek hi object prepare karo (all meters data inside one doc)
  let realTimeValuesObj: Record<string, { area: string; value: number }> = {};

  for (const meterId of Object.keys(this.METER_UNIT_MAP)) {
    const shortId = meterId.replace("_Del_ActiveEnergy", "");

    const apiValue = apiData[meterId] ?? apiData[shortId] ?? 0;

    realTimeValuesObj[meterId] = {
      area: meterIds.includes(shortId) ? unit : "Unit_4",
      value: Math.round(apiValue * 100) / 100,
    };
  }

  // --- Step 3: Last saved doc le aao
  const lastDoc = await this.fieldMeterRawDataModel
    .findOne()
    .sort({ timestamp: -1 });

  if (!lastDoc) {
    // ❌ Pehla doc hi nahi hai → new insert
    const newDoc = await this.fieldMeterRawDataModel.create({
      ...realTimeValuesObj,
      timestamp: new Date(),
    });
    return newDoc;
  }

  // --- Step 4: Check if koi bhi meter ka area change hua hai
  let areaChanged = false;
  for (const meterId of Object.keys(realTimeValuesObj)) {
    if (
      lastDoc[meterId]?.area &&
      lastDoc[meterId].area !== realTimeValuesObj[meterId].area
    ) {
      areaChanged = true;
      break;
    }
  }

  if (areaChanged) {
    // ✅ Agar area change hua → NEW document insert
    const newDoc = await this.fieldMeterRawDataModel.create({
      ...realTimeValuesObj,
      timestamp: new Date(),
    });
    return newDoc;
  } else {
    // ✅ Agar same area hai → Update existing doc
    await this.fieldMeterRawDataModel.updateOne(
      { _id: lastDoc._id },
      { $set: { ...realTimeValuesObj, timestamp: new Date() } }
    );
    return { ...lastDoc.toObject(), ...realTimeValuesObj };
  }
}



}





