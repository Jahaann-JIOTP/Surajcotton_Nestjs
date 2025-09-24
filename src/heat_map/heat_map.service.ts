
import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { MongoClient } from 'mongodb';
// import * as moment from 'moment-timezone';
import * as moment from 'moment';
import { HeatMap, HeatMapDocument } from './schemas/heat_map.schema';
import {TransformerInput,TransformerInputDocument} from './schemas/transformer.schema';
import { CreateTransformerInputDto } from './dto/create-transformer-input.dto';




@Injectable()
export class HeatMapService  {
  

  constructor(
    @InjectModel('HeatMap', 'surajcotton') private readonly conModel: Model<HeatMapDocument>,
    @InjectModel(TransformerInput.name, 'surajcotton')
    private readonly transformerModel: Model<TransformerInputDocument>,
  ) {}

async getPowerAverages(startDate: string, endDate: string) {
  const collection = this.conModel.collection;

  // ✅ StartDate always at 6 AM
  const startDateTime = moment
    .tz(startDate, "YYYY-MM-DD", "Asia/Karachi")
    .hour(6).minute(0).second(0).millisecond(0)
    .toDate();

  // ✅ EndDate always next day's 6 AM
  const endDateTime = moment
    .tz(endDate, "YYYY-MM-DD", "Asia/Karachi")
    .add(1, "day")
    .hour(7).minute(0).second(0).millisecond(0)
    .toDate();

  const Trafo1Tags = ["U21_PLC_ActivePower_Total"];
  const Trafo2Tags = ["U13_GW01_ActivePower_Total"];
  const Trafo3Tags = ["U13_GW02_ActivePower_Total"];
  const Trafo4Tags = ["U16_GW03_ActivePower_Total"];

  const allTags = [...Trafo1Tags, ...Trafo2Tags, ...Trafo3Tags, ...Trafo4Tags];

  // 🔹 STEP 1: Fetch raw docs
  const rawDocs = await collection
    .aggregate([
      {
        $addFields: {
          timestampDate: { $toDate: "$timestamp" },
        },
      },
      {
        $match: {
          timestampDate: { $gte: startDateTime, $lte: endDateTime },
        },
      },
      {
        $project: {
          timestampDate: 1,
          ...Object.fromEntries(allTags.map((tag) => [tag, 1])),
        },
      },
      { $sort: { timestampDate: 1 } },
    ])
    .toArray();

  // 🔹 STEP 2: Grouping logic (include next hour’s :00 in current group)
  const results: any[] = [];
  let current = moment(startDateTime);
  const end = moment(endDateTime).subtract(1, "hour");

  while (current.isSameOrBefore(end)) {
    const hourStart = current.clone();
    const hourEnd = current.clone().add(1, "hour");

    // 👉 Match docs between [hourStart, hourEnd] inclusive
    let matchedDocs = rawDocs.filter((d) => {
      const t = moment(d.timestampDate);
      return t.isBetween(hourStart, hourEnd, null, "[]");
    });

    // ✅ Add next hour’s :00 doc also
    const nextHourDoc = rawDocs.find(
      (d) => moment(d.timestampDate).isSame(hourEnd, "minute")
    );
    if (nextHourDoc) {
      matchedDocs.push(nextHourDoc);
    }

    // console.log(
    //   "Hour:",
    //   hourStart.format("YYYY-MM-DD HH:00"),
    //   "Docs:",
    //   matchedDocs.map((d) => moment(d.timestampDate).format("HH:mm"))
    // );

    let Trafo1 = 0,
      Trafo2 = 0,
      Trafo3 = 0,
      Trafo4 = 0;

    if (matchedDocs.length > 0) {
      Trafo1 =
        Trafo1Tags.reduce(
          (sum, tag) =>
            sum + matchedDocs.reduce((s, d) => s + +(d[tag] || 0), 0),
          0
        ) / matchedDocs.length;

      Trafo2 =
        Trafo2Tags.reduce(
          (sum, tag) =>
            sum + matchedDocs.reduce((s, d) => s + +(d[tag] || 0), 0),
          0
        ) / matchedDocs.length;

      Trafo3 =
        Trafo3Tags.reduce(
          (sum, tag) =>
            sum + matchedDocs.reduce((s, d) => s + +(d[tag] || 0), 0),
          0
        ) / matchedDocs.length;

      Trafo4 =
        Trafo4Tags.reduce(
          (sum, tag) =>
            sum + matchedDocs.reduce((s, d) => s + +(d[tag] || 0), 0),
          0
        ) / matchedDocs.length;
    }

    results.push({
      date: hourStart.format("YYYY-MM-DD HH:00"),
      Trafo1and2: +(Trafo1 + Trafo2).toFixed(2),
      Trafo3: +Trafo3.toFixed(2),
      Trafo4: +Trafo4.toFixed(2),
    });

    current.add(1, "hour");
  }

  return results;
}








async create(dto: CreateTransformerInputDto) {
  if (!['T1', 'T2', 'T3', 'T4'].includes(dto.transformerName)) {
    throw new BadRequestException('Invalid transformerName');
  }
  return this.transformerModel.create({
    transformerName: dto.transformerName,
    value: dto.value,
  });
}


async latestFor(name: string) {
  return this.transformerModel
    .findOne({ transformerName: name }) // ✅ sirf ek hi record
    .sort({ createdAt: -1 })            // ✅ latest (timestamps se sort)
    .lean();
}

}



  


  


  


  

 


  

