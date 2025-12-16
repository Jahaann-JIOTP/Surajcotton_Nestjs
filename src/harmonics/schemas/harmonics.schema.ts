import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as moment from 'moment-timezone';

interface HarmonicsPayload
{
  Period1startDate: string;
  Period1startTime: string;
  Period1endDate: string;
  Period1endTime: string;
  Period2startDate: string;
  Period2startTime: string;
  Period2endDate: string;
  Period2endTime: string;
  resolution: string;
  DeviceId: string[];
}

interface HarmonicsResponse
{
  period1Data: any[];
  period2Data: any[];
  metadata: {
    period1: { start: string; end: string };
    period2: { start: string; end: string };
    resolution: string;
    devices: string[];
    totalTags: number;
    queryTime: string;
  };
}

@Injectable()
export class HarmonicsService
{
  private readonly TIMEZONE = 'Asia/Kolkata';

  constructor ( @InjectConnection( 'surajcotton' ) private readonly connection: Connection ) { }

  async getHarmonicsFromPayload ( payload: HarmonicsPayload ): Promise<HarmonicsResponse>
  {
    this.validatePayload( payload );

    const period1 = this.parseTimePeriod(
      payload.Period1startDate,
      payload.Period1startTime,
      payload.Period1endDate,
      payload.Period1endTime,
      'Period 1'
    );
    const period2 = this.parseTimePeriod(
      payload.Period2startDate,
      payload.Period2startTime,
      payload.Period2endDate,
      payload.Period2endTime,
      'Period 2'
    );

    if ( period1.end > period2.start )
    {
      throw new BadRequestException( 'Period 1 end time cannot be after Period 2 start time' );
    }

    const tags = this.generateTags( payload.DeviceId );

    const [ period1Data, period2Data ] = await Promise.all( [
      this.fetchHarmonicsData( period1.start, period1.end, tags, payload.resolution ),
      this.fetchHarmonicsData( period2.start, period2.end, tags, payload.resolution ),
    ] );

    const processedPeriod1Data = this.processHarmonicsData( period1Data, payload.DeviceId );
    const processedPeriod2Data = this.processHarmonicsData( period2Data, payload.DeviceId );

    let finalPeriod1Data = processedPeriod1Data;
    let finalPeriod2Data = processedPeriod2Data;

    if ( payload.resolution === 'hour' || payload.resolution === '1hour' )
    {
      finalPeriod1Data = this.groupDataByHourWithMinMax( processedPeriod1Data, payload.DeviceId );
      finalPeriod2Data = this.groupDataByHourWithMinMax( processedPeriod2Data, payload.DeviceId );
    } else if ( payload.resolution === 'day' || payload.resolution === '1day' )
    {
      finalPeriod1Data = this.groupByDayWithMinMax( processedPeriod1Data, payload.DeviceId );
      finalPeriod2Data = this.groupByDayWithMinMax( processedPeriod2Data, payload.DeviceId );
    }

    return {
      period1Data: finalPeriod1Data,
      period2Data: finalPeriod2Data,
      metadata: {
        period1: { start: period1.start.toISOString(), end: period1.end.toISOString() },
        period2: { start: period2.start.toISOString(), end: period2.end.toISOString() },
        resolution: payload.resolution,
        devices: payload.DeviceId,
        totalTags: tags.length,
        queryTime: new Date().toISOString(),
      },
    };
  }

  private validatePayload ( payload: HarmonicsPayload ): void
  {
    const requiredFields = [
      'Period1startDate',
      'Period1startTime',
      'Period1endDate',
      'Period1endTime',
      'Period2startDate',
      'Period2startTime',
      'Period2endDate',
      'Period2endTime',
      'resolution',
      'DeviceId',
    ];

    const missingFields = requiredFields.filter( ( field ) => !payload[ field as keyof HarmonicsPayload ] );
    if ( missingFields.length > 0 )
    {
      throw new BadRequestException( `Missing required fields: ${ missingFields.join( ', ' ) }` );
    }

    if ( !Array.isArray( payload.DeviceId ) || payload.DeviceId.length === 0 )
    {
      throw new BadRequestException( 'DeviceId must be a non-empty array' );
    }

    if ( ![ '15mins', '30mins', 'hour', '1hour', 'day', '1day' ].includes( payload.resolution ) )
    {
      throw new BadRequestException( 'Invalid resolution. Allowed values: 15mins, 30mins, hour, 1hour, day, 1day' );
    }
  }

  private parseTimePeriod (
    startDate: string,
    startTime: string,
    endDate: string,
    endTime: string,
    periodName: string
  ): { start: Date; end: Date }
  {
    const start = moment.tz( `${ startDate } ${ startTime }`, 'YYYY-MM-DD HH:mm:ss', this.TIMEZONE );
    const end = moment.tz( `${ endDate } ${ endTime }`, 'YYYY-MM-DD HH:mm:ss', this.TIMEZONE );

    if ( !start.isValid() || !end.isValid() )
    {
      throw new BadRequestException( `Invalid date/time format for ${ periodName }` );
    }
    if ( start.isAfter( end ) )
    {
      throw new BadRequestException( `${ periodName } start time cannot be after end time` );
    }
    return { start: start.toDate(), end: end.toDate() };
  }

