import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as moment from 'moment-timezone';
import { powercomparisonHistoricalDataDocument } from './schemas/power_comparison.schema';
import { Unit4LT1Service } from '../unit4_lt1/unit4_lt1.service';
import { Unit4LT2Service } from '../unit4_lt2/unit4_lt2.service';
import { Unit5LT3Service } from '../unit5_lt3/unit5_lt3.service';
import { Unit5LT4Service } from '../unit5_lt4/unit5_lt4.service';

// Performance monitoring interface
interface PerformanceMetrics
{
  dbQueryTime: number;
  dataProcessingTime: number;
  externalApiTime: number;
  totalTime: number;
  recordsProcessed: number;
  memoryUsage: NodeJS.MemoryUsage;
  timestamp: Date;
}

// Cache interface
interface CacheEntry
{
  data: EnergyResult[];
  timestamp: number;
  metrics: PerformanceMetrics;
}

// Monitor interface
interface PerformanceMonitor
{
  startTime: [ number, number ];
  startMemory: NodeJS.MemoryUsage;
  dbQueryTime?: number;
  dataProcessingTime?: number;
  externalApiTime?: number;
  recordsProcessed?: number;
  dbQueryStart?: [ number, number ];
  dataProcessingStart?: [ number, number ];
  externalApiStart?: [ number, number ];
}

// ✅ EXPORT the interface so controller can use it
export interface EnergyResult
{
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

interface MeterGroups
{
  [ key: string ]: string[];
}

@Injectable()
export class powercomparisonService
{
  private readonly TIMEZONE = "Asia/Karachi";
  private readonly VALIDATION = {
    minValidValue: 1e-6,
    maxValidValue: 1e12
  };

  // 🚀 PERFORMANCE: Cache configuration
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private readonly cache = new Map<string, CacheEntry>();
  private readonly performanceMetrics: PerformanceMetrics[] = [];
  private readonly MAX_METRICS_STORAGE = 1000; // Keep last 1000 metrics

  // 🚀 OPTIMAL PERFORMANCE: 2 batches proven fastest
  private readonly EXTERNAL_API_TIMEOUT = 2000; // 2 seconds
  private readonly OPTIMAL_BATCH_SIZE = 16; // 16 dates per batch
  private readonly OPTIMAL_CONCURRENT_BATCHES = 2; // 2 batches concurrently (proven optimal)

  private readonly METER_GROUPS: MeterGroups = {
    ht: [ 'U22_PLC_Del_ActiveEnergy', 'U26_PLC_Del_ActiveEnergy' ],
    lt: [ 'U19_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy' ],
    wapda: [ 'U23_GW01_Del_ActiveEnergy', 'U27_PLC_Del_ActiveEnergy' ],
    solar: [ 'U6_GW02_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy', 'U24_GW01_Del_ActiveEnergy', 'U28_PLC_Del_ActiveEnergy' ],
    unit4: [ 'U19_PLC_Del_ActiveEnergy', 'U21_PLC_Del_ActiveEnergy', 'U11_GW01_Del_ActiveEnergy', 'U13_GW01_Del_ActiveEnergy', 'U24_GW01_Del_ActiveEnergy', 'U28_PLC_Del_ActiveEnergy' ],
    unit5: [ 'U6_GW02_Del_ActiveEnergy', 'U13_GW02_Del_ActiveEnergy', 'U16_GW03_Del_ActiveEnergy', 'U17_GW03_Del_ActiveEnergy' ],
    aux: [ 'U25_PLC_Del_ActiveEnergy' ],
    Trafo1Incoming: [ 'U23_GW01_Del_ActiveEnergy' ],
    Trafo2Incoming: [ 'U22_GW01_Del_ActiveEnergy' ],
    Trafo3Incoming: [ 'U20_GW03_Del_ActiveEnergy' ],
    Trafo4Incoming: [ 'U19_GW03_Del_ActiveEnergy' ],
    Trafo1outgoing: [ 'U21_PLC_Del_ActiveEnergy' ],
    Trafo2outgoing: [ 'U13_GW01_Del_ActiveEnergy' ],
    Trafo3outgoing: [ 'U13_GW02_Del_ActiveEnergy' ],
    Trafo4outgoing: [ 'U16_GW03_Del_ActiveEnergy' ],
    Wapda2: [ 'U27_PLC_Del_ActiveEnergy' ],
    Niigata: [ 'U22_PLC_Del_ActiveEnergy' ],
    JMS: [ 'U26_PLC_Del_ActiveEnergy' ],
    PH_IC: [ 'U22_GW01_Del_ActiveEnergy' ]
  };

