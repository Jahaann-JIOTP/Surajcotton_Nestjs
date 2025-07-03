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

    // ✅ Load role by ID
    const role = await this.rolesModel.findById(user.role).lean();
    if (!role) {
      throw new ForbiddenException('Invalid role.');
    }

    if (!['super_admin', 'admin'].includes(role.name)) {
  throw new ForbiddenException('Access denied. Only admin or super_admin allowed.');
}


    return true;
  }
}

