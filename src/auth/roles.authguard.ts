/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Roles, RolesDocument } from 'src/roles/schema/roles.schema';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @InjectModel(Roles.name, 'surajcotton')
    private readonly rolesModel: Model<RolesDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.role) {
      throw new ForbiddenException('No role found in token.');
    }

    // Fetch the role document from the database using the role ID
    const role = await this.rolesModel.findById(user.role);
    if (!role) {
      throw new ForbiddenException('Invalid role.');
    }

    // Check if it's Admin
    if (role.name !== 'admin') {
      throw new ForbiddenException('Access denied. Admins only.');
    }

    return true;
  }
}
