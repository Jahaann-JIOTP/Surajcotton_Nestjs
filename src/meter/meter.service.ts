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
  const { meterId, area, email, username } = dto;
  const now = new Date();

  if (!['unit4', 'unit5'].includes(area)) {
    return { message: `Invalid area: ${area}` };
  }

  const current = await this.toggleModel.findOne({ meterId });

  if (!current) {
    await this.toggleModel.create({ meterId, area, startDate: now });

    await this.configModel.create({
      meterId,
      area,
      email,
      username,
      assignedAt: now,
    });

    return { meterId, area, message: 'Initialized and activated.' };
  }

  if (current.area === area) {
    return { meterId, area, message: 'Already active in this area.' };
  }

  await this.historyModel.create({
    meterId,
    area: current.area,
    startDate: current.startDate,
    endDate: now,
  });

  current.area = area;
  current.startDate = now;
  await current.save();

  await this.configModel.create({
    meterId,
    area,
    email,
    username,
    assignedAt: now,
  });

  return { meterId, area, message: 'Toggled successfully.' };
}






  

async getLatestConfig() {
  try {
    const latestConfigs = await this.configModel.aggregate([
      // Sort newest to oldest
      { $sort: { assignedAt: -1 } },

      // Group by meterId (so we only keep latest per meter)
      {
        $group: {
          _id: '$meterId',
          meterId: { $first: '$meterId' },
          area: { $first: '$area' },
          email: { $first: '$email' },
          username: { $first: '$username' },
          assignedAt: { $first: '$assignedAt' }
        }
      },

      // ✅ Join with meter_toggle to check if still active
      {
        $lookup: {
          from: 'meter_toggle', // collection name in MongoDB
          localField: 'meterId',
          foreignField: 'meterId',
          as: 'toggleInfo'
        }
      },

      // Filter out those that have no toggle (i.e. are inactive)
      { $match: { toggleInfo: { $ne: [] } } },

      // Cleanup final output
      {
        $project: {
          _id: 0,
          meterId: 1,
          area: 1,
          email: 1,
          username: 1,
          assignedAt: 1
        }
      }
    ]);

    if (!latestConfigs || latestConfigs.length === 0) {
      return { message: 'No active meter configurations found.' };
    }

    return latestConfigs;
  } catch (err) {
    console.error('❌ Error fetching latest config:', err.message);
    return { message: 'Something went wrong' };
  }
}




}
