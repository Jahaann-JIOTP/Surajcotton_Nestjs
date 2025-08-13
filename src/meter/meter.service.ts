import { Injectable} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeterToggle, MeterToggleDocument } from './schemas/meter-toggle.schema';
import { MeterConfiguration, MeterConfigurationDocument } from './schemas/meter-configuration.schema';
import { ToggleMeterDto } from './dto/toggle-meter.dto';
import { FieldMeterRawData } from './schemas/field-meter-raw-data.schema';

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



// ✅ API se realtime data fetch karna aur DB me store karna
async fetchAndStoreRealTime(body: { unit: string; meterIds: string[] }) {
  const { unit, meterIds } = body;

  // Object to store all meter data
  const realTimeValuesObj: Record<string, { area: string; value: number }> = {};

  // Populate with real-time values (yahan aap API call kar sakte ho)
  for (const meterId of meterIds) {
    const value = Math.random() * 100; // Replace with actual real-time value
    realTimeValuesObj[meterId] = { area: unit, value };
  }

  // Save in DB in a single document
  // Filter empty {} ensures first document is created or updated
  const existing = await this.fieldMeterRawDataModel.findOne();

  if (existing) {
    // Update existing document
    await this.fieldMeterRawDataModel.updateOne(
      { _id: existing._id },
      { $set: { ...realTimeValuesObj, timestamp: new Date() } }
    );
  } else {
    // Create new document
    await this.fieldMeterRawDataModel.create({
      ...realTimeValuesObj,
      timestamp: new Date(),
    });
  }

  // Return same object
  return realTimeValuesObj;
}






}





