// src/energy/energy.service.ts

import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Energy, EnergyDocument } from './schemas/energy.schema';
import * as moment from 'moment-timezone';
import { EnergyQueryDto } from './dto/energy-query.dto';
import { Injectable, BadRequestException } from '@nestjs/common';

const TZ = 'Asia/Karachi';

/* ===================== GROUP KEYS ===================== */
const GROUP_KEYS = {
  LTGeneration: ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'],

  SolarGeneration: [
    'U6_GW02_Del_ActiveEnergy',
    'U17_GW03_Del_ActiveEnergy',
    'U24_GW01_Del_ActiveEnergy',
    'U28_PLC_Del_ActiveEnergy',
  ],

  HT_Generation: ['U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy'],

  WapdaImport: ['U23_GW01_Del_ActiveEnergy', 'U27_PLC_Del_ActiveEnergy'],

  hfoaux: ['U25_PLC_Del_ActiveEnergy'],
  Aux_consumption: ['U25_PLC_Del_ActiveEnergy'],

  U4_Consumption: [
    'U19_PLC_Del_ActiveEnergy',
    'U21_PLC_Del_ActiveEnergy',
    'U13_GW01_Del_ActiveEnergy',
    'U11_GW01_Del_ActiveEnergy',
    'U24_GW01_Del_ActiveEnergy',
    'U28_PLC_Del_ActiveEnergy',
  ],

  U5_Consumption: [
    'U13_GW02_Del_ActiveEnergy',
    'U16_GW03_Del_ActiveEnergy',
    'U6_GW02_Del_ActiveEnergy',
    'U17_GW03_Del_ActiveEnergy',
  ],
};

/* ===================== HELPERS ===================== */
const sumGroup = (data: Record<string, number>, keys: string[]) =>
  keys.reduce((sum, key) => sum + (data[key] || 0), 0);

@Injectable()
export class EnergyService {
  constructor(
    @InjectModel(Energy.name, 'surajcotton')
    private readonly energyModel: Model<EnergyDocument>,
  ) {}

  async getConsumption(query: EnergyQueryDto) {
    const perfStart = performance.now();

    const { start_date, end_date, start_time, end_time } = query;

    /* ===================== TIME WINDOW ===================== */
    const startMoment = moment.tz(
      `${start_date} ${start_time}`,
      'YYYY-MM-DD HH:mm',
      TZ,
    );

    const endMoment = moment
      .tz(`${end_date} ${end_time}`, 'YYYY-MM-DD HH:mm', TZ)
      .add(1, 'minute');

    if (endMoment.isSame(startMoment)) {
      return this.zeroResponse();
    }

    if (endMoment.isBefore(startMoment)) {
      throw new BadRequestException(
        'end_date/end_time must be after start_date/start_time',
      );
    }

    // ✅ USE UNIX TIMESTAMPS (FIX)
    const startUnix = startMoment.unix();
    const endUnix = endMoment.unix();

    console.log('🕒 Start UNIX:', startUnix);
    console.log('🕒 End UNIX  :', endUnix);

    const matchStage = {
      UNIXtimestamp: { $gte: startUnix, $lte: endUnix },
    };

    /* ===================== FIRST & LAST DOC ===================== */
    const firstDoc = await this.energyModel
      .findOne(matchStage)
      .sort({ UNIXtimestamp: 1 })
      .lean();

    const lastDoc = await this.energyModel
      .findOne(matchStage)
      .sort({ UNIXtimestamp: -1 })
      .lean();

    if (!firstDoc || !lastDoc) {
      return this.zeroResponse();
    }

    /* ===================== DIFF CALC ===================== */
    const requiredKeys = Object.values(GROUP_KEYS).flat();
    const consumption: Record<string, number> = {};

    for (const key of requiredKeys) {
      const first = Number(firstDoc[key] ?? 0);
      const last = Number(lastDoc[key] ?? 0);
      consumption[key] = last > first ? last - first : 0;
    }

    /* ===================== ENERGY CALCS ===================== */
    const LTGeneration = sumGroup(consumption, GROUP_KEYS.LTGeneration);
    const SolarGeneration = sumGroup(consumption, GROUP_KEYS.SolarGeneration);
    const HT_Generation = sumGroup(consumption, GROUP_KEYS.HT_Generation);
    const WapdaImport = sumGroup(consumption, GROUP_KEYS.WapdaImport);
    const hfoaux = sumGroup(consumption, GROUP_KEYS.hfoaux);
    const Aux_consumption = sumGroup(consumption, GROUP_KEYS.Aux_consumption);
    const U4 = sumGroup(consumption, GROUP_KEYS.U4_Consumption);
    const U5 = sumGroup(consumption, GROUP_KEYS.U5_Consumption);

    const totalGeneration = LTGeneration + SolarGeneration + HT_Generation;
    const totalEnergyInput = totalGeneration + WapdaImport;
    const totalEnergyOutput = U4 + U5 + Aux_consumption;

    const f = (v: number) => v.toFixed(2);

    console.log(
      `🔥 getConsumption executed in ${(performance.now() - perfStart).toFixed(
        2,
      )} ms`,
    );

    /* ===================== RESPONSE ===================== */
    return {
      total_consumption: {
        LTGeneration: f(LTGeneration),
        SolarGeneration: f(SolarGeneration),
        WapdaImport: f(WapdaImport),
        hfoaux: f(hfoaux),
        Aux_consumption: f(Aux_consumption),
        Total_Generation: f(totalGeneration),
        HT_Generation: f(HT_Generation),
        total_energy_input: f(totalEnergyInput),
        totalenergyoutput: f(totalEnergyOutput),
      },
    };
  }

  private zeroResponse() {
    return {
      total_consumption: {
        LTGeneration: '0.00',
        SolarGeneration: '0.00',
        WapdaImport: '0.00',
        hfoaux: '0.00',
        Aux_consumption: '0.00',
        Total_Generation: '0.00',
        HT_Generation: '0.00',
        total_energy_input: '0.00',
        totalenergyoutput: '0.00',
      },
    };
  }
}
