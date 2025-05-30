/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Controller,
  Get,
  Param,
  Patch,
  Delete,
  Body,
  Req,
  UseGuards,
  BadRequestException,
  Post,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/roles.authguard';
import { Request } from 'express';
import { Users } from './schema/users.schema';

// Extend Express Request interface to include 'user'
declare module 'express' {
  interface Request {
    user?: any;
  }
}

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Post('addUser')
  async addUser(@Body() body: Partial<any>): Promise<Users> {
    const { name, email, password, roleId } = body;

    // Basic checks (replace with full validation if needed)
    if (!name || !email || !password || !roleId) {
      throw new BadRequestException('Missing required fields');
    }

    return this.usersService.addUser(name, email, password, roleId);
  }
  @UseGuards(JwtAuthGuard)
  @Get('myprofile')
  getMyProfile(@Req() req: Request) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const user = req.user as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    return this.usersService.findById(user.userId);
  }

  // Admin or internal routes
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('allUsers')
  findAllUsers() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('fetch/:id')
  findUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('update/:id')
  updateUser(@Param('id') id: string, @Body() updates: Partial<any>) {
    return this.usersService.updateUser(id, updates);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('delete/:id')
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
