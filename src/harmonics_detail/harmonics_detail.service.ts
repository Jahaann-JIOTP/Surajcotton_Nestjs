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
export class HarmonicsDetailService
{
    private readonly TIMEZONE = 'Asia/Karachi';

    constructor (
        @InjectConnection( 'surajcotton' )
        private readonly connection: Connection
    ) { }

    /* ===================== MAIN ===================== */

    async getHarmonicsDetailFromPayload ( payload: HarmonicsPayload ): Promise<HarmonicsResponse>
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

            // Get energy consumption data for both periods
            const [ energyData1, energyData2 ] = await Promise.all( [
                this.getEnergyConsumed( p1.start, p1.end, payload.DeviceId ),
                this.getEnergyConsumed( p2.start, p2.end, payload.DeviceId ),
            ] );

            let d1 = this.processHarmonicsData( raw15min1, payload.DeviceId );
            let d2 = this.processHarmonicsData( raw15min2, payload.DeviceId );

            d1 = this.groupByHourWithMinMax( d1, payload.DeviceId );
            d2 = this.groupByHourWithMinMax( d2, payload.DeviceId );

            // Add energy consumption to results
            d1 = this.addEnergyConsumedToResults( d1, energyData1 );
            d2 = this.addEnergyConsumedToResults( d2, energyData2 );

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

