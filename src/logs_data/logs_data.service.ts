import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { LogsQueryDto } from "./dto/logs-query.dto";
import * as moment from 'moment-timezone';

@Injectable()
export class LogsDataService {
 constructor(
  @InjectConnection('surajcotton') private readonly connection: Connection
) {}


  private readonly tagGroups = {
    voltage: ["Voltage_AN","Voltage_BN","Voltage_CN", "Voltage_LN_Avg"],
    current: ["Current_A", "Current_B", "Current_C"],
    power_factor: ["PowerFactor_A","PowerFactor_B","PowerFactor_C"],
    active_power: ["ActivePower_Total"],
    reactive_power: ["ReactivePower_Total"],
    reactive_energy: ["ActiveEnergy_Total"],
    apparent_power: ["ApparentPower_Total"],
    Harmonics: ["Harmonics_V1","Harmonics_V2","Harmonics_V3"],
    active_energy: ["Del_ActiveEnergy"],
  };

  async fetchLogs(query: LogsQueryDto) {
    const { type, meters, start_date, end_date } = query;

    const baseTags = this.tagGroups[type];
    if (!baseTags) {
      return { success: false, message: "Invalid type specified." };
    }

    const meterIds = meters.split(",");
    const db = this.connection.useDb("surajcotton");
    const collection = db.collection("historical");

    const startISO = `${start_date}T00:00:00.000+05:00`;
    const endISO = `${end_date}T23:59:59.999+05:00`;

    const dbQuery = {
      timestamp: {
        $gte: startISO,
        $lte: endISO,
      },
    };

    const data = await collection.find(dbQuery).toArray();
    console.log(`Fetched ${data.length} records`);

    const results: any[] = [];

    for (const item of data) {
      for (const meterId of meterIds) {
        const entry: any = {
          time: item.timestamp
            ? moment(item.timestamp).tz("Asia/Karachi").format("YYYY-MM-DDTHH:mm:ss.SSSZ")
            : null,
          meterId,
        };

        for (const tag of baseTags) {
          const field = `${meterId}_${tag}`;
          if (item[field] !== undefined) {
            entry[tag] = item[field];
          }
        }

        if (Object.keys(entry).length > 2) {
          results.push(entry);
        }
      }
    }

    return { success: true, data: results };
  }
}
