import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection } from "mongoose";
import { LogsQueryDto } from "./dto/logs-query.dto";
import * as moment from "moment-timezone";

@Injectable()
export class LogsDataService {
  constructor(
    @InjectConnection("surajcotton") private readonly connection: Connection
  ) {}

  private readonly tagGroups = {
    voltage: ["Voltage_AB", "Voltage_BC", "Voltage_CA", "Voltage_Avg"],
    current: ["Current_A", "Current_B", "Current_C", "Current_Avg"],
    power_factor: ["PowerFactor_A", "PowerFactor_B", "PowerFactor_C", "PowerFactor_Avg"],
    active_power: ["ActivePower_Total"],
    reactive_power: ["ReactivePower_Total"],
    reactive_energy: ["ActiveEnergy_Total"],
    apparent_power: ["ApparentPower_Total"],
    harmonics: ["Harmonics_V1_THD", "Harmonics_V2_THD", "Harmonics_V3_THD", "Harmonics_I1_THD", "Harmonics_I2_THD", "Harmonics_I3_THD"],
    active_energy: ["Del_ActiveEnergy"],
  } as const;

  /**
   * You can extend LogsQueryDto to include optional page/pageSize, or pass via query string.
   * Example: /logs_data?type=active_power&meters=U_5,U_7&start_date=2025-08-01&end_date=2025-08-02&page=1&pageSize=2000
   */
  async fetchLogs(query: LogsQueryDto & { page?: number; pageSize?: number }) {
    const { type, meters, start_date, end_date } = query;

    const baseTags = (this.tagGroups as any)[type] as string[] | undefined;
    if (!baseTags) {
      return { success: false, message: "Invalid type specified." };
    }

    const meterIds = meters
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    if (meterIds.length === 0) {
      return { success: false, message: "No meters provided." };
    }

    const db = this.connection.useDb("surajcotton");
    const collection = db.collection("historical");

    // Same timestamp style you used (+05:00), so no schema change needed
// Start: given start_date ka 6 AM
const startISO = moment.tz(start_date, "YYYY-MM-DD", "Asia/Karachi")
  .hour(6).minute(0).second(0).millisecond(0)
  .toISOString(true);

// End: end_date ke agle din ka 6 AM
const endISO = moment.tz(end_date, "YYYY-MM-DD", "Asia/Karachi")
  .add(1, "day")   // next day
  .hour(6).minute(0).second(0).millisecond(0)
  .toISOString(true);



    const dbQuery = {
      timestamp: { $gte: startISO, $lte: endISO },
    };

    // ------- PROJECTION: only fetch needed fields -------
    const projection: Record<string, 0 | 1> = { _id: 0, timestamp: 1 };
    for (const meterId of meterIds) {
      for (const tag of baseTags) {
        projection[`${meterId}_${tag}`] = 1;
      }
    }

    // ------- Optional pagination (big ranges => faster first byte) -------
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(5000, Math.max(200, Number(query.pageSize) || 2000));
    const skip = (page - 1) * pageSize;

    // ------- Cursor with sort + batchSize + projection -------
    // NOTE: uncomment .hint if you created index on timestamp
    const cursor = collection
      .find(dbQuery, { projection })
      .sort({ timestamp: 1 })
      .skip(skip)
      .limit(pageSize)
      .batchSize(1000);
      // .hint({ timestamp: 1 });

    const docs = await cursor.toArray();

    // ------- Shape results (same as your original) -------
    const results: any[] = [];
    for (const item of docs) {
      const timeStr = item.timestamp
        ? moment(item.timestamp).tz("Asia/Karachi").format("YYYY-MM-DDTHH:mm:ss.SSSZ")
        : null;

      for (const meterId of meterIds) {
        // Build only if any tag exists (avoid empty objects)
        let hasAny = false;
        const entry: any = { time: timeStr, meterId };

        for (const tag of baseTags) {
          const field = `${meterId}_${tag}`;
          const val = (item as any)[field];
          if (val !== undefined) {
            entry[tag] = val;
            hasAny = true;
          }
        }

        if (hasAny) results.push(entry);
      }
    }

    return {
      success: true,
      data: results,   // [{ time, meterId, <tags...> }]
      page,
      pageSize,
      count: results.length,
    };
  }
}
