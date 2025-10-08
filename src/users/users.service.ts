/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Users, UsersDocument } from './schema/users.schema';
import { Roles, RolesDocument } from '../roles/schema/roles.schema';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  async registerUser(email: string, hashedPassword: string): Promise<Users> {
    const newUser = new this.userModel({ email, password: hashedPassword });
    return newUser.save();
    
  }
  constructor(
    @InjectModel(Users.name, 'usdenim') private userModel: Model<UsersDocument>,
    @InjectModel(Roles.name, 'usdenim') private readonly roleModel: Model<RolesDocument>,
  ) {}

  async addUser(
  name: string,
  email: string,
  password: string,
  roleId: string,
 createdBy?: string
): Promise<Users> {
    // Check if user already exists
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    // Validate role ID format
    if (!Types.ObjectId.isValid(roleId)) {
      throw new BadRequestException('Invalid role ID format');
    }

    // Check if role exists
    const role = await this.roleModel.findById(roleId);
    if (!role) {
      throw new BadRequestException('Role not found');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save user
    const newUser = new this.userModel({
      name,
      email,
      password: hashedPassword,
      role: role._id, // store ObjectId reference
      createdBy: createdBy ? new Types.ObjectId(createdBy) : null,
    });

    return newUser.save();
  }

  // async findAll(): Promise<Users[]> {
  //   const users = await this.userModel
  //     .find()
  //     .populate({
  //       path: 'role',
  //       populate: {
  //         path: 'privelleges', // populate inside role
  //       },
  //     })
  //     .exec();

  //   if (!users) throw new NotFoundException('User not found');
  //   return users;
  // }
// users.service.ts
async findAll(currentUser: any): Promise<Users[]> {
  const userId = currentUser._id || currentUser.sub || currentUser.userId;

  const user = await this.userModel.findById(userId).populate('role');
  if (!user) {
    throw new Error('User not found');
  }

  const roleName = (user.role as any)?.name;

  if (roleName === 'super_admin') {
    // ✅ Show ALL users
    return this.userModel.find().populate('role').lean();
  } else if (roleName === 'admin') {
  // ✅ Admin can see only observer/operator + themselves
  const allowedRoles = await this.roleModel
    .find({ name: { $in: ['observer', 'operator'] } }, '_id')
    .lean();

  const allowedRoleIds = allowedRoles.map(r => r._id);

  return this.userModel
    .find({
      $or: [
        { role: { $in: allowedRoleIds } },        // ✅ observer/operator
        { _id: user._id },                         // ✅ also include own record
      ],
    })
    .populate('role')
    .lean();
}

  else {
    // ❌ Other users see nothing (or just themselves)
    return [];
  }
}





  async findById(id: string): Promise<Users> {
    const user = await this.userModel
      .findById(id)
      .populate({
        path: 'role',
        populate: {
          path: 'privelleges', // populate inside role
        },
      })
      .exec();

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string): Promise<Users | null> {
    return this.userModel.findOne({ email }).exec();
  }



async updateUser(id: string, updates: Partial<Users> & { roleId?: string }): Promise<{ message: string }> {
  // If roleId is passed, map it to updates.role
  if (updates.roleId) {
    if (!Types.ObjectId.isValid(updates.roleId)) {
      throw new BadRequestException('Invalid role ID format');
    }

    const roleExists = await this.roleModel.exists({ _id: updates.roleId });
    if (!roleExists) {
      throw new BadRequestException(`Role with ID does not exist`);
    }

    updates.role = new Types.ObjectId(updates.roleId); // assign valid ObjectId
    delete updates.roleId; // clean up extra field
  }

  // Hash password if present
  if (updates.password) {
    const salt = await bcrypt.genSalt();
    updates.password = await bcrypt.hash(updates.password, salt);
  }

  const updated = await this.userModel.findByIdAndUpdate(id, updates, { new: true }).exec();

  if (!updated) {
    throw new NotFoundException('User not found');
  }

  return { message: `User Updated Successfully` };
}




  async deleteUser(_id: string): Promise<{ message: string }> {
    const result = await this.userModel.findByIdAndDelete(_id).exec();
    if (!result) throw new NotFoundException('User not found');
    return { message: `User Deleted` };
  }
}
