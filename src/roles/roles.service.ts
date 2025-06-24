/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Roles, RolesDocument } from './schema/roles.schema';
import { UsersDocument } from 'src/users/schema/users.schema';
import { PrivellegesDocument } from 'src/privelleges/schema/privelleges.schema';
@Injectable()
export class RolesService {
  findByName: any;
  // constructor(
  //   @InjectModel('Roles')
  //   private readonly rolesModel: Model<RolesDocument>,
  //   @InjectModel('Users')
  //   private readonly usersModel: Model<UsersDocument>,
  //   @InjectModel('Privelleges')
  //   private readonly privellegesModel: Model<PrivellegesDocument>,
  // ) {}

  constructor(
  @InjectModel('Roles', 'surajcotton')
  private readonly rolesModel: Model<RolesDocument>,

  @InjectModel('Users', 'surajcotton')
  private readonly usersModel: Model<UsersDocument>,

  @InjectModel('Privelleges', 'surajcotton')
  private readonly privellegesModel: Model<PrivellegesDocument>,
) {}


  async createRole(name: string): Promise<Roles> {
    const newRole = new this.rolesModel({ name });
    return newRole.save();
  }

  async getAllRoles(): Promise<Roles[]> {
    return this.rolesModel.find().exec();
  }
  async getRoleByIdAndUpdate(
    id: string,
    name: string,
  ): Promise<{ message: string }> {
    const usersWithRole = await this.usersModel.countDocuments({ role: id });
    if (usersWithRole > 0) {
      throw new NotFoundException(
        `Cannot delete role. ${usersWithRole} user(s) are using this role.`,
      );
    }
    const role = await this.rolesModel
      .findByIdAndUpdate(id, { name }, { new: true })
      .exec();
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return { message: 'Role updated successfully' };
  }
  async getRoleByIdAndDelete(id: string): Promise<{ message: string }> {
    await this.usersModel.updateMany({ role: id }, { $unset: { role: '' } });
    const privelleges = await this.rolesModel.findByIdAndDelete(id).exec();
    if (!privelleges) {
      throw new NotFoundException(`Roles with id ${id} not found`);
    }
    return { message: 'Roles deleted successfully' };
  }

  async editRolePrivilegesById(
    roleId: string,
    privilegeIds: string[],
  ): Promise<Roles> {
    // Validate role ID
    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('Invalid role ID format');
    }

    // Validate each privilege ID format
    for (const id of privilegeIds) {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(`Invalid privilege ID format: ${id}`);
      }
    }

    // Find role
    const role = await this.rolesModel.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    // Find all matching privileges by ID
    const privileges = await this.privellegesModel.find({
      _id: { $in: privilegeIds },
    });

    if (privileges.length !== privilegeIds.length) {
      throw new BadRequestException('One or more privileges not found');
    }

    // Assign privilege ObjectIds to the role
    role.privelleges = privileges.map((p) => p._id);
    return role.save();
  }
  async removePrivilegeFromRoleById(
    roleId: string,
    privilegeId: string,
  ): Promise<Roles> {
    const role = await this.rolesModel.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const privilegeObjectId = new Types.ObjectId(privilegeId);

    // Filter out the privilege to be removed
    role.privelleges = role.privelleges.filter(
      (pId: Types.ObjectId) => !pId.equals(privilegeObjectId),
    );

    return role.save();
  }
  async removeMultiplePrivilegesFromRole(
    roleId: string,
    privilegeIds: string[],
  ): Promise<Roles> {
    const role = await this.rolesModel.findById(roleId);
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const objectIdsToRemove = privilegeIds.map((id) => new Types.ObjectId(id));

    // Filter out all matching privilege IDs
    role.privelleges = role.privelleges.filter(
      (pId: Types.ObjectId) =>
        !objectIdsToRemove.some((removeId) => removeId.equals(pId)),
    );

    return role.save();
  }
}