  private readonly ALL_TAGS: string[] = Object.values( this.METER_GROUPS ).flat();

  // 🚀 PERFORMANCE: Pre-computed values
  private readonly tagProjections: Record<string, any> = {};
  private readonly meterGroupEntries = Object.entries( this.METER_GROUPS );

  constructor (
    @InjectModel( 'power_comparison', 'surajcotton' )
    private readonly conModel: Model<powercomparisonHistoricalDataDocument>,
    private readonly unit4LT1Service: Unit4LT1Service,
    private readonly unit4LT2Service: Unit4LT2Service,
    private readonly Unit5LT3Service: Unit5LT3Service,
    private readonly Unit5LT4Service: Unit5LT4Service,
  )
  {
    // 🚀 PERFORMANCE: Pre-compute projections for faster aggregation
    this.initializePerformanceOptimizations();
  }

  private initializePerformanceOptimizations ()
  {
    // Pre-compute tag projections for aggregation pipeline
    this.ALL_TAGS.forEach( tag =>
    {
      this.tagProjections[ `first_${ tag }` ] = { $first: { $ifNull: [ `$${ tag }`, 0 ] } };
      this.tagProjections[ `last_${ tag }` ] = { $last: { $ifNull: [ `$${ tag }`, 0 ] } };
    } );
  }

  // 🚀 PERFORMANCE: Cache management
  private getCacheKey(
  startDate: string,
  endDate: string,
  label: string,
  startTime?: string,
  endTime?: string
): string {
  return `${startDate}_${startTime ?? '06:00'}__${endDate}_${endTime ?? '06:00'}__${label}`;
}

  private setCache ( key: string, data: EnergyResult[], metrics: PerformanceMetrics )
  {
    this.cache.set( key, {
      data,
      timestamp: Date.now(),
      metrics
    } );

    // 🚀 PERFORMANCE: Limit cache size
    if ( this.cache.size > 100 )
    {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete( firstKey );
    }
  }

  private getCache ( key: string ): CacheEntry | null
  {
    const entry = this.cache.get( key );
    if ( !entry ) return null;

    // 🚀 PERFORMANCE: Check if cache is still valid
    if ( Date.now() - entry.timestamp > this.CACHE_TTL )
    {
      this.cache.delete( key );
      return null;
    }

    return entry;
  }

  // 🚀 PERFORMANCE: Metrics collection
  private startPerformanceMonitoring (): PerformanceMonitor
  {
    return {
      startTime: process.hrtime(),
      startMemory: process.memoryUsage(),
      dbQueryStart: undefined,
      dataProcessingStart: undefined,
      externalApiStart: undefined
    };
  }

  private calculatePerformanceMetrics ( monitor: PerformanceMonitor ): PerformanceMetrics
  {
    const [ seconds, nanoseconds ] = process.hrtime( monitor.startTime );
    const totalTime = seconds * 1000 + nanoseconds / 1e6;

    return {
      dbQueryTime: monitor.dbQueryTime || 0,
      dataProcessingTime: monitor.dataProcessingTime || 0,
      externalApiTime: monitor.externalApiTime || 0,
      totalTime,
      recordsProcessed: monitor.recordsProcessed || 0,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date()
    };
  }

  private storeMetrics ( metrics: PerformanceMetrics )
  {
    this.performanceMetrics.push( metrics );

    // 🚀 PERFORMANCE: Limit metrics storage
    if ( this.performanceMetrics.length > this.MAX_METRICS_STORAGE )
    {
      this.performanceMetrics.shift();
    }
  }

