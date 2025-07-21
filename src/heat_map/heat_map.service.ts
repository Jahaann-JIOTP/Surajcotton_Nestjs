
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MongoClient } from 'mongodb';
// import * as moment from 'moment-timezone';
import * as moment from 'moment';
import { HeatMap, HeatMapDocument } from './schemas/heat_map.schema';



@Injectable()
export class HeatMapService  {
  

  constructor(
    @InjectModel('HeatMap', 'surajcotton') private readonly conModel: Model<HeatMapDocument>,
  ) {}


async getPowerAverages(startDate: string, endDate: string) {
  const collection = this.conModel.collection;

  const startDateTime = moment.tz(startDate, "YYYY-MM-DD", "Asia/Karachi").startOf('day').utc().toDate();
  const endDateTime = moment.tz(endDate, "YYYY-MM-DD", "Asia/Karachi").endOf('day').utc().toDate();

  // HT tags
  const Trafo1Tags = ["U21_PLC_ActivePower_Total"];
  const Trafo2Tags = ["U13_GW01_ActivePower_Total"];
  const Trafo3Tags = ["U13_GW02_ActivePower_Total"];
  const Trafo4Tags = ["U16_GW03_ActivePower_Total"];



 
  



  

  // Step 1: Create aggregation pipeline
  const pipeline = [
    {
      $addFields: {
        date: { $toDate: "$timestamp" }
      }
    },
    {
      $match: {
        date: { $gte: startDateTime, $lte: endDateTime }
      }
    },
    {
      $addFields: {
        hourStart: {
          $dateTrunc: {
            date: "$date",
            unit: "hour",
            timezone: "Asia/Karachi"
          }
        }
      }
    },
    { $sort: { date: 1 } },
    {
        $group: {
        _id: "$hourStart",
        ...Object.fromEntries(
            [...Trafo1Tags, ...Trafo2Tags, ...Trafo3Tags, ...Trafo4Tags].flatMap(tag => [
            [`first_${tag}`, { $first: { $ifNull: [`$${tag}`, 0] } }],
            [`last_${tag}`, { $last: { $ifNull: [`$${tag}`, 0] } }],
            ])
        )
        }
    },
    { $sort: { _id: 1 } }
  ];

  // Step 2: Run aggregation
  const data = await collection.aggregate(pipeline).toArray();

  // Step 3: Format results
  return data.map(entry => {
    const formattedDate = moment(entry._id).tz("Asia/Karachi").format("YYYY-MM-DD HH:mm");

        let Trafo1Total = 0;
        for (const tag of Trafo1Tags) {
        const first = entry[`first_${tag}`] || 0;
        const last = entry[`last_${tag}`] || 0;
        const diff = last - first;
        Trafo1Total += Math.abs(diff) > 1e25 ? 0 : +diff;
        }
         let Trafo2Total = 0;
        for (const tag of Trafo2Tags) {
        const first = entry[`first_${tag}`] || 0;
        const last = entry[`last_${tag}`] || 0;
        const diff = last - first;
        Trafo2Total += Math.abs(diff) > 1e25 ? 0 : +diff;
        }
           let Trafo3Total = 0;
        for (const tag of Trafo3Tags) {
        const first = entry[`first_${tag}`] || 0;
        const last = entry[`last_${tag}`] || 0;
        const diff = last - first;
        Trafo3Total += Math.abs(diff) > 1e25 ? 0 : +diff;
        }

            let Trafo4Total = 0;
        for (const tag of Trafo4Tags) {
        const first = entry[`first_${tag}`] || 0;
        const last = entry[`last_${tag}`] || 0;
        const diff = last - first;
        Trafo4Total += Math.abs(diff) > 1e25 ? 0 : +diff;
        }

       


    return {
  date: formattedDate,
   Trafo1: +Trafo1Total.toFixed(2),
   Trafo2: +Trafo2Total.toFixed(2),
   Trafo3: +Trafo3Total.toFixed(2),
   Trafo4: +Trafo4Total.toFixed(2),


  
};

  });
}

  
}

  


  


  

 


  

