// src/energy/energy.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Energy, EnergyDocument } from './schemas/energy.schema';
import * as moment from 'moment-timezone';

@Injectable()
export class EnergyService {
  constructor(
    @InjectModel(Energy.name, 'surajcotton')
    private energyModel: Model<EnergyDocument>,
  ) {}



    async getConsumption(start: string, end: string) {
    const meterIds = [ "U1_PLC", "U2_PLC", "U3_PLC", "U4_PLC", "U5_PLC", "U6_PLC", "U7_PLC", "U8_PLC", "U9_PLC",
       "U10_PLC", "U11_PLC", "U12_PLC", "U13_PLC", "U14_PLC", "U15_PLC", "U16_PLC", "U17_PLC","U18_PLC",
       "U19_PLC","U20_PLC", "U21_PLC","U22_PLC", "U23_PLC","U24_PLC","U25_PLC","U26_PLC","U27_PLC",
       
        
        "U1_GW01", "U2_GW01", "U3_GW01", "U4_GW01", "U5_GW01", "U6_GW01", "U7_GW01", "U8_GW01", "U9_GW01", "U10_GW01", "U11_GW01",
        "U12_GW01", "U13_GW01", "U14_GW01", "U15_GW01", "U16_GW01", "U17_GW01", "U18_GW01", "U19_GW01", "U20_GW01", "U21_GW01", "U22_GW01", "U23_GW01","U24_GW01",
        
        "U1_GW02","U2_GW02", "U3_GW02", "U4_GW02", "U5_GW02", "U6_GW02", "U7_GW02","U8_GW02", "U9_GW02", "U10_GW02", "U11_GW02", "U12_GW02", "U13_GW02", "U14_GW02",
        "U15_GW02", "U16_GW02", "U17_GW02", "U18_GW02", "U19_GW02", "U20_GW02", "U21_GW02", "U22_GW02", "U23_GW02",
        
        "U1_GW03", "U2_GW03", "U3_GW03","U4_GW03", "U5_GW03", "U6_GW03", "U7_GW03", "U8_GW03", "U9_GW03", "U10_GW03","U11_GW03","U12_GW03","U13_GW03","U14_GW03","U15_GW03",
        "U16_GW03","U17_GW03", "U18_GW03", "U19_GW03", "U20_GW03", "U21_GW03", "U22_GW03", "U23_GW03", "U16_GW03"];


    const suffixes: string[] = ['Del_ActiveEnergy', 'ActivePower_Total', 'ActiveEnergy_Imp_kWh', 'ActiveEnergy_Exp_kWh'];
    const LTGenerationKeys = ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'];
    const SolarGenerationKeys = ['U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy' , 'U24_GW01_Del_ActiveEnergy'];
    const HTGenerationKeys = ['U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy'];                                                                         //is may sum show karvana ha nilgata or jms ka jab us k tags ayain gay
    const WapdaImportKeys = ['U23_GW01_Del_ActiveEnergy', 'U27_PLC_Del_ActiveEnergy'];
    const Wapda1Keys = ['U23_GW01_Del_ActiveEnergy'];
    const Wapda2Keys = ['U27_PLC_Del_ActiveEnergy'];
    const NiigataKeys = ['U22_PLC_Del_ActiveEnergy'];
    const JMSKeys = ['U26_PLC_Del_ActiveEnergy'];
    const WapdaExportKeys = ['U20_GW03_ActiveEnergy_Exp_kWh', 'U19_GW03_ActiveEnergy_Exp_kWh'];
    const Trafo1IncomingKeys = ['U23_GW01_Del_ActiveEnergy'];
    const Trafo2IncomingKeys = ['U22_GW01_Del_ActiveEnergy'];
    const Trafo3IncomingKeys = ['U20_GW03_Del_ActiveEnergy'];
    const Trafo4IncomingKeys = ['U19_GW03_Del_ActiveEnergy'];
    const Trafo1outgoingKeys = ['U21_PLC_Del_ActiveEnergy'];
    const Trafo2outgoingKeys = ['U13_GW01_Del_ActiveEnergy'];
    const Trafo3outgoingKeys = ['U13_GW02_Del_ActiveEnergy'];
    const Trafo4outgoingKeys = ['U16_GW03_Del_ActiveEnergy'];
    const DieselGensetandGasGensetKeys = ['U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy'];
    
    const Solar1Keys = ['U6_GW02_Del_ActiveEnergy'];
    const Solar2Keys = ['U17_GW03_Del_ActiveEnergy'];
    const solarunit4Keys = ['U24_GW01_Del_ActiveEnergy'];
    const PH_ICKeys = ['U22_GW01_Del_ActiveEnergy'];
    const Unit4_LT1Keys = ['U1_PLC_Del_ActiveEnergy', 'U2_PLC_Del_ActiveEnergy', 'U3_PLC_Del_ActiveEnergy',
    'U4_PLC_Del_ActiveEnergy', 'U5_PLC_Del_ActiveEnergy', 'U6_PLC_Del_ActiveEnergy', 'U7_PLC_Del_ActiveEnergy',
  'U8_PLC_Del_ActiveEnergy', 'U9_PLC_Del_ActiveEnergy', 'U10_PLC_Del_ActiveEnergy','U11_PLC_Del_ActiveEnergy',
   'U12_PLC_Del_ActiveEnergy', 'U13_PLC_Del_ActiveEnergy', 'U14_PLC_Del_ActiveEnergy', 'U15_PLC_Del_ActiveEnergy',
  'U16_PLC_Del_ActiveEnergy', 'U17_PLC_Del_ActiveEnergy', 'U18_PLC_Del_ActiveEnergy', 'U20_PLC_Del_ActiveEnergy',
  ];
  const Unit4_LT2Keys = ['U1_GW01_Del_ActiveEnergy', 'U2_GW01_Del_ActiveEnergy','U3_GW01_Del_ActiveEnergy',
     'U4_GW01_Del_ActiveEnergy',  'U5_GW01_Del_ActiveEnergy',  'U6_GW01_Del_ActiveEnergy',
      'U8_GW01_Del_ActiveEnergy',  'U9_GW01_Del_ActiveEnergy',  'U10_GW01_Del_ActiveEnergy','U7_GW01_Del_ActiveEnergy',
       'U12_GW01_Del_ActiveEnergy',  'U14_GW01_Del_ActiveEnergy','U15_GW01_Del_ActiveEnergy',
        'U16_GW01_Del_ActiveEnergy',  'U17_GW01_Del_ActiveEnergy',  'U18_GW01_Del_ActiveEnergy',  'U19_GW01_Del_ActiveEnergy',
         'U20_GW01_Del_ActiveEnergy',  'U21_GW01_Del_ActiveEnergy'
   ];

   ////// i did not add 4 PDB meters in U5_LT1 because its not add in SLD
    const Unit5_LT1Keys = ['U5_GW02_Del_ActiveEnergy','U7_GW02_Del_ActiveEnergy','U8_GW02_Del_ActiveEnergy','U9_GW02_Del_ActiveEnergy',
      'U10_GW02_Del_ActiveEnergy','U11_GW02_Del_ActiveEnergy','U12_GW02_Del_ActiveEnergy',  'U14_GW02_Del_ActiveEnergy',
      'U15_GW02_Del_ActiveEnergy','U16_GW02_Del_ActiveEnergy',  'U17_GW02_Del_ActiveEnergy',  'U18_GW02_Del_ActiveEnergy',  'U19_GW02_Del_ActiveEnergy',
         'U20_GW02_Del_ActiveEnergy',  'U21_GW02_Del_ActiveEnergy',  'U22_GW02_Del_ActiveEnergy',  'U23_GW02_Del_ActiveEnergy'
   ];
    ////// i did not add 2 PDB meters in U5_LT2 because its not add in SLD
       const Unit5_LT2Keys = ['U1_GW03_Del_ActiveEnergy', 'U2_GW03_Del_ActiveEnergy','U3_GW03_Del_ActiveEnergy', 'U4_GW03_Del_ActiveEnergy',
      'U5_GW03_Del_ActiveEnergy', 'U6_GW03_Del_ActiveEnergy','U7_GW03_Del_ActiveEnergy','U8_GW03_Del_ActiveEnergy','U9_GW03_Del_ActiveEnergy',
      'U10_GW03_Del_ActiveEnergy','U11_GW03_Del_ActiveEnergy','U12_GW03_Del_ActiveEnergy', 'U13_GW03_Del_ActiveEnergy',  'U14_GW03_Del_ActiveEnergy',
      'U15_GW03_Del_ActiveEnergy',   'U18_GW03_Del_ActiveEnergy',
      
   ]

    
    
    const Aux_consumptionKeys = ['U25_PLC_Del_ActiveEnergy'];
    const totalgeneration1Keys = [
      'U1_PLC_Del_ActiveEnergy', 'U2_PLC_Del_ActiveEnergy', 'U3_PLC_Del_ActiveEnergy', 'U4_PLC_Del_ActiveEnergy',
        'U5_PLC_Del_ActiveEnergy', 'U6_PLC_Del_ActiveEnergy', 'U7_PLC_Del_ActiveEnergy', 'U8_PLC_Del_ActiveEnergy', 'U9_PLC_Del_ActiveEnergy',
        'U10_PLC_Del_ActiveEnergy', 'U11_PLC_Del_ActiveEnergy', 'U12_PLC_Del_ActiveEnergy', 'U13_PLC_Del_ActiveEnergy', 'U14_PLC_Del_ActiveEnergy',
        'U15_PLC_Del_ActiveEnergy', 'U16_PLC_Del_ActiveEnergy', 'U17_PLC_Del_ActiveEnergy', 'U18_PLC_Del_ActiveEnergy', 'U20_PLC_Del_ActiveEnergy',
        'U1_GW01_Del_ActiveEnergy', 'U2_GW01_Del_ActiveEnergy', 'U3_GW01_Del_ActiveEnergy', 'U4_GW01_Del_ActiveEnergy', 'U5_GW01_Del_ActiveEnergy',
        'U6_GW01_Del_ActiveEnergy', 'U8_GW01_Del_ActiveEnergy', 'U9_GW01_Del_ActiveEnergy', 'U10_GW01_Del_ActiveEnergy','U12_GW01_Del_ActiveEnergy','U14_GW01_Del_ActiveEnergy', 'U15_GW01_Del_ActiveEnergy', 'U16_GW01_Del_ActiveEnergy',
        'U18_GW01_Del_ActiveEnergy', 'U19_GW01_Del_ActiveEnergy', 'U20_GW01_Del_ActiveEnergy', 'U21_GW01_Del_ActiveEnergy', 'U22_GW01_Del_ActiveEnergy',
        "U1_GW02_Del_ActiveEnergy",
        "U2_GW02_Del_ActiveEnergy",
        "U3_GW02_Del_ActiveEnergy", // this one tag some time shows negative values 
        "U4_GW02_Del_ActiveEnergy",
        "U5_GW02_Del_ActiveEnergy",
        "U7_GW02_Del_ActiveEnergy", "U8_GW02_Del_ActiveEnergy", "U9_GW02_Del_ActiveEnergy","U10_GW02_Del_ActiveEnergy", "U11_GW02_Del_ActiveEnergy", "U12_GW02_Del_ActiveEnergy",
        "U14_GW02_Del_ActiveEnergy", "U15_GW02_Del_ActiveEnergy", "U16_GW02_Del_ActiveEnergy", "U17_GW02_Del_ActiveEnergy",
        "U18_GW02_Del_ActiveEnergy","U19_GW02_Del_ActiveEnergy", "U20_GW02_Del_ActiveEnergy", "U21_GW02_Del_ActiveEnergy", "U22_GW02_Del_ActiveEnergy",
        "U23_GW02_Del_ActiveEnergy", "U1_GW03_Del_ActiveEnergy", "U2_GW03_Del_ActiveEnergy", "U3_GW03_Del_ActiveEnergy", "U4_GW03_Del_ActiveEnergy",
        "U5_GW03_Del_ActiveEnergy", "U6_GW03_Del_ActiveEnergy", "U7_GW03_Del_ActiveEnergy", "U8_GW03_Del_ActiveEnergy", "U9_GW03_Del_ActiveEnergy",
        "U10_GW03_Del_ActiveEnergy", "U11_GW03_Del_ActiveEnergy", "U12_GW03_Del_ActiveEnergy", "U13_GW03_Del_ActiveEnergy", "U14_GW03_Del_ActiveEnergy",
        "U15_GW03_Del_ActiveEnergy", "U18_GW03_Del_ActiveEnergy", "U19_GW03_Del_ActiveEnergy",
        "U22_GW03_Del_ActiveEnergy"
        ];


    const U4_ConsumptionKeys = ['U19_PLC_Del_ActiveEnergy', 'U21_PLC_Del_ActiveEnergy','U13_GW01_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy', 'U24_GW01_Del_ActiveEnergy'];
    const U5_ConsumptionKeys=["U13_GW02_Del_ActiveEnergy", "U16_GW03_Del_ActiveEnergy", "U6_GW02_Del_ActiveEnergy","U17_GW03_Del_ActiveEnergy"]
    // ✅ Time window
//  const startMoment = moment.tz(`${start} 06:00:00`, "YYYY-MM-DD HH:mm:ss", "Asia/Karachi");

// const startStr = startMoment.format("YYYY-MM-DDTHH:mm:ss.SSSZ");

// // 👇 end time ko 1 din add karke 06:00:59.999 set kar do
// const endStr = startMoment
//   .clone()
//   .add(1, "day")
//   .hour(6)
//   .minute(0)
//   .second(59)
//   .millisecond(999)
//   .format("YYYY-MM-DDTHH:mm:ss.SSSZ");

// const matchStage = {
//   timestamp: {
//     $gte: startStr,
//     $lte: endStr,  // ab 06:00:xx docs bhi capture honge
//   },
// };

// ✅ Time window
// ✅ Time window
const startMoment = moment.tz(`${start} 06:00:00`, "YYYY-MM-DD HH:mm:ss", "Asia/Karachi");

let endMoment: moment.Moment;

// agar start aur end same hain to ek din ka data
if (start === end) {
  endMoment = startMoment.clone().add(1, "day").hour(6).minute(0).second(59).millisecond(999);
} else {
  // agar multiple days hain → end date ke agle din ke 06:00 tak le jao
  endMoment = moment.tz(`${end} 06:00:00`, "YYYY-MM-DD HH:mm:ss", "Asia/Karachi")
                   .add(1, "day")
                   .hour(6).minute(0).second(59).millisecond(999);
}

const startStr = startMoment.format("YYYY-MM-DDTHH:mm:ss.SSSZ");
const endStr = endMoment.format("YYYY-MM-DDTHH:mm:ss.SSSZ");

const matchStage = {
  timestamp: {
    $gte: startStr,
    $lte: endStr,
  },
};





    // console.log("📌 Query Window:", { startStr, endStr });

 

    // ✅ Projection build
    const projection: { [key: string]: number } = { timestamp: 1 };
    for (const id of meterIds) {
      for (const suffix of suffixes) {
        projection[`${id}_${suffix}`] = 1;
      }
    }

    // console.log("📌 Projection Keys:", Object.keys(projection).length);

    // ✅ Aggregate query
    const result = await this.energyModel.aggregate([
      { $match: matchStage },
      { $project: projection },
      { $sort: { timestamp: 1 } },
    ]);

    // console.log("📌 Documents Fetched:", result.length);
    if (result.length > 0) {
      // console.log("📌 First Doc:", result[0]);
      // console.log("📌 Last Doc:", result[result.length - 1]);
    }

    // ✅ First & Last values
    const firstValues: Record<string, number> = {};
    const lastValues: Record<string, number> = {};

    for (const doc of result) {
      meterIds.forEach(id => {
        suffixes.forEach(suffix => {
          const key = `${id}_${suffix}`;
          if (doc[key] !== undefined) {
            if (!(key in firstValues)) firstValues[key] = doc[key];
            lastValues[key] = doc[key];
          }
        });
      });
    }

    // console.log("📌 First Values Found:", Object.keys(firstValues).length);
    // console.log("📌 Last Values Found:", Object.keys(lastValues).length);

    // ✅ Consumption calculation
    const consumption: Record<string, number> = {};
    Object.keys(firstValues).forEach(key => {
      let diff = (lastValues[key] ?? 0) - (firstValues[key] ?? 0);

      if (
        diff.toString().includes('e+') ||
        diff.toString().includes('e-') ||
        Math.abs(diff) > 1e10 ||
        Math.abs(diff) < 1e-5
      ) {
        diff = 0;
      }

      consumption[key] = diff;
    });

    // console.log("📌 Sample Consumption:", Object.entries(consumption).slice(0, 5));

    // ✅ Group sums
   // Utility function to group sums
const sumGroup = (keys: string[]) =>
  keys.reduce((sum, key) => sum + (consumption[key] || 0), 0);


    let LTGeneration = sumGroup(LTGenerationKeys);
    let SolarGeneration = sumGroup(SolarGenerationKeys);
    let WapdaImport = sumGroup(WapdaImportKeys);
    let Wapda1= sumGroup(Wapda1Keys);
    let Wapda2 = sumGroup(Wapda2Keys);
    let Niigata = sumGroup(NiigataKeys);
    let JMS = sumGroup(JMSKeys);
    let PH_IC = sumGroup (PH_ICKeys);
    let Unit4_LT1 = sumGroup (Unit4_LT1Keys );
    let Unit4_LT2 = sumGroup (Unit4_LT2Keys );
    let Unit5_LT1 = sumGroup (Unit5_LT1Keys );
    let Unit5_LT2 = sumGroup (Unit5_LT2Keys );
    let WapdaExport= sumGroup( WapdaExportKeys);
    let Trafo1Incoming = sumGroup(Trafo1IncomingKeys);
    let Trafo2Incoming = sumGroup(Trafo2IncomingKeys);
    let Trafo3Incoming = sumGroup(Trafo3IncomingKeys);
    let Trafo4Incoming = sumGroup(Trafo4IncomingKeys);
    let Trafo1outgoing = sumGroup(Trafo1outgoingKeys);
    let Trafo2outgoing = sumGroup(Trafo2outgoingKeys);
    let Trafo3outgoing = sumGroup(Trafo3outgoingKeys);
    let Trafo4outgoing = sumGroup(Trafo4outgoingKeys);
    let DieselandGasGenset = sumGroup(DieselGensetandGasGensetKeys);
    // let GasGenset = sumGroup(GasGensetKeys);
    let Solar1 = sumGroup(Solar1Keys);
    let Solar2 = sumGroup(Solar2Keys);
    let solarunit4 = sumGroup(solarunit4Keys);
    let Aux_consumption= sumGroup(Aux_consumptionKeys);
    let U4_Consumption = sumGroup(U4_ConsumptionKeys);
    let U5_Consumption = sumGroup(U5_ConsumptionKeys);
    let HT_Generation = sumGroup(HTGenerationKeys);
    let totalgeneration1 = sumGroup(totalgeneration1Keys);
/// FORMULAS ////
    let totalGeneration = LTGeneration + SolarGeneration + HT_Generation;
    let totalenergyinput = LTGeneration + SolarGeneration + WapdaImport+ HT_Generation;
    let totalenergyoutput = U4_Consumption + U5_Consumption + Aux_consumption;
    let T1andT2incoming = Trafo1Incoming+Trafo2Incoming;
    let T1andT2outgoing = Trafo1outgoing+Trafo2outgoing;
    let T1andT2losses = T1andT2incoming-T1andT2outgoing ;
    let Trafo1losses = Trafo1Incoming - Trafo1outgoing;
    let Trafo2losses = Trafo2Incoming - Trafo2outgoing;
    let Trafo3losses = Trafo3Incoming - Trafo3outgoing;
    let Trafo4losses = Trafo4Incoming - Trafo4outgoing;
    let TrasformerLosses = T1andT2losses+ Trafo3losses + Trafo4losses;
    let HT_Transmissioin_Losses = (Wapda2+ Niigata + JMS)- (Trafo3Incoming + Trafo4Incoming + PH_IC );
    // console.log("HT_Transmissioin_Losses", HT_Transmissioin_Losses);
    // console.log("Wapda2", Wapda2);
    // console.log("Niigata", Niigata);
    // console.log("JMS", JMS);
    // console.log("Trafo3Incoming", Trafo3Incoming);
    // console.log("Trafo4Incoming", Trafo4Incoming);
    // console.log("PH_IC", PH_IC);






    let unaccoutable_energy= (totalenergyinput)-(totalenergyoutput);
    // let unaccountable = totalConsumption - production;

    return {
  total_consumption: {
    // Total_Consumption: totalConsumption.toFixed(5),
    LTGeneration: LTGeneration.toFixed(2),
    SolarGeneration: SolarGeneration.toFixed(2),
    WapdaImport: WapdaImport.toFixed(2),
    Wapda1: Wapda1.toFixed(2),
    Wapda2: Wapda2.toFixed(2),
    Niigata: Niigata.toFixed(2),
    JMS: JMS.toFixed(2),
    Unit4_LT1: Unit4_LT1.toFixed(2),
    Unit4_LT2: Unit4_LT2.toFixed(2),
    Unit5_LT1: Unit5_LT1.toFixed(2),
    Unit5_LT2: Unit5_LT2.toFixed(2),
    PH_ICKeys: PH_IC.toFixed(2),
    Wapdaexport: WapdaExport.toFixed(2),
    T1andT2incoming: T1andT2incoming.toFixed(2),
    T1andT2outgoing: T1andT2outgoing.toFixed(2),
    T1andT2losses: T1andT2losses.toFixed(2),
    // Trafo1Incoming:Trafo1Incoming.toFixed(2),
    // Trafo2Incoming: Trafo2Incoming.toFixed(2),
    Trafo3Incoming: Trafo3Incoming.toFixed(2),
    Trafo4Incoming: Trafo4Incoming.toFixed(2),
    // Trafo1outgoing: Trafo1outgoing.toFixed(2),
    // Trafo2outgoing: Trafo2outgoing.toFixed(2),
    Trafo3outgoing: Trafo3outgoing.toFixed(2),
    Trafo4outgoing: Trafo4outgoing.toFixed(2),
    HT_Transmissioin_Losses: HT_Transmissioin_Losses.toFixed(2),
    // Trafo1activepowertotal: Trafo1activepowertotal.toFixed(2),
    // Trafo2activepowertotal: Trafo2activepowertotal.toFixed(2),
    // Trafo3activepowertotal: Trafo3activepowertotal.toFixed(2),
    // Trafo4activepowertotal: Trafo4activepowertotal.toFixed(2),
    Trafo1losses: Trafo1losses.toFixed(2),
    Trafo2losses: Trafo2losses.toFixed(2),
    Trafo3losses: Trafo3losses.toFixed(2),
    Trafo4losses: Trafo4losses.toFixed(2),
    TrasformerLosses: TrasformerLosses.toFixed(2),
    Solar1: Solar1.toFixed(2),
    Solar2: Solar2.toFixed(2),
    solarunit4: solarunit4.toFixed(2),
    Aux_consumption: Aux_consumption.toFixed(2),
    Total_Generation: totalGeneration.toFixed(2),
    totalgeneration1: totalgeneration1.toFixed(2),
    U4_Consumption: U4_Consumption.toFixed(2),
    U5_Consumption: U5_Consumption.toFixed(2),
    HT_Generation:  HT_Generation.toFixed(2),
    total_energy_input: totalenergyinput.toFixed(2),
    totalenergyoutput : totalenergyoutput.toFixed(2),
    unaccoutable_energy: unaccoutable_energy.toFixed(2),
    DieselandGasGenset: DieselandGasGenset.toFixed(2),
    // GasGenset: GasGenset.toFixed(2),
    // Compressor3: Compressor3.toFixed(5),
    // Sum_of_compressors: production.toFixed(5),
    // Unaccountable_Energy: unaccountable.toFixed(5),
  },
};
    }}

  

