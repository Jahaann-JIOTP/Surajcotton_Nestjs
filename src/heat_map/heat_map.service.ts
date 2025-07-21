
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

  const Trafo1Tags = ["U21_PLC_ActivePower_Total"];
  const Trafo2Tags = ["U13_GW01_ActivePower_Total"];
  const Trafo3Tags = ["U13_GW02_ActivePower_Total"];
  const Trafo4Tags = ["U16_GW03_ActivePower_Total"];

  const allTags = [...Trafo1Tags, ...Trafo2Tags, ...Trafo3Tags, ...Trafo4Tags];

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
          allTags.map(tag => [`last_${tag}`, { $last: { $ifNull: [`$${tag}`, 0] } }])
        )
      }
    },
    { $sort: { _id: 1 } }
  ];

  const data = await collection.aggregate(pipeline).toArray();

  return data.map(entry => {
    const formattedDate = moment(entry._id).tz("Asia/Karachi").format("YYYY-MM-DD HH:mm");

    const Trafo1Total = Trafo1Tags.reduce((sum, tag) => sum + +(entry[`last_${tag}`] || 0), 0);
    const Trafo2Total = Trafo2Tags.reduce((sum, tag) => sum + +(entry[`last_${tag}`] || 0), 0);
    const Trafo3Total = Trafo3Tags.reduce((sum, tag) => sum + +(entry[`last_${tag}`] || 0), 0);
    const Trafo4Total = Trafo4Tags.reduce((sum, tag) => sum + +(entry[`last_${tag}`] || 0), 0);

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

  


  


  

 


  

