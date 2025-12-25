import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import * as moment from "moment-timezone";
import { powercomparisonHistoricalDataDocument } from "./schemas/power_comparison.schema";
import { Unit4LT1Service } from "../unit4_lt1/unit4_lt1.service";
import { Unit4LT2Service } from "../unit4_lt2/unit4_lt2.service";
import { Unit5LT3Service } from "../unit5_lt3/unit5_lt3.service";
import { Unit5LT4Service } from "../unit5_lt4/unit5_lt4.service";

// -------------------- Interfaces --------------------
interface PerformanceMetrics {
  dbQueryTime: number;
  dataProcessingTime: number;
  externalApiTime: number;
  totalTime: number;
  recordsProcessed: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: Date;
}

interface CacheEntry {
  data: EnergyResult[];
  timestamp: number;
  metrics: PerformanceMetrics;
}

interface PerformanceMonitor {
  startTime: [number, number];
  startMemory: NodeJS.MemoryUsage;
  dbQueryTime?: number;
  dataProcessingTime?: number;
  externalApiTime?: number;
  recordsProcessed?: number;
}

export interface EnergyResult {
  date: string;
  HT: number;
  LT: number;
  wapda: number;
  solar: number;
  unit4: number;
  unit5: number;
  losses: number;
  total_consumption: number;
  total_generation: number;
  unaccountable_energy: number;
  efficiency: number;
}

interface MeterGroups {
  [key: string]: string[];
}

// -------------------- Helpers --------------------
class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly limit: number) {}

  async acquire(): Promise<() => void> {
    if (this.active < this.limit) {
      this.active++;
      return () => this.release();
    }
    await new Promise<void>((resolve) => this.queue.push(resolve));
    this.active++;
    return () => this.release();
  }

  private release() {
    this.active--;
    const next = this.queue.shift();
    if (next) next();
  }
}

// -------------------- Service --------------------
@Injectable()
export class powercomparisonService {
  private readonly logger = new Logger(powercomparisonService.name);

  private readonly TIMEZONE = "Asia/Karachi";

  private readonly VALIDATION = {
    minValidValue: 1e-6,
    maxValidValue: 1e12,
  };

  // Cache
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 min
  private readonly cache = new Map<string, CacheEntry>();
  private cacheHits = 0;
  private cacheMisses = 0;

  // Metrics
  private readonly performanceMetrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS_STORAGE = 1000;

  // External API
  private readonly EXTERNAL_API_TIMEOUT_MS = 2000;

  /**
   * Concurrency for "dates in-flight".
   * Each date triggers 4 service calls (Unit4LT1, Unit4LT2, Unit5LT3, Unit5LT4) concurrently.
   * So DATE_CONCURRENCY=32 means up to 32 * 4 = 128 promises in flight (worst case).
   */
  private readonly DATE_CONCURRENCY = 32;

  private readonly DEBUG = false; // turn ON only when needed

  private readonly METER_GROUPS: MeterGroups = {
    ht: ["U22_PLC_Del_ActiveEnergy", "U26_PLC_Del_ActiveEnergy"],
    lt: ["U19_PLC_Del_ActiveEnergy", "U11_GW01_Del_ActiveEnergy"],
    wapda: ["U23_GW01_Del_ActiveEnergy", "U27_PLC_Del_ActiveEnergy"],
    solar: [
      "U6_GW02_Del_ActiveEnergy",
      "U17_GW03_Del_ActiveEnergy",
      "U24_GW01_Del_ActiveEnergy",
      "U28_PLC_Del_ActiveEnergy",
    ],
    unit4: [
      "U19_PLC_Del_ActiveEnergy",
      "U21_PLC_Del_ActiveEnergy",
      "U11_GW01_Del_ActiveEnergy",
      "U13_GW01_Del_ActiveEnergy",
      "U24_GW01_Del_ActiveEnergy",
      "U28_PLC_Del_ActiveEnergy",
    ],
    unit5: [
      "U6_GW02_Del_ActiveEnergy",
      "U13_GW02_Del_ActiveEnergy",
      "U16_GW03_Del_ActiveEnergy",
      "U17_GW03_Del_ActiveEnergy",
    ],
    aux: ["U25_PLC_Del_ActiveEnergy"],
    Trafo1Incoming: ["U23_GW01_Del_ActiveEnergy"],
    Trafo2Incoming: ["U22_GW01_Del_ActiveEnergy"],
    Trafo3Incoming: ["U20_GW03_Del_ActiveEnergy"],
    Trafo4Incoming: ["U19_GW03_Del_ActiveEnergy"],
    Trafo1outgoing: ["U21_PLC_Del_ActiveEnergy"],
    Trafo2outgoing: ["U13_GW01_Del_ActiveEnergy"],
    Trafo3outgoing: ["U13_GW02_Del_ActiveEnergy"],
    Trafo4outgoing: ["U16_GW03_Del_ActiveEnergy"],
    Wapda2: ["U27_PLC_Del_ActiveEnergy"],
    Niigata: ["U22_PLC_Del_ActiveEnergy"],
    JMS: ["U26_PLC_Del_ActiveEnergy"],
    PH_IC: ["U22_GW01_Del_ActiveEnergy"],
  };

