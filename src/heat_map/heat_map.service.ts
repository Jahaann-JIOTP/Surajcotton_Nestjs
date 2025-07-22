
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

  const startDateTime = moment.tz(startDate, "YYYY-MM-DD", "Asia/Karachi").startOf('day').toDate();
  const endDateTime = moment.tz(endDate, "YYYY-MM-DD", "Asia/Karachi").endOf('day').toDate();

  const Trafo1Tags = ["U21_PLC_ActivePower_Total"];
  const Trafo2Tags = ["U13_GW01_ActivePower_Total"];
  const Trafo3Tags = ["U13_GW02_ActivePower_Total"];
  const Trafo4Tags = ["U16_GW03_ActivePower_Total"];

  const allTags = [...Trafo1Tags, ...Trafo2Tags, ...Trafo3Tags, ...Trafo4Tags];

  const pipeline = [
    {
      $addFields: {
        timestampDate: { $toDate: "$timestamp" }
      }
    },
    {
      $match: {
        timestampDate: {
          $gte: startDateTime,
          $lte: endDateTime,
        }
      }
    },
    {
      $addFields: {
        hourBin: {
          $dateTrunc: {
            date: "$timestampDate",
            unit: "hour",
            timezone: "Asia/Karachi"
          }
        }
      }
    },
    {
      $group: {
        _id: "$hourBin",
        ...Object.fromEntries(
          allTags.map(tag => [
            `avg_${tag}`,
            { $avg: { $ifNull: [`$${tag}`, 0] } },
          ])
        )
      }
    },
    {
      $sort: { _id: 1 }
    }
  ];

  const rawData = await collection.aggregate(pipeline).toArray();

  return rawData.map(entry => {
    const date = moment(entry._id).tz("Asia/Karachi").format("YYYY-MM-DD HH:mm");

    const Trafo1 = Trafo1Tags.reduce((sum, tag) => sum + +(entry[`avg_${tag}`] || 0), 0);
    const Trafo2 = Trafo2Tags.reduce((sum, tag) => sum + +(entry[`avg_${tag}`] || 0), 0);
    const Trafo3 = Trafo3Tags.reduce((sum, tag) => sum + +(entry[`avg_${tag}`] || 0), 0);
    const Trafo4 = Trafo4Tags.reduce((sum, tag) => sum + +(entry[`avg_${tag}`] || 0), 0);

    return {
      date,
      Trafo1: +Trafo1.toFixed(2),
      Trafo2: +Trafo2.toFixed(2),
      Trafo3: +Trafo3.toFixed(2),
      Trafo4: +Trafo4.toFixed(2),
    };
  });
}




  
}

  


  


  

 


  

