/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from 'src/auth/jwt.authguard';
import { AdminGuard } from 'src/auth/roles.authguard';
import { CreateRoleDto } from './dto/roles.dto'; // adjust path if needed


@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}
  //remove these Gaurds for the First Time when adding Role, later add the Gaurds back.
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('addrole')
 @Post()
async createRole(@Body() dto: CreateRoleDto) {
  return this.rolesService.createRole(dto.name, dto.privelleges);
}

  
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('allrole')
  async getAllRoles() {
    const roles = await this.rolesService.getAllRoles();
    return {
      message: 'All roles retrieved successfully',
      data: roles,
    };
  }
 @UseGuards(JwtAuthGuard, AdminGuard)
@Put('updaterole/:id')
async updateRole(
  @Param('id') id: string,
  @Body('name') name: string,
  @Body('privelleges') privelleges: string[],
) {
  return this.rolesService.getRoleByIdAndUpdate(id, name, privelleges);
}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('deleterole/:id')
  @HttpCode(HttpStatus.OK)
  async deleteRole(@Param('id') id: string) {
    return await this.rolesService.getRoleByIdAndDelete(id);
  }
  // @UseGuards(JwtAuthGuard, AdminGuard)
  // @Put(':roleId/privelleges')
  // async editRolePrevilleges(
  //   @Param('roleId') roleId: string,
  //   @Body('privellegeNames') privellegeNames: string[],
  // ) {
  //   if (!Array.isArray(privellegeNames)) {
  //     throw new BadRequestException('privellegeNames must be an array');
  //   }

  //   const updatedRole = await this.rolesService.editRolePrivilegesById(
  //     roleId,
  //     privellegeNames,
  //   );
  //   return { message: 'Privileges updated', role: updatedRole };
  // }
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':roleId/privelleges/:privilegeId')
  async removePrivilegeFromRole(
    @Param('roleId') roleId: string,
    @Param('privilegeId') privilegeId: string,
  ) {
    const updatedRole = await this.rolesService.removePrivilegeFromRoleById(
      roleId,
      privilegeId,
    );
    return { message: 'Privilege removed from role', role: updatedRole };
  }
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete(':roleId/privelleges')
  async removeMultiplePrivilegesFromRole(
    @Param('roleId') roleId: string,
    @Body('privilegeIds') privilegeIds: string[],
  ) {
    if (!Array.isArray(privilegeIds) || privilegeIds.length === 0) {
      throw new BadRequestException('privilegeIds must be a non-empty array');
    }

    const updatedRole =
      await this.rolesService.removeMultiplePrivilegesFromRole(
        roleId,
        privilegeIds,
      );

    return { message: 'Privileges removed from role', role: updatedRole };
  }
}