  private generateTags ( deviceIds: string[] ): string[]
  {
    const tagTypes = [ 'Harmonics_V1_THD', 'Harmonics_V2_THD', 'Harmonics_V3_THD', 'Harmonics_I1_THD', 'Harmonics_I2_THD', 'Harmonics_I3_THD' ];
    return deviceIds.flatMap( ( id ) => tagTypes.map( ( t ) => `${ id }_${ t }` ) );
  }

  private async fetchHarmonicsData ( start: Date, end: Date, tags: string[], resolution: string ): Promise<any[]>
  {
    const collection = this.connection.collection( 'historical' );

    const formatDateForQuery = ( date: Date ): string => moment( date ).tz( this.TIMEZONE ).format( 'YYYY-MM-DDTHH:mm:ss' ) + '+05:30';
    const pipeline = [
      { $match: { timestamp: { $gte: formatDateForQuery( start ), $lt: formatDateForQuery( end ) } } },
      { $addFields: { timestampDate: { $dateFromString: { dateString: '$timestamp', timezone: this.TIMEZONE } } } },
      { $addFields: { adjustedTimestamp: { $dateSubtract: { startDate: '$timestampDate', unit: 'hour', amount: 6, timezone: this.TIMEZONE } } } },
      {
        $group: {
          _id: this.getGroupingStage( resolution ),
          groupTimestamp: { $first: '$adjustedTimestamp' },
          ...this.createAvgFields( tags ),
        },
      },
      { $addFields: { actualTimestamp: { $dateAdd: { startDate: '$groupTimestamp', unit: 'hour', amount: 6, timezone: this.TIMEZONE } } } },
      {
        $project: {
          _id: 0,
          timestamp: { $dateToString: { format: '%Y-%m-%dT%H:%M:%S', date: '$actualTimestamp', timezone: this.TIMEZONE } },
          ...this.createRoundedFields( tags ),
        },
      },
      { $sort: { timestamp: 1 } },
    ];

    return collection.aggregate( pipeline ).toArray();
  }

  private getMinuteSlotSize ( resolution: string ): number
  {
    return { '15mins': 15, '30mins': 30, 'hour': 60, '1hour': 60, 'day': 1440, '1day': 1440 }[ resolution ] || 15;
  }

  private getGroupingStage ( resolution: string ): any
  {
    const minuteSlotSize = this.getMinuteSlotSize( resolution );

    if ( minuteSlotSize === 1440 ) return { year: { $year: '$adjustedTimestamp' }, month: { $month: '$adjustedTimestamp' }, day: { $dayOfMonth: '$adjustedTimestamp' } };
    if ( minuteSlotSize === 60 ) return { year: { $year: '$adjustedTimestamp' }, month: { $month: '$adjustedTimestamp' }, day: { $dayOfMonth: '$adjustedTimestamp' }, hour: { $hour: '$adjustedTimestamp' } };

    return {
      year: { $year: '$adjustedTimestamp' },
      month: { $month: '$adjustedTimestamp' },
      day: { $dayOfMonth: '$adjustedTimestamp' },
      hour: { $hour: '$adjustedTimestamp' },
      minuteSlot: { $floor: { $divide: [ { $minute: '$adjustedTimestamp' }, minuteSlotSize ] } },
    };
  }

  private createAvgFields ( tags: string[] ): any
  {
    return tags.reduce( ( acc, tag ) => ( { ...acc, [ tag ]: { $avg: `$${ tag }` } } ), {} );
  }

  private createRoundedFields ( tags: string[] ): any
  {
    return tags.reduce( ( acc, tag ) => ( { ...acc, [ tag ]: { $round: [ `$${ tag }`, 2 ] } } ), {} );
  }

  private processHarmonicsData ( data: any[], deviceIds: string[] ): any[]
  {
    return data.map( ( item ) =>
    {
      const processedItem: any = { timestamp: item.timestamp };
      deviceIds.forEach( ( deviceId ) =>
      {
        const vValues = [ 'V1', 'V2', 'V3' ].map( ( v ) => item[ `${ deviceId }_Harmonics_${ v }_THD` ] || 0 ).filter( ( v ) => v !== 0 );
        const iValues = [ 'I1', 'I2', 'I3' ].map( ( i ) => item[ `${ deviceId }_Harmonics_${ i }_THD` ] || 0 ).filter( ( i ) => i !== 0 );

        processedItem[ `${ deviceId }_Harmonics_V_THD` ] = vValues.length ? Math.round( ( vValues.reduce( ( a, b ) => a + b, 0 ) / vValues.length ) * 100 ) / 100 : 0;
        processedItem[ `${ deviceId }_Harmonics_I_THD` ] = iValues.length ? Math.round( ( iValues.reduce( ( a, b ) => a + b, 0 ) / iValues.length ) * 100 ) / 100 : 0;
      } );
      return processedItem;
    } );
  }

