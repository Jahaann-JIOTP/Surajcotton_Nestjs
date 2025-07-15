import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeterToggle, MeterToggleDocument } from './schemas/meter-toggle.schema';
import { MeterHistory, MeterHistoryDocument } from './schemas/meter-history.schema';
import { MeterConfiguration, MeterConfigurationDocument } from './schemas/meter-configuration.schema';
// import { Roles, RolesDocument } from '../roles/schema/roles.schema';
import { ToggleMeterDto } from './dto/toggle-meter.dto';

@Injectable()
export class MeterService {
  constructor(
    @InjectModel(MeterToggle.name, 'surajcotton') private readonly toggleModel: Model<MeterToggleDocument>,
    @InjectModel(MeterHistory.name, 'surajcotton') private readonly historyModel: Model<MeterHistoryDocument>,
      @InjectModel(MeterConfiguration.name, 'surajcotton') private readonly configModel: Model<MeterConfigurationDocument> // ✅ Correct declaration
  ) {}

    // @InjectModel(Roles.name, 'surajcotton')private readonly Model: Model<RolesDocument>



async toggleMeter(dto: ToggleMeterDto) {
  const { area, email, username } = dto;
  const now = new Date();

  // ✅ Same meters for both areas
  const meterIds = ["U1_PLC", "U2_PLC", "U3_PLC", "U4_PLC", "U5_PLC", "U6_PLC"];

  if (!['unit4', 'unit5'].includes(area)) {
    return { message: `Invalid area: ${area}` };
  }

  const results: { meterId: string; message: string }[] = [];

  for (const meterId of meterIds) {
    const current = await this.toggleModel.findOne({ meterId });

    if (!current) {
      // First-time initialization
      await this.toggleModel.create({ meterId, area, startDate: now });

      await this.configModel.create({
        meterId,
        area,
        email,
        username,
        assignedAt: now,
      });

      results.push({ meterId, message: 'Initialized and activated.' });
      continue;
    }

    if (current.area === area) {
      // Already in this area, no action
      results.push({ meterId, message: 'Already active in this area.' });
      continue;
    }

    // Save history before switching
    await this.historyModel.create({
      meterId,
      area: current.area,
      startDate: current.startDate,
      endDate: now,
    });

    // Update toggle to new area
    current.area = area;
    current.startDate = now;
    await current.save();

    // Log config entry
    await this.configModel.create({
      meterId,
      area,
      email,
      username,
      assignedAt: now,
    });

    results.push({ meterId, message: 'Toggled successfully.' });
  }

  return { message: 'Toggling complete.', results };
}




  

async getLatestConfig() {
    try {
      const latest = await this.configModel
        .findOne()
        .sort({ createdAt: -1 })
        .lean();

      if (!latest) {
        return { message: 'No configuration found.' };
      }

      return latest;
    } catch (err) {
      console.error('❌ Error fetching latest config:', err.message);
      return { message: 'Something went wrong' };
    }
  }


}