  private readonly ALL_TAGS: string[] = Object.values(this.METER_GROUPS).flat();
  private readonly meterGroupEntries = Object.entries(this.METER_GROUPS);

  // Aggregation projections (precomputed)
  private readonly tagProjections: Record<string, any> = {};

  constructor(
    @InjectModel("power_comparison", "surajcotton")
    private readonly conModel: Model<powercomparisonHistoricalDataDocument>,
    private readonly unit4LT1Service: Unit4LT1Service,
    private readonly unit4LT2Service: Unit4LT2Service,
    private readonly Unit5LT3Service: Unit5LT3Service,
    private readonly Unit5LT4Service: Unit5LT4Service
  ) {
    this.initializePerformanceOptimizations();
  }

  // -------------------- Init --------------------
  private initializePerformanceOptimizations() {
    for (const tag of this.ALL_TAGS) {
      this.tagProjections[`first_${tag}`] = { $first: { $ifNull: [`$${tag}`, 0] } };
      this.tagProjections[`last_${tag}`] = { $last: { $ifNull: [`$${tag}`, 0] } };
    }
  }

  // -------------------- Utils --------------------
  private round2(n: number) {
    return Math.round(n * 100) / 100;
  }

  private withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
    return new Promise<T>((resolve) => {
      const t = setTimeout(() => resolve(fallback), ms);
      p.then((v) => {
        clearTimeout(t);
        resolve(v);
      }).catch(() => {
        clearTimeout(t);
        resolve(fallback);
      });
    });
  }

  private getCacheKey(
    startDate: string,
    endDate: string,
    label: string,
    startTime?: string,
    endTime?: string
  ): string {
    return `${startDate}_${startTime ?? "06:00"}__${endDate}_${endTime ?? "06:00"}__${label}`;
  }

  private setCache(key: string, data: EnergyResult[], metrics: PerformanceMetrics) {
    this.cache.set(key, { data, timestamp: Date.now(), metrics });

    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value as string | undefined;
      if (firstKey) this.cache.delete(firstKey);
    }
  }

  private getCache(key: string): CacheEntry | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheMisses++;
      return null;
    }
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(key);
      this.cacheMisses++;
      return null;
    }
    this.cacheHits++;
    return entry;
  }

  private calculateCacheHitRate(): string {
    const total = this.cacheHits + this.cacheMisses;
    if (!total) return "N/A";
    return `${((this.cacheHits / total) * 100).toFixed(1)}%`;
  }

  // -------------------- Metrics --------------------
  private startPerformanceMonitoring(): PerformanceMonitor {
    return {
      startTime: process.hrtime(),
      startMemory: process.memoryUsage(),
    };
  }

  private calculatePerformanceMetrics(monitor: PerformanceMonitor): PerformanceMetrics {
    const [seconds, nanoseconds] = process.hrtime(monitor.startTime);
    const totalTime = seconds * 1000 + nanoseconds / 1e6;

    return {
      dbQueryTime: monitor.dbQueryTime ?? 0,
      dataProcessingTime: monitor.dataProcessingTime ?? 0,
      externalApiTime: monitor.externalApiTime ?? 0,
      totalTime,
      recordsProcessed: monitor.recordsProcessed ?? 0,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date(),
    };
  }

  private storeMetrics(metrics: PerformanceMetrics) {
    this.performanceMetrics.push(metrics);
    if (this.performanceMetrics.length > this.MAX_METRICS_STORAGE) {
      this.performanceMetrics.shift();
    }
  }

  getPerformanceInsights(): any {
    if (this.performanceMetrics.length === 0) return null;

    const latest = this.performanceMetrics[this.performanceMetrics.length - 1];
    const avgTotalTime =
      this.performanceMetrics.reduce((sum, m) => sum + m.totalTime, 0) /
      this.performanceMetrics.length;

    const avgDbTime =
      this.performanceMetrics.reduce((sum, m) => sum + m.dbQueryTime, 0) /
      this.performanceMetrics.length;

    const avgProcessingTime =
      this.performanceMetrics.reduce((sum, m) => sum + m.dataProcessingTime, 0) /
      this.performanceMetrics.length;

    return {
      latest: {
        totalTime: `${latest.totalTime.toFixed(2)}ms`,
        dbQueryTime: `${latest.dbQueryTime.toFixed(2)}ms`,
        dataProcessingTime: `${latest.dataProcessingTime.toFixed(2)}ms`,
        externalApiTime: `${latest.externalApiTime.toFixed(2)}ms`,
        recordsProcessed: latest.recordsProcessed,
        memoryUsage: `${Math.round(latest.memoryUsage.heapUsed / 1024 / 1024)}MB`,
      },
      averages: {
        totalTime: `${avgTotalTime.toFixed(2)}ms`,
        dbQueryTime: `${avgDbTime.toFixed(2)}ms`,
        dataProcessingTime: `${avgProcessingTime.toFixed(2)}ms`,
      },
      cache: {
        size: this.cache.size,
        hitRate: this.calculateCacheHitRate(),
      },
      totalRequests: this.performanceMetrics.length,
    };
  }

  // -------------------- Aggregation --------------------
  /**
   * NOTE:
   * If your Mongo "timestamp" field is already a Date, remove $addFields date:$toDate
   * and match directly on timestamp. That is a BIG DB win.
   */
  private createAggregationPipeline(
    startDateTime: Date,
    endDateTime: Date,
    groupBy: "hour" | "day" | "month" = "hour"
  ) {
    const pipeline: any[] = [
      { $addFields: { date: { $toDate: "$timestamp" } } },
      { $match: { date: { $gte: startDateTime, $lte: endDateTime } } },
      { $sort: { date: 1 } }, // required for $first/$last correctness
    ];

    if (groupBy === "hour") {
      pipeline.push({
        $group: {
          _id: {
            $dateTrunc: { date: "$date", unit: "hour", timezone: this.TIMEZONE },
          },
          ...this.tagProjections,
        },
      });
    } else if (groupBy === "day") {
      // shift day boundary (06:00)
      pipeline.push({
        $addFields: {
          energyDate: {
            $dateSubtract: { startDate: "$date", unit: "hour", amount: 6 },
          },
        },
      });

      pipeline.push({
        $group: {
          _id: {
            $dateTrunc: { date: "$energyDate", unit: "day", timezone: this.TIMEZONE },
          },
          ...this.tagProjections,
        },
      });
    } else {
      pipeline.push({
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m", date: "$date", timezone: this.TIMEZONE },
          },
          ...this.tagProjections,
        },
      });
    }

    pipeline.push({ $sort: { _id: 1 } });
    return pipeline;
  }

  // -------------------- Calculations --------------------
  private calculateEnergyTotals(entry: any) {
    const totals: Record<string, number> = {};

    for (const [groupName, tags] of this.meterGroupEntries) {
      let groupTotal = 0;

      for (const tag of tags) {
        const first = entry[`first_${tag}`] ?? 0;
        const last = entry[`last_${tag}`] ?? 0;

        let diff = last - first;
        const ad = Math.abs(diff);

        if (ad > this.VALIDATION.maxValidValue || ad < this.VALIDATION.minValidValue) diff = 0;

        groupTotal += diff;
      }

      totals[groupName] = this.round2(groupTotal);
    }

    return totals;
  }

  private calculateLosses(totals: any) {
    const T1andT2incoming = (totals.Trafo1Incoming ?? 0) + (totals.Trafo2Incoming ?? 0);
    const T1andT2outgoing = (totals.Trafo1outgoing ?? 0) + (totals.Trafo2outgoing ?? 0);
    const T1andT2losses = T1andT2incoming - T1andT2outgoing;

    const Trafo3losses = (totals.Trafo3Incoming ?? 0) - (totals.Trafo3outgoing ?? 0);
    const Trafo4losses = (totals.Trafo4Incoming ?? 0) - (totals.Trafo4outgoing ?? 0);

    const transformerLosses = T1andT2losses + Trafo3losses + Trafo4losses;

    const HT_Transmission_Losses =
      ((totals.Wapda2 ?? 0) + (totals.Niigata ?? 0) + (totals.JMS ?? 0)) -
      ((totals.Trafo3Incoming ?? 0) + (totals.Trafo4Incoming ?? 0) + (totals.PH_IC ?? 0));

    return this.round2(transformerLosses + HT_Transmission_Losses);
  }

  // -------------------- External API (Optimized) --------------------
  private extractUnaccounted(data: any): number {
    const sankeyData = Array.isArray(data) ? data : data?.sankeyData ?? [];
    const node = sankeyData.find((n: any) => n?.to === "Unaccounted Energy");
    const v = node?.value ?? 0;
    return Number.isFinite(v) ? v : 0;
  }

  private buildPayload(
    timeframe: "hourly" | "daily" | "monthly",
    dateKey: string,
    startTime?: string,
    endTime?: string
  ) {
    if (timeframe === "hourly") {
      // dateKey expected: "YYYY-MM-DD HH:mm:ss"
      const m = moment.tz(dateKey, "YYYY-MM-DD HH:mm:ss", this.TIMEZONE);
      return {
        startDate: m.format("YYYY-MM-DD"),
        startTime: m.format("HH:mm"),
        endDate: m.format("YYYY-MM-DD"),
        endTime: m.clone().add(1, "hour").format("HH:mm"),
      };
    }

    // daily/monthly: dateKey expected: "YYYY-MM-DD"
    const base = moment.tz(dateKey, "YYYY-MM-DD", this.TIMEZONE);
    return {
      startDate: base.format("YYYY-MM-DD"),
      endDate: base.clone().add(1, "day").format("YYYY-MM-DD"),
      startTime: startTime ?? "06:00",
      endTime: endTime ?? "06:00",
    };
  }

  private async fetchUnaccountedForPayload(payload: any): Promise<number> {
    const apiPromise = Promise.allSettled([
      this.unit4LT1Service.getSankeyData(payload),
      this.unit4LT2Service.getSankeyData(payload),
      this.Unit5LT3Service.getSankeyData(payload),
      this.Unit5LT4Service.getSankeyData(payload),
    ]).then((results) => {
      let total = 0;
      for (const r of results) {
        if (r.status === "fulfilled") {
          total += this.extractUnaccounted(r.value);
        }
      }
      return total;
    });

    return this.withTimeout(apiPromise, this.EXTERNAL_API_TIMEOUT_MS, 0);
  }

  /**
   * Returns Map<dateKey, unaccountedEnergy>
   * dateKey must match what you later use for lookups.
   */
  private async fetchBatchUnaccountedEnergy(
    dateKeys: string[],
    timeframe: "hourly" | "daily" | "monthly",
    startTime?: string,
    endTime?: string
  ): Promise<Map<string, number>> {
    const results = new Map<string, number>();
    if (!dateKeys.length) return results;

    const sem = new Semaphore(this.DATE_CONCURRENCY);

    await Promise.all(
      dateKeys.map(async (dateKey) => {
        const release = await sem.acquire();
        try {
          const payload = this.buildPayload(timeframe, dateKey, startTime, endTime);
          const val = await this.fetchUnaccountedForPayload(payload);
          results.set(dateKey, val);
        } finally {
          release();
        }
      })
    );

    return results;
  }

  // -------------------- Main API --------------------
  async getPowerData(
    startDate: string,
    endDate: string,
    label: string = "hourly",
    startTime?: string, // "HH:mm"
    endTime?: string // "HH:mm"
  ): Promise<EnergyResult[]> {
    const monitor = this.startPerformanceMonitoring();

    const cacheKey = this.getCacheKey(startDate, endDate, label, startTime, endTime);
    const cached = this.getCache(cacheKey);
    if (cached) {
      if (this.DEBUG) {
        this.logger.log(`CACHE HIT: ${cacheKey} -> ${cached.data.length} records`);
      }
      this.storeMetrics(cached.metrics);
      return cached.data;
    }

    if (this.DEBUG) {
      this.logger.log(`CACHE MISS: ${cacheKey}`);
    }

    try {
      const isHourly = label === "hourly";
      const isDaily = label === "daily";

      const startMoment = moment
  .tz(`${startDate} ${startTime ?? "06:00"}`, "YYYY-MM-DD HH:mm", this.TIMEZONE)
  .second(0)
  .millisecond(0);

let endMoment: moment.Moment;

if (label === "hourly") {
  if (endTime) {
    // frontend-defined hourly range
    endMoment = moment.tz(
      `${endDate} ${endTime}`,
      "YYYY-MM-DD HH:mm",
      this.TIMEZONE
    );
  } else {
    // 🔑 hourly range = full date span
    endMoment = moment
      .tz(`${endDate} ${startTime ?? "06:00"}`, "YYYY-MM-DD HH:mm", this.TIMEZONE)
      .add(1, "day");
  }
}

else if (label === "daily") {
  // 🔑 frontend-driven daily window
  endMoment = moment.tz(
    `${endDate} ${endTime ?? "06:00"}`,
    "YYYY-MM-DD HH:mm",
    this.TIMEZONE
  );
}
else {
  // monthly
  endMoment = moment.tz(
    `${endDate} ${endTime ?? "06:00"}`,
    "YYYY-MM-DD HH:mm",
    this.TIMEZONE
  );
}

endMoment = endMoment.second(0).millisecond(0);

// Safety
if (!endMoment.isAfter(startMoment)) {
  if (label === "hourly") endMoment = startMoment.clone().add(1, "hour");
  else if (label === "daily") endMoment = startMoment.clone().add(1, "day");
  else endMoment = startMoment.clone().add(1, "month");
}



      const startDateTime = startMoment.toDate();
      const endDateTime = endMoment.toDate();

      // Group config
      let groupBy: "hour" | "day" | "month" = "hour";

      if (label === "daily") groupBy = "day";
      else if (label === "monthly") groupBy = "month";
      else groupBy = "hour";

      // DB query
      const dbQueryStart = process.hrtime();

      const collection = this.conModel.collection;
      const pipeline = this.createAggregationPipeline(startDateTime, endDateTime, groupBy);

      // allowDiskUse helps when range is big
      const data = await collection.aggregate(pipeline, { allowDiskUse: true }).toArray();

      const [dbSeconds, dbNanoseconds] = process.hrtime(dbQueryStart);
      monitor.dbQueryTime = dbSeconds * 1000 + dbNanoseconds / 1e6;

      if (this.DEBUG) {
        this.logger.log(`DB returned ${data.length} records in ${monitor.dbQueryTime.toFixed(0)}ms`);
      }

      if (!data.length) return [];

      monitor.recordsProcessed = data.length;

      // External API (Skip hourly as per your logic)
      const externalApiStart = process.hrtime();

      // Build keys exactly as you will later lookup
      // For groupBy=hour: key => "YYYY-MM-DD HH:mm:ss"
      // For groupBy=day:  key => "YYYY-MM-DD"
      // For month: we typically do not call unaccounted here in your logic (but if you want, you can)
      const dateKeys: string[] = data.map((entry: any) => {
        const m = moment(entry._id).tz(this.TIMEZONE);
        if (groupBy === "hour") return m.format("YYYY-MM-DD HH:mm:ss");
        if (groupBy === "day") return m.format("YYYY-MM-DD");
        return m.format("YYYY-MM-DD"); // month fallback
      });

      let unaccountedEnergyMap = new Map<string, number>();
      if (label !== "hourly") {
        unaccountedEnergyMap = await this.fetchBatchUnaccountedEnergy(
          dateKeys,
          label as "daily" | "monthly",
          startTime,
          endTime
        );
      }

      const [extSeconds, extNanoseconds] = process.hrtime(externalApiStart);
      monitor.externalApiTime = extSeconds * 1000 + extNanoseconds / 1e6;

      // Processing
      const processingStart = process.hrtime();
      const results: EnergyResult[] = [];

      for (const entry of data) {
        const m = moment(entry._id).tz(this.TIMEZONE);

        let formattedDate = "";
        let lookupKey = "";

        if (groupBy === "hour") {
          formattedDate = m.format("YYYY-MM-DD HH:mm");
          lookupKey = m.format("YYYY-MM-DD HH:mm:ss");
        } else if (groupBy === "day") {
          formattedDate = m.format("YYYY-MM-DD");
          // your alignment logic: +6 hours
          lookupKey = m.clone().add(6, "hours").format("YYYY-MM-DD");
        } else {
          formattedDate = m.format("YYYY-MM");
          lookupKey = m.format("YYYY-MM-DD");
        }

        const totals = this.calculateEnergyTotals(entry);
        const losses = this.calculateLosses(totals);

        const totalConsumption = (totals.unit4 ?? 0) + (totals.unit5 ?? 0) + (totals.aux ?? 0);
        const totalGeneration =
          (totals.ht ?? 0) + (totals.lt ?? 0) + (totals.wapda ?? 0) + (totals.solar ?? 0);

        const efficiency =
          totalGeneration > 0 ? this.round2((totalConsumption / totalGeneration) * 100) : 0;

        const unaccountable_energy =
          label === "hourly" ? 0 : this.round2(unaccountedEnergyMap.get(lookupKey) ?? 0);

        results.push({
          date: formattedDate,
          HT: totals.ht ?? 0,
          LT: totals.lt ?? 0,
          wapda: totals.wapda ?? 0,
          solar: totals.solar ?? 0,
          unit4: totals.unit4 ?? 0,
          unit5: totals.unit5 ?? 0,
          losses,
          total_consumption: this.round2(totalConsumption),
          total_generation: this.round2(totalGeneration),
          unaccountable_energy,
          efficiency,
        });
      }

      const [pSeconds, pNanoseconds] = process.hrtime(processingStart);
      monitor.dataProcessingTime = pSeconds * 1000 + pNanoseconds / 1e6;

      // Final metrics
      const metrics = this.calculatePerformanceMetrics(monitor);
      this.storeMetrics(metrics);
      this.setCache(cacheKey, results, metrics);

      if (this.DEBUG) {
        this.logger.log(
          `DONE ${label}: ${results.length} rows | total ${metrics.totalTime.toFixed(
            0
          )}ms | db ${metrics.dbQueryTime.toFixed(0)}ms | api ${metrics.externalApiTime.toFixed(
            0
          )}ms | proc ${metrics.dataProcessingTime.toFixed(0)}ms`
        );
      }

      return results;
    } catch (error: any) {
      const errMetrics = this.calculatePerformanceMetrics(monitor);
      this.storeMetrics(errMetrics);
      this.logger.error(`Processing failed: ${error?.message ?? error}`, error?.stack);
      throw error;
    }
  }

  // -------------------- Compatibility wrappers --------------------
  async getPowerAverages(startDate: string, endDate: string): Promise<EnergyResult[]> {
    return this.getPowerData(startDate, endDate, "hourly");
  }

  async getDailyPowerAverages(startDate: string, endDate: string): Promise<EnergyResult[]> {
    return this.getPowerData(startDate, endDate, "daily");
  }

  async getMonthlyAverages(startDate: string, endDate: string): Promise<EnergyResult[]> {
    return this.getPowerData(startDate, endDate, "monthly");
  }

  async getPowerDataOld(startDate: string, endDate: string, label: string) {
    return this.getPowerData(startDate, endDate, label);
  }

  // -------------------- Cache ops --------------------
  clearCache(): void {
    this.cache.clear();
    this.logger.log("Cache cleared");
  }

  getCacheStats(): any {
    return {
      size: this.cache.size,
      hitRate: this.calculateCacheHitRate(),
      hits: this.cacheHits,
      misses: this.cacheMisses,
      keys: Array.from(this.cache.keys()),
      entries: Array.from(this.cache.entries()).map(([key, entry]) => ({
        key,
        ageMs: Date.now() - entry.timestamp,
        dataLength: entry.data.length,
      })),
    };
  }
}