  private groupDataByHourWithMinMax ( data: any[], deviceIds: string[] ): any[]
  {
    const grouped: { [ hour: string ]: any[] } = {};

    data.forEach( ( item ) =>
    {
      const timestamp = moment.tz( item.timestamp, this.TIMEZONE );
      const adjusted = timestamp.hour() < 6 ? timestamp.clone().subtract( 1, 'day' ) : timestamp.clone();
      const hourKey = adjusted.format( 'YYYY-MM-DD-HH' );
      grouped[ hourKey ] ??= [];
      grouped[ hourKey ].push( item );
    } );

    const result: any[] = [];

    Object.keys( grouped )
      .sort()
      .forEach( ( hourKey ) =>
      {
        const hourData = grouped[ hourKey ];
        const intervalStart = moment.tz( hourData[ 0 ].timestamp, this.TIMEZONE ).startOf( 'hour' );
        const intervalEnd = intervalStart.clone().add( 1, 'hour' );

        const hourlyItem: any = {
          timestamp: intervalStart.format( 'YYYY-MM-DDTHH:mm:ss+05:30' ),
          intervalStart: intervalStart.format( 'YYYY-MM-DD HH:mm:ss' ),
          intervalEnd: intervalEnd.format( 'YYYY-MM-DD HH:mm:ss' ),
        };

        deviceIds.forEach( ( deviceId ) =>
        {
          const vPoints = hourData.map( ( d ) => ( { value: d[ `${ deviceId }_Harmonics_V_THD` ], timestamp: d.timestamp } ) ).filter( ( p ) => p.value !== undefined );
          const iPoints = hourData.map( ( d ) => ( { value: d[ `${ deviceId }_Harmonics_I_THD` ], timestamp: d.timestamp } ) ).filter( ( p ) => p.value !== undefined );

          if ( vPoints.length > 0 )
          {
            const vAvg = vPoints.reduce( ( sum, p ) => sum + p.value, 0 ) / vPoints.length;
            const vMin = vPoints.reduce( ( min, p ) => ( p.value < min.value ? p : min ), vPoints[ 0 ] );
            const vMax = vPoints.reduce( ( max, p ) => ( p.value > max.value ? p : max ), vPoints[ 0 ] );
            hourlyItem[ `${ deviceId }_Harmonics_V_THD` ] = Math.round( vAvg * 100 ) / 100;
            hourlyItem[ `${ deviceId }_Harmonics_V_THD_min` ] = Math.round( vMin.value * 100 ) / 100;
            hourlyItem[ `${ deviceId }_Harmonics_V_THD_min_timestamp` ] = vMin.timestamp;
            hourlyItem[ `${ deviceId }_Harmonics_V_THD_max` ] = Math.round( vMax.value * 100 ) / 100;
            hourlyItem[ `${ deviceId }_Harmonics_V_THD_max_timestamp` ] = vMax.timestamp;
          } else
          {
            hourlyItem[ `${ deviceId }_Harmonics_V_THD` ] = 0;
            hourlyItem[ `${ deviceId }_Harmonics_V_THD_min` ] = 0;
            hourlyItem[ `${ deviceId }_Harmonics_V_THD_min_timestamp` ] = null;
            hourlyItem[ `${ deviceId }_Harmonics_V_THD_max` ] = 0;
            hourlyItem[ `${ deviceId }_Harmonics_V_THD_max_timestamp` ] = null;
          }

          if ( iPoints.length > 0 )
          {
            const iAvg = iPoints.reduce( ( sum, p ) => sum + p.value, 0 ) / iPoints.length;
            const iMin = iPoints.reduce( ( min, p ) => ( p.value < min.value ? p : min ), iPoints[ 0 ] );
            const iMax = iPoints.reduce( ( max, p ) => ( p.value > max.value ? p : max ), iPoints[ 0 ] );
            hourlyItem[ `${ deviceId }_Harmonics_I_THD` ] = Math.round( iAvg * 100 ) / 100;
            hourlyItem[ `${ deviceId }_Harmonics_I_THD_min` ] = Math.round( iMin.value * 100 ) / 100;
            hourlyItem[ `${ deviceId }_Harmonics_I_THD_min_timestamp` ] = iMin.timestamp;
            hourlyItem[ `${ deviceId }_Harmonics_I_THD_max` ] = Math.round( iMax.value * 100 ) / 100;
            hourlyItem[ `${ deviceId }_Harmonics_I_THD_max_timestamp` ] = iMax.timestamp;
          } else
          {
            hourlyItem[ `${ deviceId }_Harmonics_I_THD` ] = 0;
            hourlyItem[ `${ deviceId }_Harmonics_I_THD_min` ] = 0;
            hourlyItem[ `${ deviceId }_Harmonics_I_THD_min_timestamp` ] = null;
            hourlyItem[ `${ deviceId }_Harmonics_I_THD_max` ] = 0;
            hourlyItem[ `${ deviceId }_Harmonics_I_THD_max_timestamp` ] = null;
          }
        } );

        result.push( hourlyItem );
      } );

    return result;
  }

  private groupByDayWithMinMax ( data: any[], deviceIds: string[] ): any[]
  {
    // Your existing daily grouping logic remains unchanged
    // ...
    return []; // Keep original implementation here
  }
}