        // Get energy consumption data for both periods
        const [ energyData1, energyData2 ] = await Promise.all( [
            this.getEnergyConsumed( p1.start, p1.end, payload.DeviceId ),
            this.getEnergyConsumed( p2.start, p2.end, payload.DeviceId ),
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
            // For day resolution, calculate overall min/max for the entire period
            d1 = this.calculateOverallMinMax( d1, payload.DeviceId );
            d2 = this.calculateOverallMinMax( d2, payload.DeviceId );
        }

        // Add energy consumption to results
        d1 = this.addEnergyConsumedToResults( d1, energyData1 );
        d2 = this.addEnergyConsumedToResults( d2, energyData2 );

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

    /* ===================== ENERGY CONSUMPTION CALCULATION ===================== */

    private async getEnergyConsumed ( start: Date, end: Date, devices: string[] ): Promise<Record<string, number>>
    {
        const energyData: Record<string, number> = {};

        // Get energy consumption for each device
        for ( const device of devices )
        {
            const energyTag = `${ device }_Del_ActiveEnergy`;
            const collection = this.connection.collection( 'historical' );

            try
            {
                // Get first and last values of energy meter reading
                const results = await collection
                    .aggregate( [
                        { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
                        { $match: { ts: { $gte: start, $lt: end }, [ energyTag ]: { $exists: true } } },
                        { $sort: { ts: 1 } },
                        {
                            $group: {
                                _id: null,
                                firstValue: { $first: `$${ energyTag }` },
                                lastValue: { $last: `$${ energyTag }` },
                                firstTimestamp: { $first: '$ts' },
                                lastTimestamp: { $last: '$ts' }
                            }
                        }
                    ] )
                    .toArray();

                if ( results.length > 0 && results[ 0 ].firstValue !== null && results[ 0 ].lastValue !== null )
                {
                    const firstValue = results[ 0 ].firstValue;
                    const lastValue = results[ 0 ].lastValue;

                    // Calculate energy consumed: last reading - first reading
                    energyData[ device ] = lastValue - firstValue;
                }
                else
                {
                    energyData[ device ] = 0;
                }
            }
            catch ( error )
            {
                console.error( `Error fetching energy data for device ${ device }:`, error );
                energyData[ device ] = 0;
            }
        }

        return energyData;
    }

    private addEnergyConsumedToResults ( data: any[], energyData: Record<string, number> ): any[]
    {
        return data.map( ( row ) =>
        {
            // Add energy consumption for each device
            Object.keys( energyData ).forEach( device =>
            {
                const energyKey = `${ device }_Total_Energy_Consumed`;
                row[ energyKey ] = +energyData[ device ].toFixed( 3 ); // Keep 3 decimal places for energy
            } );

            return row;
        } );
    }

    /* ===================== NEW: OVERALL CALCULATIONS FOR DAY RESOLUTION ===================== */

    private calculateOverallMinMax ( data: any[], devices: string[] ): any[]
    {
        if ( data.length === 0 )
        {
            return [ this.createEmptyOverallSummary() ];
        }

        // Initialize overall tracking objects for each device
        const overallStats: Record<string, {
            vValues: Array<{ value: number, timestamp: string }>;
            iValues: Array<{ value: number, timestamp: string }>;
        }> = {};

        // Initialize for all devices
        devices.forEach( dev =>
        {
            overallStats[ dev ] = {
                vValues: [],
                iValues: []
            };
        } );

        // Collect all values from all intervals
        data.forEach( row =>
        {
            devices.forEach( dev =>
            {
                const vKey = `${ dev }_Harmonics_V_THD`;
                const iKey = `${ dev }_Harmonics_I_THD`;

                const vValue = row[ vKey ];
                const iValue = row[ iKey ];

                if ( typeof vValue === 'number' && !isNaN( vValue ) )
                {
                    overallStats[ dev ].vValues.push( {
                        value: vValue,
                        timestamp: row.timestamp
                    } );
                }

                if ( typeof iValue === 'number' && !isNaN( iValue ) )
                {
                    overallStats[ dev ].iValues.push( {
                        value: iValue,
                        timestamp: row.timestamp
                    } );
                }
            } );
        } );

        // Create overall summary
        const firstData = data[ 0 ];
        const lastData = data[ data.length - 1 ];

        const overallSummary: any = {
            timestamp: firstData.timestamp,
            periodStart: firstData.timestamp,
            periodEnd: lastData.timestamp,
            intervalCount: data.length,
            isOverallSummary: true,
            displayLabel: 'Overall Period'
        };

        // Calculate statistics for each device
        devices.forEach( dev =>
        {
            const vKey = `${ dev }_Harmonics_V_THD`;
            const iKey = `${ dev }_Harmonics_I_THD`;

            const vValues = overallStats[ dev ].vValues;
            const iValues = overallStats[ dev ].iValues;

            // Voltage THD calculations
            if ( vValues.length > 0 )
            {
                // Calculate average
                const vAvg = vValues.reduce( ( sum, item ) => sum + item.value, 0 ) / vValues.length;
                overallSummary[ vKey ] = +vAvg.toFixed( 2 );

                // Find overall min and max
                const vMin = vValues.reduce( ( min, current ) =>
                    current.value < min.value ? current : min
                );
                const vMax = vValues.reduce( ( max, current ) =>
                    current.value > max.value ? current : max
                );

                overallSummary[ `${ vKey }_min` ] = +vMin.value.toFixed( 2 );
                overallSummary[ `${ vKey }_minTime` ] = vMin.timestamp;
                overallSummary[ `${ vKey }_max` ] = +vMax.value.toFixed( 2 );
                overallSummary[ `${ vKey }_maxTime` ] = vMax.timestamp;
                overallSummary[ `${ vKey }_count` ] = vValues.length;
            } else
            {
                overallSummary[ vKey ] = 0;
                overallSummary[ `${ vKey }_min` ] = 0;
                overallSummary[ `${ vKey }_max` ] = 0;
                overallSummary[ `${ vKey }_minTime` ] = null;
                overallSummary[ `${ vKey }_maxTime` ] = null;
                overallSummary[ `${ vKey }_count` ] = 0;
            }

            // Current THD calculations
            if ( iValues.length > 0 )
            {
                // Calculate average
                const iAvg = iValues.reduce( ( sum, item ) => sum + item.value, 0 ) / iValues.length;
                overallSummary[ iKey ] = +iAvg.toFixed( 2 );

                // Find overall min and max
                const iMin = iValues.reduce( ( min, current ) =>
                    current.value < min.value ? current : min
                );
                const iMax = iValues.reduce( ( max, current ) =>
                    current.value > max.value ? current : max
                );

                overallSummary[ `${ iKey }_min` ] = +iMin.value.toFixed( 2 );
                overallSummary[ `${ iKey }_minTime` ] = iMin.timestamp;
                overallSummary[ `${ iKey }_max` ] = +iMax.value.toFixed( 2 );
                overallSummary[ `${ iKey }_maxTime` ] = iMax.timestamp;
                overallSummary[ `${ iKey }_count` ] = iValues.length;
            } else
            {
                overallSummary[ iKey ] = 0;
                overallSummary[ `${ iKey }_min` ] = 0;
                overallSummary[ `${ iKey }_max` ] = 0;
                overallSummary[ `${ iKey }_minTime` ] = null;
                overallSummary[ `${ iKey }_maxTime` ] = null;
                overallSummary[ `${ iKey }_count` ] = 0;
            }
        } );

        return [ overallSummary ]; // Return as array with single overall summary object
    }

    private createEmptyOverallSummary (): any
    {
        return {
            timestamp: new Date().toISOString(),
            periodStart: null,
            periodEnd: null,
            intervalCount: 0,
            isOverallSummary: true,
            displayLabel: 'No Data Available'
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