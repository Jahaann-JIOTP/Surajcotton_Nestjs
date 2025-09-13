// import { Model } from 'mongoose';
// import * as moment from 'moment-timezone';

// export async function getConsumption(
//   historicalModel: Model<any>,
//   startDate: string,
//   endDate: string,
//   meterIdsStr: string,
//   suffixesStr: string,
// ) {
//   const start = moment.tz(startDate, 'Asia/Karachi').startOf('day').add(6, 'hours');
//   const end = moment.tz(endDate, 'Asia/Karachi').endOf('day').add(6, 'hours');

//   const meterIds = meterIdsStr.split(',').map(m => m.trim());
//   const suffixes = suffixesStr.split(',').map(s => s.trim());

//   // projection build
//   const projection: any = { timestamp: 1 };
//   meterIds.forEach(meterId => {
//     suffixes.forEach(suffix => {
//       projection[`${meterId}_${suffix}`] = 1;
//     });
//   });

//   const raw = await historicalModel
//     .find({ timestamp: { $gte: start.toDate(), $lte: end.toDate() } }, projection)
//     .sort({ timestamp: 1 })
//     .lean();

//   const bucketed: Record<string, number[]> = {};

//   raw.forEach(doc => {
//     let ts = moment(doc.timestamp);

//     // floor to 15 min
//     const minutes = Math.floor(ts.minutes() / 15) * 15;
//     ts = ts.minutes(minutes).seconds(0).milliseconds(0);

//     const bucketKey = ts.format('YYYY-MM-DD HH:mm');

//     // sum across all meter+suffix
//     let sumVal = 0;
//     meterIds.forEach(meterId => {
//       suffixes.forEach(suffix => {
//         const key = `${meterId}_${suffix}`;
//         sumVal += doc[key] || 0;
//       });
//     });

//     if (!bucketed[bucketKey]) bucketed[bucketKey] = [];
//     bucketed[bucketKey].push(sumVal);
//   });

//   // average per bucket
//   const avgBucketed = Object.entries(bucketed).map(([k, arr]) => ({
//     timestamp: k,
//     energy: arr.reduce((a, b) => a + b, 0) / arr.length,
//   }));

//   // Δenergy per 15 min
//   const result: any[] = [];
//   for (let i = 1; i < avgBucketed.length; i++) {
//     const prev = avgBucketed[i - 1];
//     const curr = avgBucketed[i];
//     result.push({
//       timestamp: curr.timestamp,
//       consumption: Math.max(curr.energy - prev.energy, 0),
//     });
//   }

//   return result;
// }
