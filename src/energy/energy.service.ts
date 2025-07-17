// src/energy/energy.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Energy, EnergyDocument } from './schemas/energy.schema';

@Injectable()
export class EnergyService {
  constructor(
    @InjectModel(Energy.name, 'surajcotton') private energyModel: Model<EnergyDocument>,
  ) {}

  async getConsumption(start: string, end: string) {
    const meterIds = [ "U19_PLC", "U21_PLC", "U6_GW02", "U17_GW03", "U23_GW01", "U1_PLC", "U2_PLC","U3_PLC", "U4_PLC", "U5_PLC", "U6_PLC",
        "U7_PLC", "U8_PLC", "U9_PLC", "U10_PLC", "U11_PLC", "U12_PLC", "U13_PLC", "U14_PLC", "U15_PLC", "U16_PLC", "U17_PLC","U18_PLC", "U20_PLC",
        "U1_GW01", "U2_GW01", "U3_GW01", "U4_GW01", "U4_GW01", "U5_GW01", "U6_GW01", "U7_GW01", "U8_GW01", "U9_GW01", "U10_GW01", "U11_GW01",
        "U12_GW01", "U13_GW01", "U14_GW01", "U15_GW01", "U16_GW01", "U17_GW01", "U18_GW01", "U19_GW01", "U20_GW01", "U21_GW01", "U22_GW01", "U1_GW02",
        "U2_GW02", "U3_GW02", "U4_GW02", "U5_GW02", "U7_GW02", "U8_GW02", "U9_GW02", "U10_GW02", "U11_GW02", "U12_GW02", "U13_GW02", "U14_GW02",
        "U15_GW02", "U16_GW02", "U17_GW02", "U18_GW02", "U19_GW02", "U20_GW02", "U21_GW02", "U22_GW02", "U23_GW02", "U1_GW03", "U2_GW03", "U3_GW03",
        "U4_GW03", "U5_GW03", "U6_GW03", "U18_GW03", "U19_GW03", "U20_GW03", "U21_GW03", "U22_GW03", "U23_GW03"
    ];
    const suffixes: string[] = ['Del_ActiveEnergy'];


    const LTGenerationKeys = ['U19_PLC_Del_ActiveEnergy', 'U21_PLC_Del_ActiveEnergy'];
    const SolarGenerationKeys = ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy'];
     const HTGenerationKeys = ['U20_GW03_Del_ActiveEnergy','U21_GW03_Del_ActiveEnergy','U23_GW01_Del_ActiveEnergy', 'U7_GW01_Del_ActiveEnergy',
      ];

    const WapdaImportKeys = ['U22_GW01_Del_ActiveEnergy'];
    const Trafo1IncomingKeys = ['U21_PLC_Del_ActiveEnergy'];
    const Trafo2IncomingKeys = ['U13_GW01_Del_ActiveEnergy'];
    const Trafo3IncomingKeys = ['U13_GW02_Del_ActiveEnergy'];
    const Trafo4IncomingKeys = ['U16_GW03_Del_ActiveEnergy'];
    const DieselGensetKeys = ['U19_PLC_Del_ActiveEnergy'];
    const GasGensetKeys = ['U11_GW01_Del_ActiveEnergy'];
    const Solar1Keys = ['U6_GW02_Del_ActiveEnergy'];
    const Solar2Keys = ['U17_GW03_Del_ActiveEnergy'];





    const U4_ConsumptionKeys = ['U1_PLC_Del_ActiveEnergy', 'U2_PLC_Del_ActiveEnergy', 'U3_PLC_Del_ActiveEnergy', 'U4_PLC_Del_ActiveEnergy',
        'U5_PLC_Del_ActiveEnergy', 'U6_PLC_Del_ActiveEnergy', 'U7_PLC_Del_ActiveEnergy', 'U8_PLC_Del_ActiveEnergy', 'U9_PLC_Del_ActiveEnergy',
        'U10_PLC_Del_ActiveEnergy', 'U11_PLC_Del_ActiveEnergy', 'U12_PLC_Del_ActiveEnergy', 'U13_PLC_Del_ActiveEnergy', 'U14_PLC_Del_ActiveEnergy',
        'U15_PLC_Del_ActiveEnergy', 'U16_PLC_Del_ActiveEnergy', 'U17_PLC_Del_ActiveEnergy', 'U18_PLC_Del_ActiveEnergy', 'U20_PLC_Del_ActiveEnergy',
        'U1_GW01_Del_ActiveEnergy', 'U2_GW01_Del_ActiveEnergy', 'U3_GW01_Del_ActiveEnergy', 'U4_GW01_Del_ActiveEnergy', 'U5_GW01_Del_ActiveEnergy',
        'U6_GW01_Del_ActiveEnergy', 'U8_GW01_Del_ActiveEnergy', 'U9_GW01_Del_ActiveEnergy', 'U10_GW01_Del_ActiveEnergy','U11_GW01_Del_ActiveEnergy',
        'U12_GW01_Del_ActiveEnergy','U14_GW01_Del_ActiveEnergy', 'U15_GW01_Del_ActiveEnergy', 'U16_GW01_Del_ActiveEnergy',
        'U18_GW01_Del_ActiveEnergy', 'U19_GW01_Del_ActiveEnergy', 'U20_GW01_Del_ActiveEnergy', 'U21_GW01_Del_ActiveEnergy', 'U22_GW01_Del_ActiveEnergy'];
    const U5_ConsumptionKeys=["U1_GW02_Del_ActiveEnergy", "U2_GW02_Del_ActiveEnergy", "U3_GW02_Del_ActiveEnergy", "U4_GW02_Del_ActiveEnergy", "U5_GW02_Del_ActiveEnergy",
        "U7_GW02_Del_ActiveEnergy", "U8_GW02_Del_ActiveEnergy", "U9_GW02_Del_ActiveEnergy","U10_GW02_Del_ActiveEnergy", "U11_GW02_Del_ActiveEnergy", "U12_GW02_Del_ActiveEnergy",
        "U13_GW02_Del_ActiveEnergy", "U14_GW02_Del_ActiveEnergy", "U15_GW02_Del_ActiveEnergy", "U16_GW02_Del_ActiveEnergy", "U17_GW02_Del_ActiveEnergy",
        "U18_GW02_Del_ActiveEnergy","U19_GW02_Del_ActiveEnergy", "U20_GW02_Del_ActiveEnergy", "U21_GW02_Del_ActiveEnergy", "U22_GW02_Del_ActiveEnergy",
        "U23_GW02_Del_ActiveEnergy", "U1_GW03_Del_ActiveEnergy", "U2_GW03_Del_ActiveEnergy", "U3_GW03_Del_ActiveEnergy", "U4_GW03_Del_ActiveEnergy",
         "U5_GW03_Del_ActiveEnergy", "U6_GW03_Del_ActiveEnergy", "U7_GW03_Del_ActiveEnergy", "U8_GW03_Del_ActiveEnergy", "U9_GW03_Del_ActiveEnergy",
         "U10_GW03_Del_ActiveEnergy", "U11_GW03_Del_ActiveEnergy", "U12_GW03_Del_ActiveEnergy", "U13_GW03_Del_ActiveEnergy", "U14_GW03_Del_ActiveEnergy",
         "U15_GW03_Del_ActiveEnergy", "U16_GW03_Del_ActiveEnergy", "U18_GW03_Del_ActiveEnergy", "U19_GW03_Del_ActiveEnergy",
        "U22_GW03_Del_ActiveEnergy"
    ]

   

    const matchStage = {
      timestamp: {
        $gte: `${start}T00:00:00.000+05:00`,
        $lte: `${end}T23:59:59.999+05:00`,
      },
    };

    const projection: { [key: string]: number } = { timestamp: 1 };

    for (const id of meterIds) {
        for (const suffix of suffixes) {
          projection[`${id}_${suffix}`] = 1;
        }
      }
      
    

    const result = await this.energyModel.aggregate([
      { $match: matchStage },
      { $project: projection },
      { $sort: { timestamp: 1 } },
    ]);

    const firstValues = {};
    const lastValues = {};

    for (const doc of result) {
        meterIds.forEach(id => {
          suffixes.forEach(suffix => {
            const key = `${id}_${suffix}`;
            if (doc[key] !== undefined) {
              if (!firstValues[key]) firstValues[key] = doc[key];
              lastValues[key] = doc[key];
            }
          });
        });
      }
      

    const consumption = {};
    Object.keys(firstValues).forEach(key => {
      consumption[key] = lastValues[key] - firstValues[key];
    });

    const sumGroup = (keys: string[]) =>
      keys.reduce((sum, key) => sum + (consumption[key] || 0), 0);

    let LTGeneration = sumGroup(LTGenerationKeys);
    let SolarGeneration = sumGroup(SolarGenerationKeys);
    let WapdaImport = sumGroup(WapdaImportKeys);
    let Trafo1Incoming = sumGroup(Trafo1IncomingKeys);
    let Trafo2Incoming = sumGroup(Trafo2IncomingKeys);
    let Trafo3Incoming = sumGroup(Trafo3IncomingKeys);
    let Trafo4Incoming = sumGroup(Trafo4IncomingKeys);
    let DieselGenset = sumGroup(DieselGensetKeys);
    let GasGenset = sumGroup(GasGensetKeys);
    let Solar1 = sumGroup(Solar1Keys);
    let Solar2 = sumGroup(Solar2Keys);
    let U4_Consumption = sumGroup(U4_ConsumptionKeys);
    let U5_Consumption = sumGroup(U5_ConsumptionKeys);
    let HT_Generation = sumGroup(HTGenerationKeys);

   
    // let totalConsumption = solar + Wapda;

    // let Compressor1 = consumption[Compressor1Key] || 0;
    // let Compressor2 = consumption[Compressor2Key] || 0;
    // let Compressor3 = consumption[Compressor3Key] || 0;

    let totalGeneration = LTGeneration + SolarGeneration + WapdaImport+ HT_Generation;
    let totalenergyinput = U4_Consumption + U5_Consumption;
    // let Trafo3losses = Trafo3Incoming - Trafo3outgoing;
    // let Trafo4losses = Trafo4Incoming - Trafo4outgoing;
    // let TrasformerLosses = Trafo3losses + Trafo4losses;
    let unaccoutable_energy= totalenergyinput-totalGeneration;




    // let unaccountable = totalConsumption - production;

    return {
  total_consumption: {
    // Total_Consumption: totalConsumption.toFixed(5),
    LTGeneration: LTGeneration.toFixed(2),
    SolarGeneration: SolarGeneration.toFixed(2),
    Wapda1: WapdaImport.toFixed(2),
    Trafo1Incoming:Trafo1Incoming.toFixed(2),
    Trafo2Incoming: Trafo2Incoming.toFixed(2),
    Trafo3Incoming: Trafo3Incoming.toFixed(2),
    Trafo4Incoming: Trafo4Incoming.toFixed(2),
    // Trafo3losses: Trafo3losses.toFixed(2),
    // Trafo4losses: Trafo4losses.toFixed(2),
    // TrasformerLosses: TrasformerLosses.toFixed(2),
    Solar1: Solar1.toFixed(2),
    Solar2: Solar2.toFixed(2),
    Total_Generation: totalGeneration.toFixed(2),
    U4_Consumption: U4_Consumption.toFixed(2),
    U5_Consumption: U5_Consumption.toFixed(2),
    HT_Generation:  HT_Generation.toFixed(2),
    total_energy_input: totalenergyinput.toFixed(2),
    unaccoutable_energy: unaccoutable_energy.toFixed(2),
    DieselGenset: DieselGenset.toFixed(2),
    GasGenset: GasGenset.toFixed(2),

    

    
  

    // Compressor3: Compressor3.toFixed(5),
    // Sum_of_compressors: production.toFixed(5),
    // Unaccountable_Energy: unaccountable.toFixed(5),
  },
};


  }
}
