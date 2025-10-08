import { Body, Controller, Get, Patch, Post, Put } from '@nestjs/common';
import { AlarmsService } from './alarms.service';
import { ConfigAlarmDto } from './dto/alarmsConfig.dto';
import { AlarmsTypeDto } from './dto/alarmsType.dto';
import { GetAlarmsByTypeDto } from './dto/get-alarms-by-type.dto';
import { GetTypeByAlarmDto } from './dto/get-type-by-alarm.dto';
import { GetUpdateIdDto } from './dto/get-update-id.dto';
import { UpdateAlarmDto } from './dto/update-alarm.dto';
import { DeleteAlarmDto } from './dto/delete-alarm.dto';
import { SnoozeDto } from './dto/snooze.dto';

@Controller('alarms')
export class AlarmsController {
  constructor(private readonly alarmsService: AlarmsService) {}

  @Post('add-types-alarms')
  create(@Body() dto: AlarmsTypeDto) {
    return this.alarmsService.addAlarmType(dto);
  }

  @Get('all-types-alarms')
  findAll() {
    return this.alarmsService.getAllAlarmTypes();
  }

  @Get('mapped-location')
  getMappedLocation() {
    return this.alarmsService.getMappedLocation();
  }

  @Get('all-alarms-types-names')
  getAllAlarmsTypes() {
    return this.alarmsService.getAlarmsTypeName();
  }

  @Put('update-types-alarms')
  update(@Body() dto: GetUpdateIdDto, @Body() updateDto: AlarmsTypeDto) {
    return this.alarmsService.updateAlarmType(dto.typeId, updateDto);
  }

  @Put('update-alarm-config')
  updateAlarm(@Body() dto: UpdateAlarmDto) {
    return this.alarmsService.updateAlarm(dto);
  }

  @Post('delete-types-alarms')
  delete(@Body() dto: GetAlarmsByTypeDto) {
    return this.alarmsService.deleteAlarmType(dto.typeId);
  }

  @Post('delete-alarm-config')
  async deleteAlarm(@Body() dto: DeleteAlarmDto) {
    return this.alarmsService.deleteAlarmByConfigId(dto.alarmConfigId);
  }

  @Post('add-alarm')
  createAlarm(@Body() dto: ConfigAlarmDto) {
    // console.log('api hit', dto);
    return this.alarmsService.addAlarm(dto);
  }

  @Get('intervals')
  getIntervals() {
    return this.alarmsService.getIntervals();
  }

  @Get('time')
  getTime() {
    return this.alarmsService.getTime();
  }

  @Get('/device-dropdownlist')
  async getDeviceDropdownList() {
    return this.alarmsService.DevicesDropdownList();
  }
  @Post('by-type')
  async getByType(@Body() dto: GetAlarmsByTypeDto) {
    return this.alarmsService.getAlarmsByType(dto.typeId);
  }
  @Post('type-by-alarm')
  getAlarmTypeByAlarmId(@Body() dto: GetTypeByAlarmDto) {
    return this.alarmsService.getAlarmTypeByAlarmId(dto.alarmId);
  }

  @Get('/active-alarms')
  getActiveAlarms() {
    return this.alarmsService.processActiveAlarms();
  }

  @Post('get-all-Alarms')
  async getAllAlarms(@Body() filters: any) {
    return await this.alarmsService.gethistoricalAlarms(filters);
  }

  @Get('acknowledgment-actions')
  async acknowledgementActions() {
    return await this.alarmsService.acknowledgementActions();
  }

  @Post('single-acknowledge')
  async acknowledgeOne(
    @Body('id') id: string,
    @Body('action') action: string,
    @Body('acknowledgedBy') acknowledgedBy: string,
  ) {
    return this.alarmsService.acknowledgeOne(id, action, acknowledgedBy);
  }

  // ✅ Acknowledge multiple occurrences
  @Post('bulk-acknowledge')
  async acknowledgeMany(
    @Body('ids') ids: string[],
    @Body('acknowledgedBy') acknowledgedBy: string,
  ) {
    return this.alarmsService.acknowledgeMany(ids, acknowledgedBy);
  }

  @Patch('snooze')
  async snoozeAlarm(@Body() snoozeDto: SnoozeDto) {
    return this.alarmsService.snoozeAlarm(snoozeDto);
  }
}
