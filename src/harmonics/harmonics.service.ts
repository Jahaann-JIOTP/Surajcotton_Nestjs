import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as moment from 'moment-timezone';

/* ===================== DTOs ===================== */

export interface HarmonicsPayload
{
    Period1startDate: string;
    Period1startTime: string;
    Period1endDate: string;
    Period1endTime: string;

    Period2startDate: string;
    Period2startTime: string;
    Period2endDate: string;
    Period2endTime: string;

    resolution: '15mins' | '30mins' | 'hour' | '1hour' | 'day' | '1day';
    DeviceId: string[];
}

export interface HarmonicsResponse
{
    period1: any[];
    period2: any[];
    metadata: any;
}

/* ===================== SERVICE ===================== */

@Injectable()
export class HarmonicsService
{
    private readonly TIMEZONE = 'Asia/Kolkata';

    constructor (
        @InjectConnection( 'surajcotton' )
        private readonly connection: Connection
    ) { }

    /* ===================== MAIN ===================== */

    async getHarmonicsFromPayload ( payload: HarmonicsPayload ): Promise<HarmonicsResponse>
    {
        this.validatePayload( payload );

        const p1 = this.parsePeriod(
            payload.Period1startDate,
            payload.Period1startTime,
            payload.Period1endDate,
            payload.Period1endTime
        );

        const p2 = this.parsePeriod(
            payload.Period2startDate,
            payload.Period2startTime,
            payload.Period2endDate,
            payload.Period2endTime
        );

        const tags = this.generateTags( payload.DeviceId );

        // For hourly resolution, fetch 15-minute data to track min/max within each hour
        if ( [ 'hour', '1hour' ].includes( payload.resolution ) )
        {
            const [ raw15min1, raw15min2 ] = await Promise.all( [
                this.fetchHarmonicsData( p1.start, p1.end, tags, '15mins' ),
                this.fetchHarmonicsData( p2.start, p2.end, tags, '15mins' ),
            ] );

            let d1 = this.processHarmonicsData( raw15min1, payload.DeviceId );
            let d2 = this.processHarmonicsData( raw15min2, payload.DeviceId );

            d1 = this.groupByHourWithMinMax( d1, payload.DeviceId );
            d2 = this.groupByHourWithMinMax( d2, payload.DeviceId );

            return {
                period1: d1,
                period2: d2,
                metadata: {
                    period1: { start: p1.start.toISOString(), end: p1.end.toISOString() },
                    period2: { start: p2.start.toISOString(), end: p2.end.toISOString() },
                    resolution: payload.resolution,
                    devices: payload.DeviceId,
                    totalTags: tags.length,
                    queryTime: new Date().toISOString(),
                },
            };
        }

        // For other resolutions, use the original logic
        const [ raw1, raw2 ] = await Promise.all( [
            this.fetchHarmonicsData( p1.start, p1.end, tags, payload.resolution ),
            this.fetchHarmonicsData( p2.start, p2.end, tags, payload.resolution ),
        ] );

        let d1 = this.processHarmonicsData( raw1, payload.DeviceId );
        let d2 = this.processHarmonicsData( raw2, payload.DeviceId );

        if ( [ '15mins', '30mins' ].includes( payload.resolution ) )
        {
            d1 = this.attachMinMaxSamePoint( d1, payload.DeviceId );
            d2 = this.attachMinMaxSamePoint( d2, payload.DeviceId );
        }

        if ( [ 'day', '1day' ].includes( payload.resolution ) )
        {
            d1 = this.groupByDayWithMinMax( d1, payload.DeviceId );
            d2 = this.groupByDayWithMinMax( d2, payload.DeviceId );
        }

        return {
            period1: d1,
            period2: d2,
            metadata: {
                period1: { start: p1.start.toISOString(), end: p1.end.toISOString() },
                period2: { start: p2.start.toISOString(), end: p2.end.toISOString() },
                resolution: payload.resolution,
                devices: payload.DeviceId,
                totalTags: tags.length,
                queryTime: new Date().toISOString(),
            },
        };
    }

    /* ===================== AGGREGATION ===================== */

