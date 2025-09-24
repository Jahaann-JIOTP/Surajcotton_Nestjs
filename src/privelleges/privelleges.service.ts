import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Privelleges, PrivellegesDocument } from './schema/privelleges.schema';
import { RolesDocument } from 'src/roles/schema/roles.schema';
import { Users, UsersDocument } from 'src/users/schema/users.schema';

@Injectable()
export class PrivellegesService {
  // constructor(
  //   @InjectModel('Privelleges')
  //   private readonly privellegesModel: Model<PrivellegesDocument>,
  //   @InjectModel('Roles')
  //   private readonly rolesModel: Model<RolesDocument>,
  // ) {}
constructor(
  @InjectModel('Privelleges', 'surajcotton')
  private readonly privellegesModel: Model<PrivellegesDocument>,

  @InjectModel('Users', 'surajcotton')
  private readonly usersModel: Model<UsersDocument>,

  @InjectModel('Roles', 'surajcotton')
  private readonly rolesModel: Model<RolesDocument>,
) {}


  async createPrivelleges(name: string): Promise<Privelleges> {
    const newPrivelleges = new this.privellegesModel({ name });
    return newPrivelleges.save();
  }

  async getAllPrivelleges(currentUser: any): Promise<Privelleges[]> {
  const userId = currentUser._id || currentUser.sub || currentUser.userId;

  const user = await this.usersModel.findById(userId).populate('role');
  if (!user) {
    throw new Error('User not found');
  }

  const role = user.role as any;

  if (!role?.name) {
    throw new Error('User role not found');
  }

  if (role.name === 'super_admin') {
    // ✅ Super admin can access all privileges
    return this.privellegesModel.find().exec();
  }

  // ✅ Admin only sees privileges linked to allowed roles (like observer, operator)
  const allowedRoles = await this.rolesModel.find({
    name: { $in: ['observer', 'operator', role.name] }, // also include their own
  }).populate('privelleges');

  // Extract and flatten privileges
  const allPrivileges = allowedRoles.flatMap(role => role.privelleges);

  // Remove duplicates using Set
  const unique = new Map();
  allPrivileges.forEach((priv: any) => {
    if (priv && priv._id) {
      unique.set(priv._id.toString(), priv);
    }
  });

  return Array.from(unique.values());
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
      // console.log(
      //   `${result.modifiedCount} role(s) updated by removing privilege id ${id}`,
      // );
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
