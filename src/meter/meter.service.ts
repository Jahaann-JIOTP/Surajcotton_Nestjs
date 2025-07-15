import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeterToggle, MeterToggleDocument } from './schemas/meter-toggle.schema';
import { MeterHistory, MeterHistoryDocument } from './schemas/meter-history.schema';
// import { Roles, RolesDocument } from '../roles/schema/roles.schema';
import { ToggleMeterDto } from './dto/toggle-meter.dto';

@Injectable()
export class MeterService {
  constructor(
    @InjectModel(MeterToggle.name, 'surajcotton') private readonly toggleModel: Model<MeterToggleDocument>,
    @InjectModel(MeterHistory.name, 'surajcotton') private readonly historyModel: Model<MeterHistoryDocument>,
    // @InjectModel(Roles.name, 'surajcotton')private readonly Model: Model<RolesDocument>

  ) {}

  async toggleMeter(dto: ToggleMeterDto) {
    const { meterId, area } = dto;
    const now = new Date();

    const current = await this.toggleModel.findOne({ meterId });

    if (!current) {
      // First time setup
      await this.toggleModel.create({ meterId, area, startDate: now });
      return { message: 'Meter initialized and activated.' };
    }

    if (current.area === area) {
      return { message: 'Meter is already active in this area.' };
    }

    // Save previous session to history
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

    return { message: 'Meter toggled successfully.' };
  }

  async getMeterStatus(meterId: string) {
    const meter = await this.toggleModel.findOne({ meterId });

    if (!meter) {
      return { message: 'Meter not found.' };
    }

    return {
      meterId: meter.meterId,
      area: meter.area,
      startDate: meter.startDate,
    };
  }
}
