import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { PrivellegesService } from './privelleges.service';
import { Privelleges } from './schema/privelleges.schema';
import { AddPrivellegesDto } from './dto/privelleges.dto';
import { UpdatePrivellegesDto } from './dto/privelleges.dto'; // Import update DTO
import { JwtAuthGuard } from 'src/auth/jwt.authguard';
import { AdminGuard } from 'src/auth/roles.authguard';

@Controller('privelleges')
export class PrivellegesController {
  constructor(private readonly privellegesService: PrivellegesService) {}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('addprivelleges')
  // async addPrivelleges(@Body() dto: AddPrivellegesDto): Promise<Privelleges> {
  //   if (!dto.name) {
  //     throw new NotFoundException('Name is required');
  //   }
  //   return await this.privellegesService.createPrivelleges(dto.name);
  // }

  @Post()
async create(@Body() createDto: AddPrivellegesDto) {
  return this.privellegesService.createPrivelleges(createDto.names);
}

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('allprivelleges')
  async getAllPrivelleges(): Promise<Privelleges[]> {
    return this.privellegesService.getAllPrivelleges();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Put('updateprivelleges/:id')
  async updatePrivelleges(
    @Param('id') id: string,
    @Body() dto: UpdatePrivellegesDto,
  ): Promise<{ message: string }> {
    const { name } = dto;

    if (!name) {
      throw new NotFoundException('Name is required');
    }

    return await this.privellegesService.getPrivellegesByIdAndUpdate(id, name);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('deleteprivelleges/:id')
  async deletePrivelleges(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    return await this.privellegesService.getPrivellegesByIdAndDelete(id);
  }
}
