import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Privelleges, PrivellegesDocument } from './schema/privelleges.schema';
import { RolesDocument } from 'src/roles/schema/roles.schema';
@Injectable()
export class PrivellegesService {
  constructor(
    @InjectModel('Privelleges')
    private readonly privellegesModel: Model<PrivellegesDocument>,
    @InjectModel('Roles')
    private readonly rolesModel: Model<RolesDocument>,
  ) {}

  async createPrivelleges(name: string): Promise<Privelleges> {
    const newPrivelleges = new this.privellegesModel({ name });
    return newPrivelleges.save();
  }

  async getAllPrivelleges(): Promise<Privelleges[]> {
    return this.privellegesModel.find().exec();
  }

  async getPrivellegesByIdAndUpdate(
    id: string,
    name: string,
  ): Promise<{ message: string }> {
    const privelleges = await this.privellegesModel
      .findByIdAndUpdate(id, { name }, { new: true })
      .exec();
    if (!privelleges) {
      throw new NotFoundException(`Privelleges with id ${id} not found`);
    }
    return { message: 'Privelleges updated successfully' };
  }

  async getPrivellegesByIdAndDelete(id: string): Promise<{ message: string }> {
    const result = await this.rolesModel.updateMany(
      { privileges: id },
      { $pull: { privileges: id } },
    );
    if (result.modifiedCount > 0) {
      console.log(
        `${result.modifiedCount} role(s) updated by removing privilege id ${id}`,
      );
    }

    const privelleges = await this.privellegesModel
      .findByIdAndDelete(id)
      .exec();
    if (!privelleges) {
      throw new NotFoundException(`Privelleges with id ${id} not found`);
    }
    return { message: 'Privelleges deleted successfully' };
  }
}