  // 🚀 PERFORMANCE: Get performance insights
  getPerformanceInsights (): any
  {
    if ( this.performanceMetrics.length === 0 ) return null;

    const latest = this.performanceMetrics[ this.performanceMetrics.length - 1 ];
    const avgTotalTime = this.performanceMetrics.reduce( ( sum, m ) => sum + m.totalTime, 0 ) / this.performanceMetrics.length;
    const avgDbTime = this.performanceMetrics.reduce( ( sum, m ) => sum + m.dbQueryTime, 0 ) / this.performanceMetrics.length;
    const avgProcessingTime = this.performanceMetrics.reduce( ( sum, m ) => sum + m.dataProcessingTime, 0 ) / this.performanceMetrics.length;

    return {
      latest: {
        totalTime: `${ latest.totalTime.toFixed( 2 ) }ms`,
        dbQueryTime: `${ latest.dbQueryTime.toFixed( 2 ) }ms`,
        dataProcessingTime: `${ latest.dataProcessingTime.toFixed( 2 ) }ms`,
        externalApiTime: `${ latest.externalApiTime.toFixed( 2 ) }ms`,
        recordsProcessed: latest.recordsProcessed,
        memoryUsage: `${ Math.round( latest.memoryUsage.heapUsed / 1024 / 1024 ) }MB`
      },
      averages: {
        totalTime: `${ avgTotalTime.toFixed( 2 ) }ms`,
        dbQueryTime: `${ avgDbTime.toFixed( 2 ) }ms`,
        dataProcessingTime: `${ avgProcessingTime.toFixed( 2 ) }ms`
      },
      cache: {
        size: this.cache.size,
        hitRate: this.calculateCacheHitRate()
      },
      totalRequests: this.performanceMetrics.length
    };
  }

  private calculateCacheHitRate (): string
  {
    // This would need to be implemented with actual hit/miss tracking
    return "N/A";
  }