    private async fetchHarmonicsData (
        start: Date,
        end: Date,
        tags: string[],
        resolution: string
    ): Promise<any[]>
    {
        const collection = this.connection.collection( 'historical' );

        if ( [ 'day', '1day' ].includes( resolution ) )
        {
            return collection
                .aggregate( [
                    { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
                    { $match: { ts: { $gte: start, $lt: end } } },
                    { $project: { timestamp: 1, ...this.roundFields( tags ) } },
                    { $sort: { timestamp: 1 } },
                ] )
                .toArray();
        }

        const { unit, binSize } = this.getBucketConfig( resolution );

        return collection
            .aggregate( [
                { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
                { $match: { ts: { $gte: start, $lt: end } } },
                {
                    $group: {
                        _id: {
                            bucket: {
                                $dateTrunc: {
                                    date: '$ts',
                                    unit,
                                    binSize,
                                    timezone: this.TIMEZONE,
                                },
                            },
                        },
                        ...this.avgFields( tags ),
                    },
                },
                {
                    $project: {
                        _id: 0,
                        // IMPORTANT: Add timezone offset to the timestamp
                        timestamp: {
                            $dateToString: {
                                date: '$_id.bucket',
                                format: '%Y-%m-%dT%H:%M:%S%z', // Added %z for timezone offset
                                timezone: this.TIMEZONE,
                            },
                        },
                        ...this.roundFields( tags ),
                    },
                },
                { $sort: { timestamp: 1 } },
            ] )
            .toArray();
    }

    /* ===================== HELPERS ===================== */

    private getBucketConfig ( res: string ): { unit: any; binSize: number }
    {
        switch ( res )
        {
            case '15mins':
                return { unit: 'minute', binSize: 15 };
            case '30mins':
                return { unit: 'minute', binSize: 30 };
            case 'hour':
            case '1hour':
                return { unit: 'hour', binSize: 1 };
            case 'day':
            case '1day':
                return { unit: 'day', binSize: 1 };
            default:
                return { unit: 'hour', binSize: 1 };
        }
    }

    private avgFields ( tags: string[] )
    {
        return Object.fromEntries( tags.map( ( t ) => [ t, { $avg: `$${ t }` } ] ) );
    }

    private roundFields ( tags: string[] )
    {
        return Object.fromEntries( tags.map( ( t ) => [ t, { $round: [ `$${ t }`, 2 ] } ] ) );
    }

    /* ===================== POST PROCESS ===================== */

    private processHarmonicsData ( data: any[], devices: string[] ): any[]
    {
        return data.map( ( d ) =>
        {
            const out: any = { timestamp: d.timestamp };

            devices.forEach( ( dev ) =>
            {
                const v = [ 'V1', 'V2', 'V3' ]
                    .map( ( x ) => d[ `${ dev }_Harmonics_${ x }_THD` ] )
                    .filter( ( v ) => typeof v === 'number' );

                const i = [ 'I1', 'I2', 'I3' ]
                    .map( ( x ) => d[ `${ dev }_Harmonics_${ x }_THD` ] )
                    .filter( ( v ) => typeof v === 'number' );

                out[ `${ dev }_Harmonics_V_THD` ] = v.length
                    ? +( v.reduce( ( a, b ) => a + b, 0 ) / v.length ).toFixed( 2 )
                    : 0;
                out[ `${ dev }_Harmonics_I_THD` ] = i.length
                    ? +( i.reduce( ( a, b ) => a + b, 0 ) / i.length ).toFixed( 2 )
                    : 0;
            } );

            return out;
        } );
    }

    /* ===================== 15 / 30 MIN MIN–MAX ===================== */

    private attachMinMaxSamePoint ( data: any[], devices: string[] ): any[]
    {
        return data.map( ( row ) =>
        {
            devices.forEach( ( dev ) =>
            {
                [ 'V', 'I' ].forEach( ( type ) =>
                {
                    const k = `${ dev }_Harmonics_${ type }_THD`;
                    const v = row[ k ];

                    row[ `${ k }_min` ] = typeof v === 'number' ? v : 0;
                    row[ `${ k }_max` ] = typeof v === 'number' ? v : 0;
                    row[ `${ k }_minTime` ] = row.timestamp;
                    row[ `${ k }_maxTime` ] = row.timestamp;
                } );
            } );

            return row;
        } );
    }

    /* ===================== HOUR MIN / MAX ===================== */

    private groupByHourWithMinMax ( data: any[], devices: string[] ): any[]
    {
        const hourMap = new Map<string, {
            hourStart: moment.Moment;
            hourEnd: moment.Moment;
            intervals: any[];
            deviceStats: Map<string, {
                vValues: Array<{ value: number, timestamp: string, localTime: string }>;
                iValues: Array<{ value: number, timestamp: string, localTime: string }>;
            }>;
        }>();

        // Group intervals by their exact hour
        data.forEach( ( row ) =>
        {
            // Parse timestamp - it should have timezone offset now
            const timestampStr = row.timestamp;

            // Parse with timezone (timestamp now includes offset like +0530)
            let rowTime: moment.Moment;
            if ( timestampStr.includes( '+' ) && timestampStr.length > 19 )
            {
                // Has timezone offset, parse normally
                rowTime = moment.parseZone( timestampStr );
            } else
            {
                // Fallback: parse as local timezone
                rowTime = moment.tz( timestampStr, this.TIMEZONE );
            }

            // Get the hour this interval belongs to (in local timezone)
            const localTimeStr = rowTime.format( 'HH:mm:ss' );
            const hourStart = rowTime.clone().startOf( 'hour' );
            const hourKey = hourStart.format( 'YYYY-MM-DD HH:00:00' );

            if ( !hourMap.has( hourKey ) )
            {
                hourMap.set( hourKey, {
                    hourStart,
                    hourEnd: hourStart.clone().add( 1, 'hour' ),
                    intervals: [],
                    deviceStats: new Map()
                } );

                devices.forEach( dev =>
                {
                    hourMap.get( hourKey )!.deviceStats.set( dev, {
                        vValues: [],
                        iValues: []
                    } );
                } );
            }

            const hourData = hourMap.get( hourKey )!;
            hourData.intervals.push( row );

            devices.forEach( dev =>
            {
                const deviceStats = hourData.deviceStats.get( dev )!;
                const vValue = row[ `${ dev }_Harmonics_V_THD` ];
                const iValue = row[ `${ dev }_Harmonics_I_THD` ];

                if ( typeof vValue === 'number' )
                {
                    deviceStats.vValues.push( {
                        value: vValue,
                        timestamp: row.timestamp,
                        localTime: localTimeStr
                    } );
                }

                if ( typeof iValue === 'number' )
                {
                    deviceStats.iValues.push( {
                        value: iValue,
                        timestamp: row.timestamp,
                        localTime: localTimeStr
                    } );
                }
            } );
        } );

        // Create hourly summaries
        const result: any[] = [];

        // Get all hour keys and sort them
        const sortedHourKeys = Array.from( hourMap.keys() ).sort();

        sortedHourKeys.forEach( hourKey =>
        {
            const { hourStart, hourEnd, intervals, deviceStats } = hourMap.get( hourKey )!;

            const hourlySummary: any = {
                timestamp: hourStart.format(),
                intervalStart: hourStart.format( 'YYYY-MM-DD HH:mm:ss' ),
                intervalEnd: hourEnd.format( 'YYYY-MM-DD HH:mm:ss' ),
                intervalCount: intervals.length
            };

            devices.forEach( dev =>
            {
                const stats = deviceStats.get( dev )!;
                const vKey = `${ dev }_Harmonics_V_THD`;
                const iKey = `${ dev }_Harmonics_I_THD`;

                // Process Voltage THD
                if ( stats.vValues.length > 0 )
                {
                    // Calculate average
                    const vAvg = stats.vValues.reduce( ( sum, item ) => sum + item.value, 0 ) / stats.vValues.length;
                    hourlySummary[ vKey ] = +vAvg.toFixed( 2 );

                    // Find min and max WITHIN THIS HOUR
                    const vMin = stats.vValues.reduce( ( min, curr ) =>
                        curr.value < min.value ? curr : min
                    );
                    const vMax = stats.vValues.reduce( ( max, curr ) =>
                        curr.value > max.value ? curr : max
                    );

                    hourlySummary[ `${ vKey }_min` ] = +vMin.value.toFixed( 2 );
                    hourlySummary[ `${ vKey }_minTime` ] = vMin.timestamp;
                    hourlySummary[ `${ vKey }_max` ] = +vMax.value.toFixed( 2 );
                    hourlySummary[ `${ vKey }_maxTime` ] = vMax.timestamp;
                }
                else
                {
                    hourlySummary[ vKey ] = 0;
                    hourlySummary[ `${ vKey }_min` ] = 0;
                    hourlySummary[ `${ vKey }_max` ] = 0;
                    hourlySummary[ `${ vKey }_minTime` ] = null;
                    hourlySummary[ `${ vKey }_maxTime` ] = null;
                }

                // Process Current THD
                if ( stats.iValues.length > 0 )
                {
                    // Calculate average
                    const iAvg = stats.iValues.reduce( ( sum, item ) => sum + item.value, 0 ) / stats.iValues.length;
                    hourlySummary[ iKey ] = +iAvg.toFixed( 2 );

                    // Find min and max WITHIN THIS HOUR
                    const iMin = stats.iValues.reduce( ( min, curr ) =>
                        curr.value < min.value ? curr : min
                    );
                    const iMax = stats.iValues.reduce( ( max, curr ) =>
                        curr.value > max.value ? curr : max
                    );

                    hourlySummary[ `${ iKey }_min` ] = +iMin.value.toFixed( 2 );
                    hourlySummary[ `${ iKey }_minTime` ] = iMin.timestamp;
                    hourlySummary[ `${ iKey }_max` ] = +iMax.value.toFixed( 2 );
                    hourlySummary[ `${ iKey }_maxTime` ] = iMax.timestamp;
                }
                else
                {
                    hourlySummary[ iKey ] = 0;
                    hourlySummary[ `${ iKey }_min` ] = 0;
                    hourlySummary[ `${ iKey }_max` ] = 0;
                    hourlySummary[ `${ iKey }_minTime` ] = null;
                    hourlySummary[ `${ iKey }_maxTime` ] = null;
                }
            } );

            result.push( hourlySummary );
        } );

        return result;
    }

    /* ===================== DAY MIN / MAX (6AM) ===================== */

    private groupByDayWithMinMax ( data: any[], devices: string[] ): any[]
    {
        const dayMap: Record<string, {
            dayStart: moment.Moment;
            dayEnd: moment.Moment;
            intervals: any[];
            deviceData: Record<string, {
                vData: Array<{ value: number, timestamp: string }>;
                iData: Array<{ value: number, timestamp: string }>;
            }>;
        }> = {};

        data.forEach( ( row ) =>
        {
            // Parse timestamp with timezone
            const timestampStr = row.timestamp;
            let timestamp: moment.Moment;

            if ( timestampStr.includes( '+' ) && timestampStr.length > 19 )
            {
                timestamp = moment.parseZone( timestampStr );
            } else
            {
                timestamp = moment.tz( timestampStr, this.TIMEZONE );
            }

            // Determine which day bucket this belongs to (6AM-based)
            let dayBucket = timestamp.clone();
            if ( timestamp.hour() < 6 )
            {
                dayBucket = timestamp.clone().subtract( 1, 'day' );
            }

            const dayKey = dayBucket.format( 'YYYY-MM-DD' );
            const dayStart = moment.tz( `${ dayKey } 06:00:00`, this.TIMEZONE );
            const dayEnd = dayStart.clone().add( 24, 'hours' );

            if ( !dayMap[ dayKey ] )
            {
                dayMap[ dayKey ] = {
                    dayStart,
                    dayEnd,
                    intervals: [],
                    deviceData: {}
                };

                devices.forEach( dev =>
                {
                    dayMap[ dayKey ].deviceData[ dev ] = {
                        vData: [],
                        iData: []
                    };
                } );
            }

            dayMap[ dayKey ].intervals.push( row );

            devices.forEach( dev =>
            {
                const vKey = `${ dev }_Harmonics_V_THD`;
                const iKey = `${ dev }_Harmonics_I_THD`;

                const vValue = row[ vKey ];
                const iValue = row[ iKey ];

                if ( typeof vValue === 'number' )
                {
                    dayMap[ dayKey ].deviceData[ dev ].vData.push( {
                        value: vValue,
                        timestamp: row.timestamp
                    } );
                }

                if ( typeof iValue === 'number' )
                {
                    dayMap[ dayKey ].deviceData[ dev ].iData.push( {
                        value: iValue,
                        timestamp: row.timestamp
                    } );
                }
            } );
        } );

        const result = Object.keys( dayMap ).sort().map( dayKey =>
        {
            const { dayStart, dayEnd, intervals, deviceData } = dayMap[ dayKey ];

            const dailySummary: any = {
                timestamp: dayStart.format(),
                intervalStart: dayStart.format( 'YYYY-MM-DD HH:mm:ss' ),
                intervalEnd: dayEnd.format( 'YYYY-MM-DD HH:mm:ss' ),
                displayDate: dayStart.format( 'YYYY-MM-DD' ),
                intervalCount: intervals.length
            };

            devices.forEach( ( dev ) =>
            {
                const vKey = `${ dev }_Harmonics_V_THD`;
                const iKey = `${ dev }_Harmonics_I_THD`;

                const vIntervals = deviceData[ dev ].vData;
                const iIntervals = deviceData[ dev ].iData;

                if ( vIntervals.length > 0 )
                {
                    const vAvg = vIntervals.reduce( ( sum, item ) => sum + item.value, 0 ) / vIntervals.length;
                    dailySummary[ vKey ] = +vAvg.toFixed( 2 );

                    const vMin = vIntervals.reduce( ( min, current ) => current.value < min.value ? current : min );
                    const vMax = vIntervals.reduce( ( max, current ) => current.value > max.value ? current : max );

                    dailySummary[ `${ vKey }_min` ] = +vMin.value.toFixed( 2 );
                    dailySummary[ `${ vKey }_minTime` ] = vMin.timestamp;
                    dailySummary[ `${ vKey }_max` ] = +vMax.value.toFixed( 2 );
                    dailySummary[ `${ vKey }_maxTime` ] = vMax.timestamp;
                }
                else
                {
                    dailySummary[ vKey ] = 0;
                    dailySummary[ `${ vKey }_min` ] = 0;
                    dailySummary[ `${ vKey }_max` ] = 0;
                    dailySummary[ `${ vKey }_minTime` ] = null;
                    dailySummary[ `${ vKey }_maxTime` ] = null;
                }

                if ( iIntervals.length > 0 )
                {
                    const iAvg = iIntervals.reduce( ( sum, item ) => sum + item.value, 0 ) / iIntervals.length;
                    dailySummary[ iKey ] = +iAvg.toFixed( 2 );

                    const iMin = iIntervals.reduce( ( min, current ) => current.value < min.value ? current : min );
                    const iMax = iIntervals.reduce( ( max, current ) => current.value > max.value ? current : max );

                    dailySummary[ `${ iKey }_min` ] = +iMin.value.toFixed( 2 );
                    dailySummary[ `${ iKey }_minTime` ] = iMin.timestamp;
                    dailySummary[ `${ iKey }_max` ] = +iMax.value.toFixed( 2 );
                    dailySummary[ `${ iKey }_maxTime` ] = iMax.timestamp;
                }
                else
                {
                    dailySummary[ iKey ] = 0;
                    dailySummary[ `${ iKey }_min` ] = 0;
                    dailySummary[ `${ iKey }_max` ] = 0;
                    dailySummary[ `${ iKey }_minTime` ] = null;
                    dailySummary[ `${ iKey }_maxTime` ] = null;
                }
            } );

            return dailySummary;
        } );

        return result;
    }

    /* ===================== VALIDATION ===================== */

    private validatePayload ( payload: HarmonicsPayload ): void
    {
        if ( !payload.DeviceId?.length ) throw new BadRequestException( 'DeviceId required' );
        if ( !payload.resolution ) throw new BadRequestException( 'Resolution required' );
    }

    private parsePeriod ( sd: string, st: string, ed: string, et: string )
    {
        const start = moment.tz( `${ sd } ${ st }`, 'YYYY-MM-DD HH:mm:ss', this.TIMEZONE );
        const end = moment.tz( `${ ed } ${ et }`, 'YYYY-MM-DD HH:mm:ss', this.TIMEZONE );
        if ( !start.isValid() || !end.isValid() ) throw new BadRequestException( 'Invalid period' );
        return { start: start.toDate(), end: end.toDate() };
    }

    private generateTags ( deviceIds: string[] ): string[]
    {
        const types = [ 'Harmonics_V1_THD', 'Harmonics_V2_THD', 'Harmonics_V3_THD', 'Harmonics_I1_THD', 'Harmonics_I2_THD', 'Harmonics_I3_THD' ];
        return deviceIds.flatMap( ( id ) => types.map( ( t ) => `${ id }_${ t }` ) );
    }
}