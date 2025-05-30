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
    @InjectModel(Users.name) private userModel: Model<UsersDocument>,
    @InjectModel(Roles.name) private readonly roleModel: Model<RolesDocument>,
  ) {}

  async addUser(
    name: string,
    email: string,
    password: string,
    roleId: string, // changed from roleName to roleId
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
    });

    return newUser.save();
  }

  async findAll(): Promise<Users[]> {
    const users = await this.userModel
      .find()
      .populate({
        path: 'role',
        populate: {
          path: 'privelleges', // populate inside role
        },
      })
      .exec();

    if (!users) throw new NotFoundException('User not found');
    return users;
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

  async updateUser(
    id: string,
    updates: Partial<Users>,
  ): Promise<{ message: string }> {
    // Validate the role ID if provided
    if (updates.role) {
      if (!Types.ObjectId.isValid(updates.role.toString())) {
        throw new BadRequestException('Invalid role ID format');
      }

      const roleExists = await this.roleModel.exists({ _id: updates.role });
      if (!roleExists) {
        throw new BadRequestException(`Role with ID  does not exist`);
      }
    }

    const updated = await this.userModel
      .findByIdAndUpdate(id, updates, { new: true })
      .exec();

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
