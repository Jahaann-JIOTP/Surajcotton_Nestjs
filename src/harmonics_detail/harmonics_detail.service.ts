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

        console.log( '\n=== FETCHING PARAMETERS ===' );
        console.log( 'Period 1:', { start: p1.start, end: p1.end } );
        console.log( 'Period 2:', { start: p2.start, end: p2.end } );
        console.log( 'Resolution:', payload.resolution );

        // For daily resolution, fetch 15-minute data and calculate overall statistics
        if ( [ 'day', '1day' ].includes( payload.resolution ) )
        {
            console.log( '\n=== DAY RESOLUTION DETECTED ===' );
            console.log( 'Will fetch 15-minute data and calculate overall statistics' );

            // Adjust end times to include the 06:00 of the next day
            const p1AdjustedEnd = new Date( p1.end.getTime() + 60000 ); // Add 1 minute
            const p2AdjustedEnd = new Date( p2.end.getTime() + 60000 ); // Add 1 minute

            console.log( `Period 1: ${ p1.start } to ${ p1AdjustedEnd }` );
            console.log( `Period 2: ${ p2.start } to ${ p2AdjustedEnd }` );

            const [ raw15min1, raw15min2 ] = await Promise.all( [
                this.fetchHarmonicsData( p1.start, p1AdjustedEnd, tags, '15mins' ),
                this.fetchHarmonicsData( p2.start, p2AdjustedEnd, tags, '15mins' ),
            ] );

            console.log( `\nPeriod 1 - Fetched ${ raw15min1.length } 15-minute intervals` );
            console.log( `Period 2 - Fetched ${ raw15min2.length } 15-minute intervals` );

            // In your main method, add these logs:
            console.log( '\n=== BEFORE FETCHING ENERGY DATA ===' );
            console.log( `Period 1: ${ p1.start } to ${ p1.end }` );
            console.log( `Period 2: ${ p2.start } to ${ p2.end }` );

            // Get energy consumption data for both periods
            // In your main method where you call getEnergyConsumed, adjust the end times:
            const [ energyData1, energyData2 ] = await Promise.all( [
                this.getEnergyConsumed( p1.start, new Date( p1.end.getTime() + 60000 ), payload.DeviceId ),
                this.getEnergyConsumed( p2.start, new Date( p2.end.getTime() + 60000 ), payload.DeviceId ),
            ]);
            console.log( `\n=== ENERGY DATA COLLECTED ===` );
            console.log( `Period 1 energy data:` );
            console.log( JSON.stringify( energyData1, null, 2 ) );
            console.log( `\nPeriod 2 energy data:` );
            console.log( JSON.stringify( energyData2, null, 2 ) );
            let d1 = this.processHarmonicsData( raw15min1, payload.DeviceId );
            let d2 = this.processHarmonicsData( raw15min2, payload.DeviceId );

            // Calculate overall min/max from the 15-minute data
            d1 = this.calculateOverallMinMax( d1, payload.DeviceId );
            d2 = this.calculateOverallMinMax( d2, payload.DeviceId );

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

        // For 15min and 30min resolutions, use the original logic
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

        console.log( `\n=== FETCHING ENERGY CONSUMPTION ===` );
        console.log( `Period: ${ start } to ${ end }` );
        console.log( `Devices: ${ devices.join( ', ' ) }` );

        // Get energy consumption for each device
        for ( const device of devices )
        {
            const energyTag = `${ device }_Del_ActiveEnergy`;
            const collection = this.connection.collection( 'historical' );

            console.log( `\nChecking energy for device: ${ device }` );
            console.log( `Energy tag: ${ energyTag }` );

            try
            {
                // First, let's see what data we have in the period
                const allEnergyData = await collection
                    .aggregate( [
                        { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
                        { $match: { ts: { $gte: start, $lte: end }, [ energyTag ]: { $exists: true } } },
                        { $sort: { ts: 1 } },
                        { $project: { timestamp: 1, [ energyTag ]: 1 } }
                    ] )
                    .toArray();

                console.log( `Found ${ allEnergyData.length } total energy records for ${ device } in period` );

                // Log first 3 and last 3 energy records
                if ( allEnergyData.length > 0 )
                {
                    console.log( `\n=== FIRST 3 ENERGY RECORDS for ${ device } ===` );
                    for ( let i = 0; i < Math.min( 3, allEnergyData.length ); i++ )
                    {
                        console.log( `Document ${ i + 1 }:` );
                        console.log( `  Timestamp: ${ allEnergyData[ i ].timestamp }` );
                        console.log( `  ${ energyTag }: ${ allEnergyData[ i ][ energyTag ] }` );
                    }

                    console.log( `\n=== LAST 3 ENERGY RECORDS for ${ device } ===` );
                    const lastIndex = allEnergyData.length - 1;
                    for ( let i = Math.max( 0, lastIndex - 2 ); i <= lastIndex; i++ )
                    {
                        console.log( `Document ${ i + 1 } (index ${ i }):` );
                        console.log( `  Timestamp: ${ allEnergyData[ i ].timestamp }` );
                        console.log( `  ${ energyTag }: ${ allEnergyData[ i ][ energyTag ] }` );
                    }
                }

                // Now get first and last values for calculation
                const results = await collection
                    .aggregate( [
                        { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
                        { $match: { ts: { $gte: start, $lte: end }, [ energyTag ]: { $exists: true } } },
                        { $sort: { ts: 1 } },
                        {
                            $group: {
                                _id: null,
                                firstValue: { $first: `$${ energyTag }` },
                                lastValue: { $last: `$${ energyTag }` },
                                firstTimestamp: { $first: '$ts' },
                                lastTimestamp: { $last: '$ts' },
                                count: { $sum: 1 }
                            }
                        }
                    ] )
                    .toArray();

                console.log( `Aggregation results count: ${ results.length }` );

                if ( results.length > 0 )
                {
                    console.log( `Aggregation result: ${ JSON.stringify( results[ 0 ], null, 2 ) }` );

                    if ( results[ 0 ].firstValue !== null && results[ 0 ].lastValue !== null )
                    {
                        const firstValue = results[ 0 ].firstValue;
                        const lastValue = results[ 0 ].lastValue;
                        const firstTimestamp = results[ 0 ].firstTimestamp;
                        const lastTimestamp = results[ 0 ].lastTimestamp;
                        const count = results[ 0 ].count;

                        // Calculate energy consumed: last reading - first reading
                        const energyConsumed = lastValue - firstValue;
                        energyData[ device ] = energyConsumed;

                        console.log( `\nEnergy consumption for ${ device }:` );
                        console.log( `  First reading: ${ firstValue } at ${ firstTimestamp }` );
                        console.log( `  Last reading: ${ lastValue } at ${ lastTimestamp }` );
                        console.log( `  Total records: ${ count }` );
                        console.log( `  Energy consumed: ${ energyConsumed } kWh (${ lastValue } - ${ firstValue })` );

                        // Also log if readings are increasing or decreasing
                        if ( lastValue > firstValue )
                        {
                            console.log( `  Status: Normal (meter increasing)` );
                        }
                        else if ( lastValue < firstValue )
                        {
                            console.log( `  WARNING: Meter decreasing! Possible meter reset` );
                        }
                        else
                        {
                            console.log( `  Status: No change in meter reading` );
                        }
                    }
                    else
                    {
                        energyData[ device ] = 0;
                        console.log( `First or last value is null for ${ device }, setting to 0` );
                    }
                }
                else
                {
                    energyData[ device ] = 0;
                    console.log( `No energy data found for ${ device } in period, setting to 0` );

                    // Let's check if the tag exists at all in the database
                    const tagExists = await collection.findOne( { [ energyTag ]: { $exists: true } } );
                    if ( tagExists )
                    {
                        console.log( `Note: ${ energyTag } exists in database but not in specified period` );
                        console.log( `Sample document with tag: ${ JSON.stringify( tagExists, null, 2 ) }` );
                    }
                    else
                    {
                        console.log( `WARNING: ${ energyTag } does not exist in database at all` );
                    }
                }
            }
            catch ( error )
            {
                console.error( `Error fetching energy data for device ${ device }:`, error );
                energyData[ device ] = 0;
            }
        }

        console.log( `\n=== ENERGY CONSUMPTION SUMMARY ===` );
        Object.keys( energyData ).forEach( device =>
        {
            console.log( `  ${ device }: ${ energyData[ device ] } kWh` );
        } );

        return energyData;
    }

    private addEnergyConsumedToResults ( data: any[], energyData: Record<string, number> ): any[]
    {
        console.log( `\n=== ADDING ENERGY CONSUMPTION TO RESULTS ===` );
        console.log( `Energy data to add: ${ JSON.stringify( energyData, null, 2 ) }` );
        console.log( `Number of result rows: ${ data.length }` );

        return data.map( ( row, index ) =>
        {
            // Add energy consumption for each device
            Object.keys( energyData ).forEach( device =>
            {
                const energyKey = `${ device }_Total_Energy_Consumed`;
                row[ energyKey ] = +energyData[ device ].toFixed( 3 ); // Keep 3 decimal places for energy

                // Log only for first row to avoid too much output
                if ( index === 0 )
                {
                    console.log( `Added to first row: ${ energyKey } = ${ row[ energyKey ] } kWh` );
                }
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

        console.log( `\n=== START CALCULATING OVERALL MIN/MAX ===` );
        console.log( `Total intervals received: ${ data.length }` );

        // NEW: Log first 3 documents being processed
        console.log( '\n=== FIRST 3 DOCUMENTS BEING PROCESSED ===' );
        for ( let i = 0; i < Math.min( 3, data.length ); i++ )
        {
            console.log( `\nDocument ${ i + 1 } (index ${ i }):` );
            console.log( JSON.stringify( data[ i ], null, 2 ) );

            // Parse timestamp to show hour for debugging
            const timestampStr = data[ i ].timestamp;
            let timestamp: moment.Moment;
            if ( timestampStr.includes( '+' ) && timestampStr.length > 19 )
            {
                timestamp = moment.parseZone( timestampStr );
            } else
            {
                timestamp = moment.tz( timestampStr, this.TIMEZONE );
            }
            console.log( `Timestamp parsed - Hour: ${ timestamp.hour() }:${ timestamp.minute() }:${ timestamp.second() }` );

            // Show device values
            devices.forEach( dev =>
            {
                console.log( `  ${ dev }_Harmonics_V_THD: ${ data[ i ][ `${ dev }_Harmonics_V_THD` ] }` );
                console.log( `  ${ dev }_Harmonics_I_THD: ${ data[ i ][ `${ dev }_Harmonics_I_THD` ] }` );
            } );
        }

        // NEW: Log last 3 documents being processed
        console.log( '\n=== LAST 3 DOCUMENTS BEING PROCESSED ===' );
        const lastIndex = data.length - 1;
        for ( let i = Math.max( 0, lastIndex - 2 ); i <= lastIndex; i++ )
        {
            console.log( `\nDocument ${ i + 1 } (index ${ i }):` );
            console.log( JSON.stringify( data[ i ], null, 2 ) );

            // Parse timestamp to show hour for debugging
            const timestampStr = data[ i ].timestamp;
            let timestamp: moment.Moment;
            if ( timestampStr.includes( '+' ) && timestampStr.length > 19 )
            {
                timestamp = moment.parseZone( timestampStr );
            } else
            {
                timestamp = moment.tz( timestampStr, this.TIMEZONE );
            }
            console.log( `Timestamp parsed - Hour: ${ timestamp.hour() }:${ timestamp.minute() }:${ timestamp.second() }` );

            // Show device values
            devices.forEach( dev =>
            {
                console.log( `  ${ dev }_Harmonics_V_THD: ${ data[ i ][ `${ dev }_Harmonics_V_THD` ] }` );
                console.log( `  ${ dev }_Harmonics_I_THD: ${ data[ i ][ `${ dev }_Harmonics_I_THD` ] }` );
            } );
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

        // Collect all NON-ZERO values from all intervals
        data.forEach( ( row, index ) =>
        {
            devices.forEach( dev =>
            {
                const vKey = `${ dev }_Harmonics_V_THD`;
                const iKey = `${ dev }_Harmonics_I_THD`;

                const vValue = row[ vKey ];
                const iValue = row[ iKey ];

                // Only collect non-zero values for voltage
                if ( typeof vValue === 'number' && vValue !== 0 && !isNaN( vValue ) )
                {
                    overallStats[ dev ].vValues.push( {
                        value: vValue,
                        timestamp: row.timestamp
                    } );
                }

                // Only collect non-zero values for current
                if ( typeof iValue === 'number' && iValue !== 0 && !isNaN( iValue ) )
                {
                    overallStats[ dev ].iValues.push( {
                        value: iValue,
                        timestamp: row.timestamp
                    } );
                }
            } );

            // Log first and last document processing
            if ( index === 0 )
            {
                console.log( `\nFirst document processed:` );
                console.log( `Timestamp: ${ row.timestamp }` );
                devices.forEach( dev =>
                {
                    console.log( `  ${ dev }_Harmonics_V_THD: ${ row[ `${ dev }_Harmonics_V_THD` ] }` );
                    console.log( `  ${ dev }_Harmonics_I_THD: ${ row[ `${ dev }_Harmonics_I_THD` ] }` );
                } );
            }

            if ( index === data.length - 1 )
            {
                console.log( `\nLast document processed:` );
                console.log( `Timestamp: ${ row.timestamp }` );
                devices.forEach( dev =>
                {
                    console.log( `  ${ dev }_Harmonics_V_THD: ${ row[ `${ dev }_Harmonics_V_THD` ] }` );
                    console.log( `  ${ dev }_Harmonics_I_THD: ${ row[ `${ dev }_Harmonics_I_THD` ] }` );
                } );
            }
        } );

        // Log stats collected
        console.log( `\n=== STATS COLLECTED ===` );
        devices.forEach( dev =>
        {
            console.log( `Device: ${ dev }` );
            console.log( `  Voltage THD non-zero values: ${ overallStats[ dev ].vValues.length }` );
            console.log( `  Current THD non-zero values: ${ overallStats[ dev ].iValues.length }` );
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

        // Calculate statistics for each device (EXCLUDING 0 VALUES)
        devices.forEach( dev =>
        {
            const vKey = `${ dev }_Harmonics_V_THD`;
            const iKey = `${ dev }_Harmonics_I_THD`;

            const vValues = overallStats[ dev ].vValues;
            const iValues = overallStats[ dev ].iValues;

            // Voltage THD calculations (excluding 0 values)
            if ( vValues.length > 0 )
            {
                // Calculate average from non-zero values only
                const vAvg = vValues.reduce( ( sum, item ) => sum + item.value, 0 ) / vValues.length;
                overallSummary[ vKey ] = +vAvg.toFixed( 2 );

                // Find overall min and max FROM NON-ZERO VALUES
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

                console.log( `\nDevice ${ dev } - Voltage THD:` );
                console.log( `  Average (non-zero): ${ overallSummary[ vKey ] }` );
                console.log( `  Min: ${ overallSummary[ `${ vKey }_min` ] } at ${ overallSummary[ `${ vKey }_minTime` ] }` );
                console.log( `  Max: ${ overallSummary[ `${ vKey }_max` ] } at ${ overallSummary[ `${ vKey }_maxTime` ] }` );
                console.log( `  Non-zero count: ${ overallSummary[ `${ vKey }_count` ] }` );
            } else
            {
                // If all values are 0 or no valid non-zero data, set to 0
                overallSummary[ vKey ] = 0;
                overallSummary[ `${ vKey }_min` ] = 0;
                overallSummary[ `${ vKey }_max` ] = 0;
                overallSummary[ `${ vKey }_minTime` ] = null;
                overallSummary[ `${ vKey }_maxTime` ] = null;
                overallSummary[ `${ vKey }_count` ] = 0;

                console.log( `\nDevice ${ dev } - Voltage THD: No non-zero values found` );
            }

            // Current THD calculations (excluding 0 values)
            if ( iValues.length > 0 )
            {
                // Calculate average from non-zero values only
                const iAvg = iValues.reduce( ( sum, item ) => sum + item.value, 0 ) / iValues.length;
                overallSummary[ iKey ] = +iAvg.toFixed( 2 );

                // Find overall min and max FROM NON-ZERO VALUES
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

                console.log( `\nDevice ${ dev } - Current THD:` );
                console.log( `  Average (non-zero): ${ overallSummary[ iKey ] }` );
                console.log( `  Min: ${ overallSummary[ `${ iKey }_min` ] } at ${ overallSummary[ `${ iKey }_minTime` ] }` );
                console.log( `  Max: ${ overallSummary[ `${ iKey }_max` ] } at ${ overallSummary[ `${ iKey }_maxTime` ] }` );
                console.log( `  Non-zero count: ${ overallSummary[ `${ iKey }_count` ] }` );
            } else
            {
                // If all values are 0 or no valid non-zero data, set to 0
                overallSummary[ iKey ] = 0;
                overallSummary[ `${ iKey }_min` ] = 0;
                overallSummary[ `${ iKey }_max` ] = 0;
                overallSummary[ `${ iKey }_minTime` ] = null;
                overallSummary[ `${ iKey }_maxTime` ] = null;
                overallSummary[ `${ iKey }_count` ] = 0;

                console.log( `\nDevice ${ dev } - Current THD: No non-zero values found` );
            }
        } );

        console.log( `\n=== FINAL OVERALL SUMMARY ===` );
        console.log( JSON.stringify( overallSummary, null, 2 ) );

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
            // For day resolution, fetch raw data
            // We need to adjust the end time to include the 06:00 of next day
            const adjustedEnd = new Date( end.getTime() + 1000 ); // Add 1 second
            console.log( `\n=== FETCHING DAY RESOLUTION DATA ===` );
            console.log( `Original end: ${ end }` );
            console.log( `Adjusted end: ${ adjustedEnd }` );

            const data = await collection
                .aggregate( [
                    { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
                    { $match: { ts: { $gte: start, $lte: adjustedEnd } } },
                    { $project: { timestamp: 1, ...this.roundFields( tags ) } },
                    { $sort: { timestamp: 1 } },
                ] )
                .toArray();

            // Log what we fetched
            if ( data.length > 0 )
            {
                console.log( `Total documents fetched: ${ data.length }` );
                console.log( `First document: ${ data[ 0 ].timestamp }` );
                console.log( `Last document: ${ data[ data.length - 1 ].timestamp }` );

                // Calculate expected count
                const hoursDiff = moment( adjustedEnd ).diff( moment( start ), 'hours', true );
                const expected15minIntervals = Math.ceil( hoursDiff * 4 );
                console.log( `Expected intervals: ${ expected15minIntervals }` );
                console.log( `Difference: ${ expected15minIntervals - data.length }` );

                // NEW: Log first 3 documents in detail
                console.log( '\n=== FIRST 3 DOCUMENTS ===' );
                for ( let i = 0; i < Math.min( 3, data.length ); i++ )
                {
                    console.log( `\nDocument ${ i + 1 }:` );
                    console.log( `Timestamp: ${ data[ i ].timestamp }` );

                    // Show all harmonics tags for this document
                    tags.slice( 0, 6 ).forEach( tag => // Show first 6 tags to avoid too much output
                    {
                        if ( data[ i ][ tag ] !== undefined )
                        {
                            console.log( `  ${ tag }: ${ data[ i ][ tag ] }` );
                        }
                    } );
                }

                // NEW: Log last 3 documents in detail
                console.log( '\n=== LAST 3 DOCUMENTS ===' );
                const lastIndex = data.length - 1;
                for ( let i = Math.max( 0, lastIndex - 2 ); i <= lastIndex; i++ )
                {
                    console.log( `\nDocument ${ i + 1 } (index ${ i }):` );
                    console.log( `Timestamp: ${ data[ i ].timestamp }` );

                    // Show all harmonics tags for this document
                    tags.slice( 0, 6 ).forEach( tag => // Show first 6 tags to avoid too much output
                    {
                        if ( data[ i ][ tag ] !== undefined )
                        {
                            console.log( `  ${ tag }: ${ data[ i ][ tag ] }` );
                        }
                    } );
                }
            }

            return data;
        }

        const { unit, binSize } = this.getBucketConfig( resolution );

        // For 15min/30min resolutions, adjust end time to include the full period
        let adjustedEnd = end;
        if ( [ '15mins', '30mins', 'hour', '1hour' ].includes( resolution ) )
        {
            // Add 1 minute to ensure we include the boundary
            adjustedEnd = new Date( end.getTime() + 60000 );
        }

        console.log( `\n=== FETCHING DATA ===` );
        console.log( `Resolution: ${ resolution }` );
        console.log( `Start: ${ start }` );
        console.log( `End: ${ end }` );
        console.log( `Adjusted End: ${ adjustedEnd }` );
        console.log( `Tags count: ${ tags.length }` );

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
                        ...this.avgFieldsExcludingZero( tags ),
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

            // NEW: Log first 3 documents in detail
            console.log( '\n=== FIRST 3 DOCUMENTS ===' );
            for ( let i = 0; i < Math.min( 3, data.length ); i++ )
            {
                console.log( `\nDocument ${ i + 1 }:` );
                console.log( `Timestamp: ${ data[ i ].timestamp }` );

                // Show all harmonics tags for this document
                tags.slice( 0, 6 ).forEach( tag => // Show first 6 tags to avoid too much output
                {
                    if ( data[ i ][ tag ] !== undefined )
                    {
                        console.log( `  ${ tag }: ${ data[ i ][ tag ] }` );
                    }
                } );
            }

            // NEW: Log last 3 documents in detail
            console.log( '\n=== LAST 3 DOCUMENTS ===' );
            const lastIndex = data.length - 1;
            for ( let i = Math.max( 0, lastIndex - 2 ); i <= lastIndex; i++ )
            {
                console.log( `\nDocument ${ i + 1 } (index ${ i }):` );
                console.log( `Timestamp: ${ data[ i ].timestamp }` );

                // Show all harmonics tags for this document
                tags.slice( 0, 6 ).forEach( tag => // Show first 6 tags to avoid too much output
                {
                    if ( data[ i ][ tag ] !== undefined )
                    {
                        console.log( `  ${ tag }: ${ data[ i ][ tag ] }` );
                    }
                } );
            }

            // Check for 06:00 timestamps
            console.log( '\n=== 06:00 TIMESTAMPS CHECK ===' );
            const sixAMTimestamps = data.filter( doc =>
                doc.timestamp.includes( 'T06:00:00' )
            );
            console.log( `Found ${ sixAMTimestamps.length } documents with 06:00:00 timestamp` );

            if ( sixAMTimestamps.length > 0 )
            {
                sixAMTimestamps.forEach( ( doc, index ) =>
                {
                    console.log( `  ${ index + 1 }. ${ doc.timestamp }` );
                } );
            }

            // Also show what buckets we got
            console.log( '\n=== TIMESTAMP SUMMARY ===' );
            console.log( 'First few timestamps:' );
            data.slice( 0, 3 ).forEach( ( doc, i ) =>
            {
                console.log( `  ${ i + 1 }. ${ doc.timestamp }` );
            } );
            console.log( 'Last few timestamps:' );
            data.slice( -3 ).forEach( ( doc, i ) =>
            {
                console.log( `  ${ data.length - 2 + i }. ${ doc.timestamp }` );
            } );
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
                return { unit: 'day', binSize: 1 };
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