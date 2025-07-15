import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MeterToggle, MeterToggleDocument } from './schemas/meter-toggle.schema';
// import { MeterHistory, MeterHistoryDocument } from './schemas/meter-history.schema';
import { MeterConfiguration, MeterConfigurationDocument } from './schemas/meter-configuration.schema';
// import { Roles, RolesDocument } from '../roles/schema/roles.schema';
import { ToggleMeterDto } from './dto/toggle-meter.dto';
// import { Roles, RolesDocument } from '../roles/schema/roles.schema'; // adjust the path if needed


@Injectable()
export class MeterService {
  constructor(
    @InjectModel(MeterToggle.name, 'surajcotton') private readonly toggleModel: Model<MeterToggleDocument>,
    // @InjectModel(MeterHistory.name, 'surajcotton') private readonly historyModel: Model<MeterHistoryDocument>,
      @InjectModel(MeterConfiguration.name, 'surajcotton') private readonly configModel: Model<MeterConfigurationDocument>,
//    @InjectModel(Roles.name, 'surajcotton')
// private readonly rolesModel: Model<RolesDocument>

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

  await this.toggleModel.create({
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

async getAllToggleData() {
  try {
    const data = await this.toggleModel.find().lean(); // use lean() for plain JS objects
    if (!data || data.length === 0) {
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
      .sort({ assignedAt: -1 }) // Optional: latest entries on top
      .lean();

    if (!configs || configs.length === 0) {
      return { message: 'No configurations found.' };
    }

    return configs;
  } catch (err) {
    console.error('❌ Error fetching configs:', err.message);
    return { message: 'Something went wrong' };
  }
}




}
