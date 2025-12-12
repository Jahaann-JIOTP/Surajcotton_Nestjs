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
        period1: {
            start: string;
            end: string;
        };
        period2: {
            start: string;
            end: string;
        };
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
        // Validate payload
        this.validatePayload( payload );

        // Parse and validate time periods
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

        // Validate that periods don't overlap (if needed)
        if ( period1.end > period2.start )
        {
            throw new BadRequestException( 'Period 1 end time cannot be after Period 2 start time' );
        }

        // Generate tags for both periods
        const tags = this.generateTags( payload.DeviceId );

        // Fetch data for both periods in parallel
        const [ period1Data, period2Data ] = await Promise.all( [
            this.fetchHarmonicsData( period1.start, period1.end, tags, payload.resolution ),
            this.fetchHarmonicsData( period2.start, period2.end, tags, payload.resolution )
        ] );

        // Process data to calculate averages and restructure
        const processedPeriod1Data = this.processHarmonicsData( period1Data, payload.DeviceId );
        const processedPeriod2Data = this.processHarmonicsData( period2Data, payload.DeviceId );

        // Apply grouping based on resolution
        let finalPeriod1Data = processedPeriod1Data;
        let finalPeriod2Data = processedPeriod2Data;

        if ( payload.resolution === 'hour' || payload.resolution === '1hour' )
        {
            finalPeriod1Data = this.groupByHourWithMinMax( processedPeriod1Data, payload.DeviceId );
            finalPeriod2Data = this.groupByHourWithMinMax( processedPeriod2Data, payload.DeviceId );
        }
        else if ( payload.resolution === 'day' || payload.resolution === '1day' )
        {
            finalPeriod1Data = this.groupByDayWithMinMax( processedPeriod1Data, payload.DeviceId );
            finalPeriod2Data = this.groupByDayWithMinMax( processedPeriod2Data, payload.DeviceId );
        }

        // Prepare response
        return {
            period1Data: finalPeriod1Data,
            period2Data: finalPeriod2Data,
            metadata: {
                period1: {
                    start: period1.start.toISOString(),
                    end: period1.end.toISOString()
                },
                period2: {
                    start: period2.start.toISOString(),
                    end: period2.end.toISOString()
                },
                resolution: payload.resolution,
                devices: payload.DeviceId,
                totalTags: tags.length,
                queryTime: new Date().toISOString()
            }
        };
    }

    private validatePayload ( payload: HarmonicsPayload ): void
    {
        const requiredFields = [
            'Period1startDate', 'Period1startTime', 'Period1endDate', 'Period1endTime',
            'Period2startDate', 'Period2startTime', 'Period2endDate', 'Period2endTime',
            'resolution', 'DeviceId'
        ];

        const missingFields = requiredFields.filter( field => !payload[ field as keyof HarmonicsPayload ] );

        if ( missingFields.length > 0 )
        {
            throw new BadRequestException( `Missing required fields: ${ missingFields.join( ', ' ) }` );
        }

        if ( !Array.isArray( payload.DeviceId ) || payload.DeviceId.length === 0 )
        {
            throw new BadRequestException( 'DeviceId must be a non-empty array' );
        }

        // Update to include "day" and "1day" as valid resolution
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
        try
        {
            const start = moment.tz(
                `${ startDate } ${ startTime }`,
                'YYYY-MM-DD HH:mm:ss',
                this.TIMEZONE
            );

            const end = moment.tz(
                `${ endDate } ${ endTime }`,
                'YYYY-MM-DD HH:mm:ss',
                this.TIMEZONE
            );

            if ( !start.isValid() || !end.isValid() )
            {
                throw new BadRequestException( `Invalid date/time format for ${ periodName }` );
            }

            if ( start.isAfter( end ) )
            {
                throw new BadRequestException( `${ periodName } start time cannot be after end time` );
            }

            return {
                start: start.toDate(),
                end: end.toDate()
            };
        } catch ( error )
        {
            if ( error instanceof BadRequestException )
            {
                throw error;
            }
            throw new BadRequestException( `Error parsing ${ periodName } time: ${ error.message }` );
        }
    }

    private generateTags ( deviceIds: string[] ): string[]
    {
        const tagTypes = [
            'Harmonics_V1_THD',
            'Harmonics_V2_THD',
            'Harmonics_V3_THD',
            'Harmonics_I1_THD',
            'Harmonics_I2_THD',
            'Harmonics_I3_THD'
        ];

        return deviceIds.flatMap( deviceId =>
            tagTypes.map( tagType => `${ deviceId }_${ tagType }` )
        );
    }

    private async fetchHarmonicsData (
        start: Date,
        end: Date,
        tags: string[],
        resolution: string
    ): Promise<any[]>
    {
        const collection = this.connection.collection( 'historical' );

        // Format dates in local timezone for query
        const formatDateForQuery = ( date: Date ): string =>
        {
            return moment( date ).tz( this.TIMEZONE ).format( 'YYYY-MM-DDTHH:mm:ss' ) + '+05:30';
        };

        // Determine time grouping based on resolution
        const minuteSlotSize = this.getMinuteSlotSize( resolution );

        const pipeline = [
            {
                $match: {
                    timestamp: {
                        $gte: formatDateForQuery( start ),
                        $lt: formatDateForQuery( end )
                    }
                }
            },
            {
                $addFields: {
                    timestampDate: {
                        $dateFromString: {
                            dateString: "$timestamp",
                            timezone: this.TIMEZONE
                        }
                    }
                }
            },
            {
                $group: {
                    _id: this.getGroupingStage( resolution ),
                    timestamp: { $first: "$timestamp" },
                    ...this.createAvgFields( tags )
                }
            },
            {
                $project: {
                    _id: 0,
                    timestamp: 1,
                    ...this.createRoundedFields( tags )
                }
            },
            { $sort: { timestamp: 1 } }
        ];

        return await collection.aggregate( pipeline ).toArray();
    }

    private getMinuteSlotSize ( resolution: string ): number
    {
        const resolutionMap = {
            '15mins': 15,
            '30mins': 30,
            'hour': 60,
            '1hour': 60,
            'day': 1440,
            '1day': 1440
        };
        return resolutionMap[ resolution ] || 15;
    }

    private getGroupingStage ( resolution: string ): any
    {
        const baseGroup = {
            year: { $year: "$timestampDate" },
            month: { $month: "$timestampDate" },
            day: { $dayOfMonth: "$timestampDate" },
            hour: { $hour: "$timestampDate" }
        };

        const minuteSlotSize = this.getMinuteSlotSize( resolution );

        if ( minuteSlotSize === 1440 )
        { // 1 day or day
            return {
                year: baseGroup.year,
                month: baseGroup.month,
                day: baseGroup.day
            };
        } else if ( minuteSlotSize === 60 )
        { // 1 hour or hour
            return {
                year: baseGroup.year,
                month: baseGroup.month,
                day: baseGroup.day,
                hour: baseGroup.hour
            };
        } else
        {
            return {
                ...baseGroup,
                minuteSlot: {
                    $floor: {
                        $divide: [
                            { $minute: "$timestampDate" },
                            minuteSlotSize
                        ]
                    }
                }
            };
        }
    }

    private createAvgFields ( tags: string[] ): any
    {
        return tags.reduce( ( acc, tag ) => ( {
            ...acc,
            [ tag ]: { $avg: `$${ tag }` }
        } ), {} );
    }

    private createRoundedFields ( tags: string[] ): any
    {
        return tags.reduce( ( acc, tag ) => ( {
            ...acc,
            [ tag ]: { $round: [ `$${ tag }`, 2 ] }
        } ), {} );
    }

    // Process harmonics data to calculate V_THD and I_THD averages
    private processHarmonicsData ( data: any[], deviceIds: string[] ): any[]
    {
        return data.map( item =>
        {
            const processedItem: any = {
                timestamp: item.timestamp,
                originalTimestamp: item.timestamp // Keep original for grouping
            };

            // For each device, calculate averages
            deviceIds.forEach( deviceId =>
            {
                // Calculate average of V1, V2, V3 for this device
                const v1 = item[ `${ deviceId }_Harmonics_V1_THD` ] || 0;
                const v2 = item[ `${ deviceId }_Harmonics_V2_THD` ] || 0;
                const v3 = item[ `${ deviceId }_Harmonics_V3_THD` ] || 0;

                // Calculate average (handle cases where some values might be missing)
                const vValues = [ v1, v2, v3 ].filter( v => v !== 0 );
                const vAvg = vValues.length > 0
                    ? vValues.reduce( ( sum, val ) => sum + val, 0 ) / vValues.length
                    : 0;

                // Calculate average of I1, I2, I3 for this device
                const i1 = item[ `${ deviceId }_Harmonics_I1_THD` ] || 0;
                const i2 = item[ `${ deviceId }_Harmonics_I2_THD` ] || 0;
                const i3 = item[ `${ deviceId }_Harmonics_I3_THD` ] || 0;

                // Calculate average (handle cases where some values might be missing)
                const iValues = [ i1, i2, i3 ].filter( i => i !== 0 );
                const iAvg = iValues.length > 0
                    ? iValues.reduce( ( sum, val ) => sum + val, 0 ) / iValues.length
                    : 0;

                // Add ONLY the calculated averages to the processed item (not individual values)
                processedItem[ `${ deviceId }_Harmonics_V_THD` ] = Math.round( vAvg * 100 ) / 100; // Round to 2 decimal places
                processedItem[ `${ deviceId }_Harmonics_I_THD` ] = Math.round( iAvg * 100 ) / 100; // Round to 2 decimal places
            } );

            return processedItem;
        } );
    }

    // Group data by hour with min/max values and their timestamps
    private groupByHourWithMinMax ( data: any[], deviceIds: string[] ): any[]
    {
        const groupedByHour: { [ key: string ]: any[] } = {};

        // Group data by hour
        data.forEach( item =>
        {
            const timestamp = moment.tz( item.timestamp, this.TIMEZONE );
            const hourKey = timestamp.format( 'YYYY-MM-DD HH:00:00' ); // Group by hour

            if ( !groupedByHour[ hourKey ] )
            {
                groupedByHour[ hourKey ] = [];
            }
            groupedByHour[ hourKey ].push( item );
        } );

        // Calculate hourly averages with min/max
        const hourlyData: any[] = [];

        Object.keys( groupedByHour ).sort().forEach( hourKey =>
        {
            const hourData = groupedByHour[ hourKey ];

            const hourlyItem: any = {
                timestamp: `${ hourKey }+05:30`, // Format with timezone
                intervalStart: hourKey,
                intervalEnd: moment.tz( hourKey, 'YYYY-MM-DD HH:mm:ss', this.TIMEZONE )
                    .add( 1, 'hour' )
                    .format( 'YYYY-MM-DD HH:mm:ss' )
            };

            // For each device, calculate statistics for this hour
            deviceIds.forEach( deviceId =>
            {
                // Get all V_THD values for this device in this hour
                const vDataPoints = hourData
                    .map( item => ( {
                        value: item[ `${ deviceId }_Harmonics_V_THD` ],
                        timestamp: item.originalTimestamp
                    } ) )
                    .filter( point => point.value !== undefined && point.value !== 0 );

                // Get all I_THD values for this device in this hour
                const iDataPoints = hourData
                    .map( item => ( {
                        value: item[ `${ deviceId }_Harmonics_I_THD` ],
                        timestamp: item.originalTimestamp
                    } ) )
                    .filter( point => point.value !== undefined && point.value !== 0 );

                // Calculate V_THD statistics
                if ( vDataPoints.length > 0 )
                {
                    const vValues = vDataPoints.map( point => point.value );
                    const vAvg = vValues.reduce( ( sum, val ) => sum + val, 0 ) / vValues.length;

                    // Find min V_THD
                    const vMinPoint = vDataPoints.reduce( ( min, point ) =>
                        point.value < min.value ? point : min, vDataPoints[ 0 ] );

                    // Find max V_THD
                    const vMaxPoint = vDataPoints.reduce( ( max, point ) =>
                        point.value > max.value ? point : max, vDataPoints[ 0 ] );

                    hourlyItem[ `${ deviceId }_Harmonics_V_THD` ] = Math.round( vAvg * 100 ) / 100;
                    hourlyItem[ `${ deviceId }_Harmonics_V_THD_min` ] = Math.round( vMinPoint.value * 100 ) / 100;
                    hourlyItem[ `${ deviceId }_Harmonics_V_THD_min_timestamp` ] = vMinPoint.timestamp;
                    hourlyItem[ `${ deviceId }_Harmonics_V_THD_max` ] = Math.round( vMaxPoint.value * 100 ) / 100;
                    hourlyItem[ `${ deviceId }_Harmonics_V_THD_max_timestamp` ] = vMaxPoint.timestamp;
                }
                else
                {
                    hourlyItem[ `${ deviceId }_Harmonics_V_THD` ] = 0;
                    hourlyItem[ `${ deviceId }_Harmonics_V_THD_min` ] = 0;
                    hourlyItem[ `${ deviceId }_Harmonics_V_THD_min_timestamp` ] = null;
                    hourlyItem[ `${ deviceId }_Harmonics_V_THD_max` ] = 0;
                    hourlyItem[ `${ deviceId }_Harmonics_V_THD_max_timestamp` ] = null;
                }

                // Calculate I_THD statistics
                if ( iDataPoints.length > 0 )
                {
                    const iValues = iDataPoints.map( point => point.value );
                    const iAvg = iValues.reduce( ( sum, val ) => sum + val, 0 ) / iValues.length;

                    // Find min I_THD
                    const iMinPoint = iDataPoints.reduce( ( min, point ) =>
                        point.value < min.value ? point : min, iDataPoints[ 0 ] );

                    // Find max I_THD
                    const iMaxPoint = iDataPoints.reduce( ( max, point ) =>
                        point.value > max.value ? point : max, iDataPoints[ 0 ] );

                    hourlyItem[ `${ deviceId }_Harmonics_I_THD` ] = Math.round( iAvg * 100 ) / 100;
                    hourlyItem[ `${ deviceId }_Harmonics_I_THD_min` ] = Math.round( iMinPoint.value * 100 ) / 100;
                    hourlyItem[ `${ deviceId }_Harmonics_I_THD_min_timestamp` ] = iMinPoint.timestamp;
                    hourlyItem[ `${ deviceId }_Harmonics_I_THD_max` ] = Math.round( iMaxPoint.value * 100 ) / 100;
                    hourlyItem[ `${ deviceId }_Harmonics_I_THD_max_timestamp` ] = iMaxPoint.timestamp;
                }
                else
                {
                    hourlyItem[ `${ deviceId }_Harmonics_I_THD` ] = 0;
                    hourlyItem[ `${ deviceId }_Harmonics_I_THD_min` ] = 0;
                    hourlyItem[ `${ deviceId }_Harmonics_I_THD_min_timestamp` ] = null;
                    hourlyItem[ `${ deviceId }_Harmonics_I_THD_max` ] = 0;
                    hourlyItem[ `${ deviceId }_Harmonics_I_THD_max_timestamp` ] = null;
                }
            } );

            hourlyData.push( hourlyItem );
        } );

        return hourlyData;
    }

    // Group data by day with min/max values and their timestamps
    private groupByDayWithMinMax ( data: any[], deviceIds: string[] ): any[]
    {
        const groupedByDay: { [ key: string ]: any[] } = {};

        // Group data by day
        data.forEach( item =>
        {
            const timestamp = moment.tz( item.timestamp, this.TIMEZONE );
            const dayKey = timestamp.format( 'YYYY-MM-DD' ); // Group by day

            if ( !groupedByDay[ dayKey ] )
            {
                groupedByDay[ dayKey ] = [];
            }
            groupedByDay[ dayKey ].push( item );
        } );

        // Calculate daily averages with min/max
        const dailyData: any[] = [];

        Object.keys( groupedByDay ).sort().forEach( dayKey =>
        {
            const dayData = groupedByDay[ dayKey ];

            const dailyItem: any = {
                timestamp: `${ dayKey }T00:00:00+05:30`, // Format with timezone (start of day)
                intervalStart: `${ dayKey } 00:00:00`,
                intervalEnd: `${ dayKey } 23:59:59`
            };

            // For each device, calculate statistics for this day
            deviceIds.forEach( deviceId =>
            {
                // Get all V_THD values for this device in this day
                const vDataPoints = dayData
                    .map( item => ( {
                        value: item[ `${ deviceId }_Harmonics_V_THD` ],
                        timestamp: item.originalTimestamp
                    } ) )
                    .filter( point => point.value !== undefined && point.value !== 0 );

                // Get all I_THD values for this device in this day
                const iDataPoints = dayData
                    .map( item => ( {
                        value: item[ `${ deviceId }_Harmonics_I_THD` ],
                        timestamp: item.originalTimestamp
                    } ) )
                    .filter( point => point.value !== undefined && point.value !== 0 );

                // Calculate V_THD statistics
                if ( vDataPoints.length > 0 )
                {
                    const vValues = vDataPoints.map( point => point.value );
                    const vAvg = vValues.reduce( ( sum, val ) => sum + val, 0 ) / vValues.length;

                    // Find min V_THD
                    const vMinPoint = vDataPoints.reduce( ( min, point ) =>
                        point.value < min.value ? point : min, vDataPoints[ 0 ] );

                    // Find max V_THD
                    const vMaxPoint = vDataPoints.reduce( ( max, point ) =>
                        point.value > max.value ? point : max, vDataPoints[ 0 ] );

                    dailyItem[ `${ deviceId }_Harmonics_V_THD` ] = Math.round( vAvg * 100 ) / 100;
                    dailyItem[ `${ deviceId }_Harmonics_V_THD_min` ] = Math.round( vMinPoint.value * 100 ) / 100;
                    dailyItem[ `${ deviceId }_Harmonics_V_THD_min_timestamp` ] = vMinPoint.timestamp;
                    dailyItem[ `${ deviceId }_Harmonics_V_THD_max` ] = Math.round( vMaxPoint.value * 100 ) / 100;
                    dailyItem[ `${ deviceId }_Harmonics_V_THD_max_timestamp` ] = vMaxPoint.timestamp;
                }
                else
                {
                    dailyItem[ `${ deviceId }_Harmonics_V_THD` ] = 0;
                    dailyItem[ `${ deviceId }_Harmonics_V_THD_min` ] = 0;
                    dailyItem[ `${ deviceId }_Harmonics_V_THD_min_timestamp` ] = null;
                    dailyItem[ `${ deviceId }_Harmonics_V_THD_max` ] = 0;
                    dailyItem[ `${ deviceId }_Harmonics_V_THD_max_timestamp` ] = null;
                }

                // Calculate I_THD statistics
                if ( iDataPoints.length > 0 )
                {
                    const iValues = iDataPoints.map( point => point.value );
                    const iAvg = iValues.reduce( ( sum, val ) => sum + val, 0 ) / iValues.length;

                    // Find min I_THD
                    const iMinPoint = iDataPoints.reduce( ( min, point ) =>
                        point.value < min.value ? point : min, iDataPoints[ 0 ] );

                    // Find max I_THD
                    const iMaxPoint = iDataPoints.reduce( ( max, point ) =>
                        point.value > max.value ? point : max, iDataPoints[ 0 ] );

                    dailyItem[ `${ deviceId }_Harmonics_I_THD` ] = Math.round( iAvg * 100 ) / 100;
                    dailyItem[ `${ deviceId }_Harmonics_I_THD_min` ] = Math.round( iMinPoint.value * 100 ) / 100;
                    dailyItem[ `${ deviceId }_Harmonics_I_THD_min_timestamp` ] = iMinPoint.timestamp;
                    dailyItem[ `${ deviceId }_Harmonics_I_THD_max` ] = Math.round( iMaxPoint.value * 100 ) / 100;
                    dailyItem[ `${ deviceId }_Harmonics_I_THD_max_timestamp` ] = iMaxPoint.timestamp;
                }
                else
                {
                    dailyItem[ `${ deviceId }_Harmonics_I_THD` ] = 0;
                    dailyItem[ `${ deviceId }_Harmonics_I_THD_min` ] = 0;
                    dailyItem[ `${ deviceId }_Harmonics_I_THD_min_timestamp` ] = null;
                    dailyItem[ `${ deviceId }_Harmonics_I_THD_max` ] = 0;
                    dailyItem[ `${ deviceId }_Harmonics_I_THD_max_timestamp` ] = null;
                }
            } );

            dailyData.push( dailyItem );
        } );

        return dailyData;
    }

    // Optional: Add a method to get raw data without aggregation
    async getRawHarmonicsData ( payload: HarmonicsPayload ): Promise<any>
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

        const tags = this.generateTags( payload.DeviceId );
        const collection = this.connection.collection( 'historical' );

        // Format dates in local timezone for query
        const formatDateForQuery = ( date: Date ): string =>
        {
            return moment( date ).tz( this.TIMEZONE ).format( 'YYYY-MM-DDTHH:mm:ss' ) + '+05:30';
        };

        // Raw data without aggregation
        const period1Raw = await collection.find( {
            timestamp: {
                $gte: formatDateForQuery( period1.start ),
                $lt: formatDateForQuery( period1.end )
            }
        } )
            .project( this.createProjection( tags ) )
            .sort( { timestamp: 1 } )
            .toArray();

        const period2Raw = await collection.find( {
            timestamp: {
                $gte: formatDateForQuery( period2.start ),
                $lt: formatDateForQuery( period2.end )
            }
        } )
            .project( this.createProjection( tags ) )
            .sort( { timestamp: 1 } )
            .toArray();

        // Process the raw data as well
        const processedPeriod1Raw = this.processHarmonicsData( period1Raw, payload.DeviceId );
        const processedPeriod2Raw = this.processHarmonicsData( period2Raw, payload.DeviceId );

        // Apply grouping based on resolution
        let finalPeriod1Raw = processedPeriod1Raw;
        let finalPeriod2Raw = processedPeriod2Raw;

        if ( payload.resolution === 'hour' || payload.resolution === '1hour' )
        {
            finalPeriod1Raw = this.groupByHourWithMinMax( processedPeriod1Raw, payload.DeviceId );
            finalPeriod2Raw = this.groupByHourWithMinMax( processedPeriod2Raw, payload.DeviceId );
        }
        else if ( payload.resolution === 'day' || payload.resolution === '1day' )
        {
            finalPeriod1Raw = this.groupByDayWithMinMax( processedPeriod1Raw, payload.DeviceId );
            finalPeriod2Raw = this.groupByDayWithMinMax( processedPeriod2Raw, payload.DeviceId );
        }

        return {
            period1: finalPeriod1Raw,
            period2: finalPeriod2Raw,
            metadata: {
                period1: { start: period1.start.toISOString(), end: period1.end.toISOString() },
                period2: { start: period2.start.toISOString(), end: period2.end.toISOString() },
                devices: payload.DeviceId,
                tags: tags,
                queryTime: new Date().toISOString()
            }
        };
    }

    private createProjection ( tags: string[] ): any
    {
        const projection: any = { timestamp: 1 };
        tags.forEach( tag =>
        {
            projection[ tag ] = 1;
        } );
        return projection;
    }
}