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
    private readonly TIMEZONE = 'Asia/Karachi';

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

        console.log( '\n=== FETCHING PARAMETERS ===' );
        console.log( 'Period 1:', { start: p1.start, end: p1.end } );
        console.log( 'Period 2:', { start: p2.start, end: p2.end } );
        console.log( 'Resolution:', payload.resolution );

        // For daily resolution, fetch at finer resolution and group by day
        if ( [ 'day', '1day' ].includes( payload.resolution ) )
        {
            console.log( '\n=== DAY RESOLUTION DETECTED ===' );
            console.log( 'Will fetch 15-minute data and group by 6AM days' );

            const [ raw15min1, raw15min2 ] = await Promise.all( [
                this.fetchHarmonicsData( p1.start, p1.end, tags, '15mins' ),
                this.fetchHarmonicsData( p2.start, p2.end, tags, '15mins' ),
            ] );

            console.log( `\nPeriod 1 - Fetched ${ raw15min1.length } 15-minute intervals` );
            console.log( `Period 2 - Fetched ${ raw15min2.length } 15-minute intervals` );

            let d1 = this.processHarmonicsData( raw15min1, payload.DeviceId );
            let d2 = this.processHarmonicsData( raw15min2, payload.DeviceId );

            d1 = this.groupByDayWithMinMax( d1, payload.DeviceId );
            d2 = this.groupByDayWithMinMax( d2, payload.DeviceId );

            console.log( '\n=== AFTER DAY GROUPING ===' );
            console.log( `Period 1 - ${ d1.length } day groups (6AM to 6AM)` );
            console.log( `Period 2 - ${ d2.length } day groups (6AM to 6AM)` );

            if ( d1.length > 0 )
            {
                console.log( '\nPeriod 1 first day group:' );
                console.log( JSON.stringify( d1[ 0 ], null, 2 ) );
                if ( d1.length > 1 )
                {
                    console.log( '\nPeriod 1 last day group:' );
                    console.log( JSON.stringify( d1[ d1.length - 1 ], null, 2 ) );
                }
            }

            if ( d2.length > 0 )
            {
                console.log( '\nPeriod 2 first day group:' );
                console.log( JSON.stringify( d2[ 0 ], null, 2 ) );
                if ( d2.length > 1 )
                {
                    console.log( '\nPeriod 2 last day group:' );
                    console.log( JSON.stringify( d2[ d2.length - 1 ], null, 2 ) );
                }
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

        // For 15min and 30min resolutions, use the original logic
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

        // Don't handle day resolution here - we'll handle it in getHarmonicsFromPayload
        // Always use aggregation for non-day resolutions
        const { unit, binSize } = this.getBucketConfig( resolution );

        console.log( `\n=== FETCHING DATA ===` );
        console.log( `Resolution: ${ resolution }` );
        console.log( `Start: ${ start }` );
        console.log( `End: ${ end }` );
        console.log( `Tags count: ${ tags.length }` );

        // For 15-minute resolution, we need to adjust the end time to include the next 6:00 bucket
        let adjustedEnd = end;
        if ( resolution === '15mins' || resolution === '30mins' )
        {
            // Add 1 MINUTE (60000 milliseconds) to include the exact end time bucket
            adjustedEnd = new Date( end.getTime() + 60000 );
            console.log( `Adjusted end time: ${ adjustedEnd }` );
            console.log( `Adjustment: Added 60000ms (1 minute) to include end bucket` );
        }

        const data = await collection
            .aggregate( [
                { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
                { $match: { ts: { $gte: start, $lte: adjustedEnd } } },
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
                        ...this.avgFieldsExcludingZero( tags ), // CHANGED: Use avgFieldsExcludingZero
                    },
                },
                {
                    $project: {
                        _id: 0,
                        timestamp: {
                            $dateToString: {
                                date: '$_id.bucket',
                                format: '%Y-%m-%dT%H:%M:%S%z',
                                timezone: this.TIMEZONE,
                            },
                        },
                        ...this.roundFields( tags ),
                    },
                },
                { $sort: { timestamp: 1 } },
            ] )
            .toArray();

        // Console first and last document
        if ( data.length > 0 )
        {
            console.log( `\n=== FETCH RESULTS (${ resolution.toUpperCase() }) ===` );
            console.log( `Total documents fetched: ${ data.length }` );
            console.log( `First document timestamp: ${ data[ 0 ].timestamp }` );
            console.log( `Last document timestamp: ${ data[ data.length - 1 ].timestamp }` );

            // Calculate expected count
            const startMoment = moment( start );
            const endMoment = moment( adjustedEnd );
            const hoursDiff = endMoment.diff( startMoment, 'hours', true );
            const expected15minIntervals = Math.ceil( hoursDiff * 4 ); // 4 intervals per hour
            console.log( `Expected 15-min intervals: ${ expected15minIntervals }` );
            console.log( `Difference: ${ expected15minIntervals - data.length } missing` );

            // Show sample of first document
            console.log( '\nFirst document (sample):' );
            const firstDoc = data[ 0 ];
            const sampleKeys = Object.keys( firstDoc ).slice( 0, 5 ); // Show first 5 keys
            sampleKeys.forEach( key =>
            {
                console.log( `  ${ key }: ${ firstDoc[ key ] }` );
            } );

            // Also show what buckets we got
            if ( data.length > 0 )
            {
                console.log( '\nFirst few timestamps:' );
                data.slice( 0, 3 ).forEach( ( doc, i ) =>
                {
                    console.log( `  ${ i + 1 }. ${ doc.timestamp }` );
                } );
                console.log( '\nLast few timestamps:' );
                data.slice( -3 ).forEach( ( doc, i ) =>
                {
                    console.log( `  ${ data.length - 2 + i }. ${ doc.timestamp }` );
                } );
            }
        } else
        {
            console.log( 'No documents found for the specified period' );
        }

        return data;
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
                // For day resolution, we'll fetch 15-minute data and group in memory
                return { unit: 'minute', binSize: 15 };
            default:
                return { unit: 'hour', binSize: 1 };
        }
    }

    private avgFieldsExcludingZero ( tags: string[] ) // NEW: Average excluding 0 values
    {
        return Object.fromEntries( tags.map( ( t ) => [
            t, {
                $avg: {
                    $cond: {
                        if: {
                            $and: [
                                { $ne: [ `$${ t }`, 0 ] },
                                { $ne: [ `$${ t }`, null ] },
                                { $ne: [ { $type: `$${ t }` }, "missing" ] }
                            ]
                        },
                        then: `$${ t }`,
                        else: null  // null values are ignored by $avg
                    }
                }
            }
        ] ) );
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
                // Exclude 0 values from voltage THD calculation
                const v = [ 'V1', 'V2', 'V3' ]
                    .map( ( x ) => d[ `${ dev }_Harmonics_${ x }_THD` ] )
                    .filter( ( v ) => typeof v === 'number' && v !== 0 && !isNaN( v ) );

                // Exclude 0 values from current THD calculation
                const i = [ 'I1', 'I2', 'I3' ]
                    .map( ( x ) => d[ `${ dev }_Harmonics_${ x }_THD` ] )
                    .filter( ( v ) => typeof v === 'number' && v !== 0 && !isNaN( v ) );

                // Calculate average only if we have valid non-zero values
                out[ `${ dev }_Harmonics_V_THD` ] = v.length > 0
                    ? +( v.reduce( ( a, b ) => a + b, 0 ) / v.length ).toFixed( 2 )
                    : 0; // If all values are 0 or invalid, return 0

                out[ `${ dev }_Harmonics_I_THD` ] = i.length > 0
                    ? +( i.reduce( ( a, b ) => a + b, 0 ) / i.length ).toFixed( 2 )
                    : 0; // If all values are 0 or invalid, return 0
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

    /* ===================== HOUR MIN / MAX - UPDATED TO EXCLUDE 0 ===================== */

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

                // Only add NON-ZERO voltage values
                if ( typeof vValue === 'number' && vValue !== 0 && !isNaN( vValue ) )
                {
                    deviceStats.vValues.push( {
                        value: vValue,
                        timestamp: row.timestamp,
                        localTime: localTimeStr
                    } );
                }

                // Only add NON-ZERO current values
                if ( typeof iValue === 'number' && iValue !== 0 && !isNaN( iValue ) )
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

                // Process Voltage THD - EXCLUDING 0 VALUES
                if ( stats.vValues.length > 0 )
                {
                    // Calculate average from NON-ZERO values only
                    const vAvg = stats.vValues.reduce( ( sum, item ) => sum + item.value, 0 ) / stats.vValues.length;
                    hourlySummary[ vKey ] = +vAvg.toFixed( 2 );

                    // Find min and max FROM NON-ZERO VALUES WITHIN THIS HOUR
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
                    // If all values were 0 or no valid data, set to 0
                    hourlySummary[ vKey ] = 0;
                    hourlySummary[ `${ vKey }_min` ] = 0;
                    hourlySummary[ `${ vKey }_max` ] = 0;
                    hourlySummary[ `${ vKey }_minTime` ] = null;
                    hourlySummary[ `${ vKey }_maxTime` ] = null;
                }

                // Process Current THD - EXCLUDING 0 VALUES
                if ( stats.iValues.length > 0 )
                {
                    // Calculate average from NON-ZERO values only
                    const iAvg = stats.iValues.reduce( ( sum, item ) => sum + item.value, 0 ) / stats.iValues.length;
                    hourlySummary[ iKey ] = +iAvg.toFixed( 2 );

                    // Find min and max FROM NON-ZERO VALUES WITHIN THIS HOUR
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
                    // If all values were 0 or no valid data, set to 0
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

    /* ===================== DAY MIN / MAX (6AM) - UPDATED TO EXCLUDE 0 ===================== */

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

        console.log( `\n=== START DAY GROUPING ===` );
        console.log( `Total intervals received: ${ data.length }` );

        // Sort data by timestamp to ensure chronological order
        const sortedData = [ ...data ].sort( ( a, b ) =>
            moment( a.timestamp ).valueOf() - moment( b.timestamp ).valueOf()
        );

        if ( sortedData.length > 0 )
        {
            console.log( `\n=== FIRST 3 DOCUMENTS BEING PROCESSED ===` );
            for ( let i = 0; i < Math.min( 3, sortedData.length ); i++ )
            {
                console.log( `\nDocument ${ i + 1 } (index ${ i }):` );
                console.log( JSON.stringify( sortedData[ i ], null, 2 ) );

                // Parse timestamp to show hour for debugging
                const timestampStr = sortedData[ i ].timestamp;
                let timestamp: moment.Moment;
                if ( timestampStr.includes( '+' ) && timestampStr.length > 19 )
                {
                    timestamp = moment.parseZone( timestampStr );
                } else
                {
                    timestamp = moment.tz( timestampStr, this.TIMEZONE );
                }
                console.log( `Hour: ${ timestamp.hour() }:${ timestamp.minute() }` );
            }

            console.log( `\n=== LAST 3 DOCUMENTS BEING PROCESSED ===` );
            const lastIndex = sortedData.length - 1;
            for ( let i = Math.max( 0, lastIndex - 2 ); i <= lastIndex; i++ )
            {
                console.log( `\nDocument ${ i + 1 } (index ${ i }):` );
                console.log( JSON.stringify( sortedData[ i ], null, 2 ) );

                // Parse timestamp to show hour for debugging
                const timestampStr = sortedData[ i ].timestamp;
                let timestamp: moment.Moment;
                if ( timestampStr.includes( '+' ) && timestampStr.length > 19 )
                {
                    timestamp = moment.parseZone( timestampStr );
                } else
                {
                    timestamp = moment.tz( timestampStr, this.TIMEZONE );
                }
                console.log( `Hour: ${ timestamp.hour() }:${ timestamp.minute() }` );
            }

            console.log( `\nFirst document in data:` );
            console.log( JSON.stringify( sortedData[ 0 ], null, 2 ) );
            console.log( `Last document in data:` );
            console.log( JSON.stringify( sortedData[ sortedData.length - 1 ], null, 2 ) );
        }

        sortedData.forEach( ( row, index ) =>
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

            // Log first document for each day
            if ( !dayMap[ dayKey ] )
            {
                console.log( `\nCreating new day group: ${ dayKey }` );
                console.log( `Day range: ${ dayStart.format( 'YYYY-MM-DD HH:mm:ss' ) } to ${ dayEnd.format( 'YYYY-MM-DD HH:mm:ss' ) }` );

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

                // Log the first document for this day
                console.log( `First document for day ${ dayKey }:` );
                console.log( JSON.stringify( row, null, 2 ) );
            }

            dayMap[ dayKey ].intervals.push( row );

            // Log the last document when we add it
            if ( index === sortedData.length - 1 )
            {
                console.log( `\nLast document in dataset belongs to day: ${ dayKey }` );
                console.log( `Document: ${ JSON.stringify( row, null, 2 ) }` );
            }

            devices.forEach( dev =>
            {
                const vKey = `${ dev }_Harmonics_V_THD`;
                const iKey = `${ dev }_Harmonics_I_THD`;

                const vValue = row[ vKey ];
                const iValue = row[ iKey ];

                // Only add NON-ZERO voltage values
                if ( typeof vValue === 'number' && vValue !== 0 && !isNaN( vValue ) )
                {
                    dayMap[ dayKey ].deviceData[ dev ].vData.push( {
                        value: vValue,
                        timestamp: row.timestamp
                    } );
                }

                // Only add NON-ZERO current values
                if ( typeof iValue === 'number' && iValue !== 0 && !isNaN( iValue ) )
                {
                    dayMap[ dayKey ].deviceData[ dev ].iData.push( {
                        value: iValue,
                        timestamp: row.timestamp
                    } );
                }
            } );
        } );

        // Get sorted day keys
        const sortedDayKeys = Object.keys( dayMap ).sort();

        console.log( `\n=== DAY GROUPING SUMMARY ===` );
        console.log( `Total day groups created: ${ sortedDayKeys.length }` );

        // Log each day group's first and last document
        sortedDayKeys.forEach( dayKey =>
        {
            const dayData = dayMap[ dayKey ];
            console.log( `\nDay: ${ dayKey }` );
            console.log( `Total intervals: ${ dayData.intervals.length }` );

            if ( dayData.intervals.length > 0 )
            {
                console.log( `First 3 documents in this day:` );
                for ( let i = 0; i < Math.min( 3, dayData.intervals.length ); i++ )
                {
                    console.log( `  ${ i + 1 }. ${ dayData.intervals[ i ].timestamp }` );
                }

                console.log( `Last 3 documents in this day:` );
                const lastIdx = dayData.intervals.length - 1;
                for ( let i = Math.max( 0, lastIdx - 2 ); i <= lastIdx; i++ )
                {
                    console.log( `  ${ i + 1 }. ${ dayData.intervals[ i ].timestamp }` );
                }
            }

            // Count 06:00 timestamps in this day
            const sixAmCount = dayData.intervals.filter( interval =>
            {
                const ts = interval.timestamp;
                return ts.includes( 'T06:00:00' );
            } ).length;

            if ( sixAmCount > 0 )
            {
                console.log( `Contains ${ sixAmCount } 06:00:00 timestamp(s)` );
            }
        } );

        const result = sortedDayKeys.map( dayKey =>
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

                const vIntervals = deviceData[ dev ].vData; // Already filtered to exclude 0
                const iIntervals = deviceData[ dev ].iData; // Already filtered to exclude 0

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

        // Log the final result first and last documents
        console.log( `\n=== FINAL RESULT ===` );
        console.log( `Total day groups in result: ${ result.length }` );

        if ( result.length > 0 )
        {
            console.log( `First day group in result:` );
            console.log( JSON.stringify( result[ 0 ], null, 2 ) );

            if ( result.length > 1 )
            {
                console.log( `Last day group in result:` );
                console.log( JSON.stringify( result[ result.length - 1 ], null, 2 ) );
            }
        }

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