  // 🚀 FIXED: Use exact same timezone logic as original working code
  private createAggregationPipeline ( startDateTime: Date, endDateTime: Date, groupBy: 'hour' | 'day' | 'month' = 'hour' )
  {
    const pipeline: any[] = [
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
      { $sort: { date: 1 } }
    ];

    // Add grouping based on timeframe (matches original logic exactly)
    if ( groupBy === 'hour' )
    {
      pipeline.push( {
        $addFields: {
          hourStart: {
            $dateTrunc: {
              date: "$date",
              unit: "hour",
              timezone: this.TIMEZONE
            }
          }
        }
      } );

      pipeline.push( {
        $group: {
          _id: "$hourStart",
          ...this.tagProjections
        }
      } );
    } else if ( groupBy === 'day' )
    {
  // 🔑 Shift time so day starts at 06:00
  pipeline.push({
    $addFields: {
      energyDate: {
        $dateSubtract: {
          startDate: "$date",
          unit: "hour",
          amount: 6
        }
      }
    }
  });

  // 🔑 Now group by shifted day
  pipeline.push({
        $group: {
          _id: {
        $dateTrunc: {
          date: "$energyDate",
          unit: "day",
              timezone: this.TIMEZONE
            }
          },
          ...this.tagProjections
        }
  });
}
 else if ( groupBy === 'month' )
    {
      // For monthly, use month grouping
      pipeline.push( {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m",
              date: "$date",
              timezone: this.TIMEZONE
            }
          },
          ...this.tagProjections
        }
      } );
    }

    pipeline.push( { $sort: { _id: 1 } } );

    return pipeline;
  }


  // 🚀 PERFORMANCE: Optimized calculation with early validation
  private calculateEnergyTotals ( entry: any )
  
  {
    const totals: any = {};

    // 🚀 PERFORMANCE: Use pre-computed entries
    for ( const [ groupName, tags ] of this.meterGroupEntries )
    {
      let groupTotal = 0;

      for ( const tag of tags )
      {
        const first = entry[ `first_${ tag }` ] || 0;
        const last = entry[ `last_${ tag }` ] || 0;
        let diff = last - first;

        // 🚀 PERFORMANCE: Early validation
        if ( Math.abs( diff ) > this.VALIDATION.maxValidValue ||
          Math.abs( diff ) < this.VALIDATION.minValidValue )
        {
          diff = 0;
        }
        groupTotal += diff;
      }

      totals[ groupName ] = +groupTotal.toFixed( 2 );
    }

    return totals;
  }

  // 🚀 PERFORMANCE: Optimized losses calculation
  private calculateLosses ( totals: any )
  {
    const T1andT2incoming = totals.Trafo1Incoming + totals.Trafo2Incoming;
    const T1andT2outgoing = totals.Trafo1outgoing + totals.Trafo2outgoing;
    const T1andT2losses = T1andT2incoming - T1andT2outgoing;
    const Trafo3losses = totals.Trafo3Incoming - totals.Trafo3outgoing;
    const Trafo4losses = totals.Trafo4Incoming - totals.Trafo4outgoing;
    const TrasformerLosses = T1andT2losses + Trafo3losses + Trafo4losses;

    const HT_Transmission_Losses = ( totals.Wapda2 + totals.Niigata + totals.JMS ) -
      ( totals.Trafo3Incoming + totals.Trafo4Incoming + totals.PH_IC );

    return +( TrasformerLosses + HT_Transmission_Losses ).toFixed( 2 );
  }

  // 🚀 CLEAN PERFORMANCE: Optimized batch processing with 2 BATCHES
 private async fetchBatchUnaccountedEnergy(
  dates: string[],
  timeframe: 'hourly' | 'daily' | 'monthly' = 'hourly',
  startTime?: string,
  endTime?: string
): Promise<Map<string, number>>
  {
    const results = new Map<string, number>();
    if ( dates.length === 0 ) return results;

    // 📊 BATCH CONFIGURATION
    const totalDates = dates.length;
    const dateBatches: string[][] = [];
    const batchSize = Math.min( this.OPTIMAL_BATCH_SIZE, totalDates );

    for ( let i = 0; i < totalDates; i += batchSize )
    {
      dateBatches.push( dates.slice( i, i + batchSize ) );
    }

    console.log( `\n📦 BATCH PROCESSING SUMMARY` );
    console.log( `   Total Dates: ${ totalDates }` );
    console.log( `   Batch Size: ${ batchSize }` );
    console.log( `   Total Batches: ${ dateBatches.length }` );
    console.log( `   Concurrent Batches: ${ this.OPTIMAL_CONCURRENT_BATCHES }` );
    console.log( `   Estimated API Calls: ${ totalDates * 4 } (${ totalDates } dates × 4 services)` );

    const processingPromises = dateBatches.map( async ( batch, batchIndex ) =>
    {
      const batchStartTime = Date.now();
      console.log( `\n🔄 Processing Batch ${ batchIndex + 1 }/${ dateBatches.length }` );
      console.log( `   Dates in batch: ${ batch.length }` );
      console.log( `   Time range: ${ batch[ 0 ] } to ${ batch[ batch.length - 1 ] }` );

      const batchPromises = batch.map( async ( date ) =>
      {
        try
        {
          let payload: any;

          if ( timeframe === 'hourly' )
          {
            payload = {
              startDate: moment( date ).format( "YYYY-MM-DD" ),
              startTime: moment( date ).format( "HH:mm" ),
              endDate: moment( date ).format( "YYYY-MM-DD" ),
              endTime: moment( date ).add( 1, "hour" ).format( "HH:mm" ),
            };
          } else
          {
            // For daily/monthly, use 06:00 to 06:00 window
            payload = {
              startDate: date.split( ' ' )[ 0 ], // Extract date part
              endDate: moment( date.split( ' ' )[ 0 ] ).add( 1, 'day' ).format( "YYYY-MM-DD" ),
              startTime: startTime ?? "06:00",
              endTime: endTime ?? "06:00",
            };
          }

          const timeoutPromise = new Promise<number>( ( resolve ) =>
            setTimeout( () => resolve( 0 ), this.EXTERNAL_API_TIMEOUT )
          );

          const apiPromise = Promise.allSettled( [
            this.unit4LT1Service.getSankeyData( payload ),
            this.unit4LT2Service.getSankeyData( payload ),
            this.Unit5LT3Service.getSankeyData( payload ),
            this.Unit5LT4Service.getSankeyData( payload )
          ] ).then( ( results ) =>
          {
            let totalUnaccounted = 0;

            results.forEach( ( result ) =>
            {
              if ( result.status === 'fulfilled' )
              {
                const data = result.value;
                const extractUnaccounted = ( data: any ): number =>
                {
                  let sankeyData: { from: string; to: string; value: number }[] = [];

                  if ( Array.isArray( data ) )
                  {
                    sankeyData = data; // service returned array only
                  } else
                  {
                    sankeyData = data?.sankeyData || []; // service returned { sankeyData, totals }
                  }

                  const node = sankeyData.find( ( n: any ) => n.to === 'Unaccounted Energy' );
                  return node?.value || 0;
                };
                totalUnaccounted += extractUnaccounted( data );
              }
            } );
            return totalUnaccounted;
          } );

          const unaccountedEnergy = await Promise.race( [ apiPromise, timeoutPromise ] );
          return { date, unaccountedEnergy };
        } catch ( error: any )
        {
          console.warn( `   ⚠️ API error for ${ date }: ${ error.message }` );
          return { date, unaccountedEnergy: 0 };
        }
      } );

      const batchResults = await Promise.all( batchPromises );
      batchResults.forEach( ( { date, unaccountedEnergy } ) =>
      {
        results.set( date, unaccountedEnergy );
      } );

      const batchTime = Date.now() - batchStartTime;
      console.log( `   ✅ Completed in ${ batchTime }ms | Success: ${ batchResults.length }/${ batch.length }` );
      return batchResults.length;
    } );

    // 🚀 OPTIMAL CONCURRENCY: 2 batches (proven fastest)
    console.log( `\n🚀 EXECUTION PLAN` );
    console.log( `   Running ${ this.OPTIMAL_CONCURRENT_BATCHES } batches concurrently` );
    console.log( `   Total operations: ${ totalDates } dates × 4 APIs = ${ totalDates * 4 } calls` );

    const totalStartTime = Date.now();
    let processedBatches = 0;

    // Process with optimal concurrency (2 batches)
    for ( let i = 0; i < processingPromises.length; i += this.OPTIMAL_CONCURRENT_BATCHES )
    {
      const currentBatchPromises = processingPromises.slice( i, i + this.OPTIMAL_CONCURRENT_BATCHES );
      await Promise.all( currentBatchPromises );
      processedBatches += currentBatchPromises.length;

      console.log( `   📊 Progress: ${ processedBatches }/${ dateBatches.length } batches completed` );
    }

    const totalTime = Date.now() - totalStartTime;
    console.log( `\n🎯 BATCH PROCESSING COMPLETE` );
    console.log( `   Total time: ${ totalTime }ms` );
    console.log( `   Processed: ${ results.size }/${ totalDates } dates` );
    console.log( `   Average: ${ ( totalTime / totalDates ).toFixed( 1 ) }ms per date` );

    return results;
  }

  // 🚀 MAIN METHOD WITH EXACT SAME DATE/TIME LOGIC AS ORIGINAL
  async getPowerData(
  startDate: string,
  endDate: string,
  label: string = 'hourly',
  startTime?: string,   // "HH:mm"
  endTime?: string      // "HH:mm"
): Promise<EnergyResult[]>
  {
    const monitor = this.startPerformanceMonitoring();

    // 🚀 PERFORMANCE: Check cache first
   const cacheKey = this.getCacheKey(startDate, endDate, label, startTime, endTime);
    const cached = this.getCache( cacheKey );

    if ( cached )
    {
      console.log( `\n🚀 CACHE HIT: ${ cacheKey }` );
      console.log( `   Serving ${ cached.data.length } records from cache` );
      this.storeMetrics( cached.metrics );
      return cached.data;
    }

    console.log( `\n🔄 CACHE MISS: ${ cacheKey }` );
    console.log( `   Processing ${ label } data from ${ startDate } to ${ endDate }` );

    try
    {
      // 🚀 EXACT SAME DATE/TIME LOGIC AS ORIGINAL WORKING CODE
     const startDateTime = moment
  .tz(
    `${startDate} ${startTime ?? '06:00'}`,
    'YYYY-MM-DD HH:mm',
    this.TIMEZONE
  )
  .second(0)
  .millisecond(0)
  .toDate();

const endDateTime = moment
  .tz(
    `${endDate} ${endTime ?? '06:00'}`,
    'YYYY-MM-DD HH:mm',
    this.TIMEZONE
  )
  .second(0)
  .millisecond(0)
  .toDate();

// ✅ VALIDATION
if (endDateTime <= startDateTime) {
  throw new Error("End datetime must be after start datetime");
}

      console.log( `\n📊 DATABASE QUERY` );
      console.log( `   Time range: ${ startDateTime } to ${ endDateTime }` );

      let groupBy: 'hour' | 'day' | 'month' = 'hour';
      let dateFormat = "YYYY-MM-DD HH:mm";

      switch ( label )
      {
        case 'daily':
          groupBy = 'day';
          dateFormat = "YYYY-MM-DD";
          break;
        case 'monthly':
          groupBy = 'month';
          dateFormat = "YYYY-MM";
          break;
        default:
          groupBy = 'hour';
      }

      const dbQueryStart = process.hrtime();
      const collection = this.conModel.collection;
      const pipeline = this.createAggregationPipeline( startDateTime, endDateTime, groupBy );
      const data = await collection.aggregate( pipeline ).toArray();
      console.log("📦 DB RECORD COUNT:", data.length);
      const [ dbSeconds, dbNanoseconds ] = process.hrtime( dbQueryStart );
      monitor.dbQueryTime = dbSeconds * 1000 + dbNanoseconds / 1e6;

      console.log( `   ✅ Retrieved ${ data.length } records in ${ monitor.dbQueryTime!.toFixed( 0 ) }ms` );

      if ( data.length === 0 )
      {
        console.log( '❌ No data found for the given time range' );
        return [];
      }

      monitor.recordsProcessed = data.length;

      // 🚀 EXTERNAL API PROCESSING
      console.log( `\n🌐 EXTERNAL API PROCESSING` );
      const externalApiStart = process.hrtime();

      // Format dates exactly like original code
      const allDates = data.map( entry =>
      {
        if ( groupBy === 'hour' )
        {
          return moment( entry._id ).tz( this.TIMEZONE ).format( "YYYY-MM-DD HH:mm:ss" );
        } else
        {
          return moment( entry._id ).tz( this.TIMEZONE ).format( "YYYY-MM-DD" );
        }
      } );

      console.log( `   Fetching unaccounted energy for ${ allDates.length } time periods` );
      console.log( `   Using ${ this.OPTIMAL_CONCURRENT_BATCHES } batches of ${ this.OPTIMAL_BATCH_SIZE }` );

      let unaccountedEnergyMap = new Map<string, number>();

// ❌ Hourly ke liye API call band
if (label !== 'hourly') {
  unaccountedEnergyMap =
    await this.fetchBatchUnaccountedEnergy(allDates, label as any, startTime,
    endTime);
}

      const [ externalSeconds, externalNanoseconds ] = process.hrtime( externalApiStart );
      monitor.externalApiTime = externalSeconds * 1000 + externalNanoseconds / 1e6;

      // 🚀 DATA PROCESSING
      console.log( `\n⚡ DATA PROCESSING` );
      const dataProcessingStart = process.hrtime();
      const results: EnergyResult[] = [];

      for ( const entry of data )
      {
        let formattedDate: string;
        let dateKey: string;

        if ( groupBy === 'hour' )
        {
          formattedDate = moment( entry._id ).tz( this.TIMEZONE ).format( "YYYY-MM-DD HH:mm" );
          dateKey = moment( entry._id ).tz( this.TIMEZONE ).format( "YYYY-MM-DD HH:mm:ss" );
        } else if ( groupBy === 'day' )
        {
          formattedDate = moment( entry._id ).tz( this.TIMEZONE ).format( "YYYY-MM-DD" );
          dateKey = moment(entry._id)
  .tz(this.TIMEZONE)
  .add(6, 'hours')   // 🔑 align with energy window
  .format("YYYY-MM-DD");
        } else
        {
          formattedDate = moment( entry._id ).tz( this.TIMEZONE ).format( "YYYY-MM" );
          dateKey = moment( entry._id ).tz( this.TIMEZONE ).format( "YYYY-MM-DD" );
        }
        // 👇 YAHAN
  console.log("🔍 ENTRY ID:", entry._id);
  console.log("FIRST/LAST SAMPLE:", {
    first: entry.first_U22_PLC_Del_ActiveEnergy,
    last: entry.last_U22_PLC_Del_ActiveEnergy,
    diff: entry.last_U22_PLC_Del_ActiveEnergy - entry.first_U22_PLC_Del_ActiveEnergy
  });


        const totals = this.calculateEnergyTotals( entry );
        const unaccountable_energy =
  label === 'hourly'
    ? 0
    : (unaccountedEnergyMap.get(dateKey) || 0);
        const losses = this.calculateLosses( totals );
        const totalConsumption = totals.unit4 + totals.unit5 + totals.aux;
        const totalGeneration = totals.ht + totals.lt + totals.wapda + totals.solar;
        const efficiency = +( ( totalConsumption / totalGeneration ) * 100 || 0 ).toFixed( 2 );

        results.push( {
          date: formattedDate,
          HT: totals.ht,
          LT: totals.lt,
          wapda: totals.wapda,
          solar: totals.solar,
          unit4: totals.unit4,
          unit5: totals.unit5,
          losses,
          total_consumption: +totalConsumption.toFixed( 2 ),
          total_generation: +totalGeneration.toFixed( 2 ),
          unaccountable_energy,
          efficiency
        } );
      }

      const [ processingSeconds, processingNanoseconds ] = process.hrtime( dataProcessingStart );
      monitor.dataProcessingTime = processingSeconds * 1000 + processingNanoseconds / 1e6;

      console.log( `   ✅ Processed ${ results.length } energy records` );

      // 🚀 FINAL SUMMARY
      const metrics = this.calculatePerformanceMetrics( monitor );
      this.storeMetrics( metrics );
      this.setCache( cacheKey, results, metrics );

      console.log( `\n🎉 REQUEST COMPLETE SUMMARY` );
      console.log( `   Time Periods: ${ results.length } ${ label } periods` );
      console.log( `   Total Time: ${ metrics.totalTime.toFixed( 0 ) }ms` );
      console.log( `   Database: ${ metrics.dbQueryTime.toFixed( 0 ) }ms` );
      console.log( `   External APIs: ${ metrics.externalApiTime.toFixed( 0 ) }ms` );
      console.log( `   Data Processing: ${ metrics.dataProcessingTime.toFixed( 0 ) }ms` );
      console.log( `   Cache: Stored ${ results.length } records for future requests` );
      console.log( `   Efficiency: ${ ( metrics.totalTime / results.length ).toFixed( 1 ) }ms per period` );

      return results;

    } catch ( error )
    {
      console.error( '\n❌ PROCESSING FAILED:', error );
      const errorMetrics = this.calculatePerformanceMetrics( monitor );
      this.storeMetrics( errorMetrics );
      throw error;
    }
  }

  // 🚀 PERFORMANCE: Clear cache method
  clearCache (): void
  {
    this.cache.clear();
    console.log( '🧹 Cache cleared' );
  }

  // 🚀 PERFORMANCE: Get cache statistics
  getCacheStats (): any
  {
    return {
      size: this.cache.size,
      keys: Array.from( this.cache.keys() ),
      entries: Array.from( this.cache.entries() ).map( ( [ key, entry ] ) => ( {
        key,
        age: Date.now() - entry.timestamp,
        dataLength: entry.data.length
      } ) )
    };
  }

  // Keep existing methods for backward compatibility with exact same logic
  async getPowerAverages ( startDate: string, endDate: string ): Promise<EnergyResult[]>
  {
    return this.getPowerData( startDate, endDate, 'hourly' );
  }

  async getDailyPowerAverages ( startDate: string, endDate: string ): Promise<EnergyResult[]>
  {
    return this.getPowerData( startDate, endDate, 'daily' );
  }

  async getMonthlyAverages ( startDate: string, endDate: string ): Promise<EnergyResult[]>
  {
    return this.getPowerData( startDate, endDate, 'monthly' );
  }

  async getPowerDataOld ( startDate: string, endDate: string, label: string )
  {
    return this.getPowerData( startDate, endDate, label );
  }
}