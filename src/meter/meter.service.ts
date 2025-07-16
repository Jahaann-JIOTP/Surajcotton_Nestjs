import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeterToggle, MeterToggleDocument } from './schemas/meter-toggle.schema';
import { MeterConfiguration, MeterConfigurationDocument } from './schemas/meter-configuration.schema';
import { ToggleMeterDto } from './dto/toggle-meter.dto';

@Injectable()
export class MeterService {
  constructor(
    @InjectModel(MeterToggle.name, 'surajcotton') private readonly toggleModel: Model<MeterToggleDocument>,
    @InjectModel(MeterConfiguration.name, 'surajcotton') private readonly configModel: Model<MeterConfigurationDocument>
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
      const latestConfigs = await this.configModel.aggregate([
        { $sort: { assignedAt: -1 } },
        {
          $group: {
            _id: '$meterId',
            meterId: { $first: '$meterId' },
            area: { $first: '$area' },
            email: { $first: '$email' },
            username: { $first: '$username' },
            assignedAt: { $first: '$assignedAt' },
          }
        },
        {
          $lookup: {
            from: 'meter_toggle',
            localField: 'meterId',
            foreignField: 'meterId',
            as: 'toggleInfo'
          }
        },
        { $match: { toggleInfo: { $ne: [] } } },
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

      if (!latestConfigs.length) {
        return { message: 'No active meter configurations found.' };
      }

      return latestConfigs;
    } catch (err) {
      console.error('❌ Error fetching config:', err.message);
      return { message: 'Something went wrong' };
    }
  }
}
