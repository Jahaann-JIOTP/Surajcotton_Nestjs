import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { MeterService } from 'src/meter/meter.service';
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
        private readonly connection: Connection,
        private readonly meterService: MeterService,
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

        // For daily resolution, fetch 15-minute data and calculate overall statistics
        if ( [ 'day', '1day' ].includes( payload.resolution ) )
        {
            // Adjust end times to include the 06:00 of the next day
            const p1AdjustedEnd = new Date( p1.end.getTime() + 60000 ); // Add 1 minute
            const p2AdjustedEnd = new Date( p2.end.getTime() + 60000 ); // Add 1 minute

            console.log( '\n=== FETCHING HARMONICS DATA ===' );
            console.log( 'Period 1:', { start: p1.start, end: p1AdjustedEnd } );
            console.log( 'Period 2:', { start: p2.start, end: p2AdjustedEnd } );

            const [ raw15min1, raw15min2 ] = await Promise.all( [
                this.fetchHarmonicsData( p1.start, p1AdjustedEnd, tags, '15mins' ),
                this.fetchHarmonicsData( p2.start, p2AdjustedEnd, tags, '15mins' ),
            ] );

            console.log( '\n=== FETCHING ENERGY DATA ===' );
            console.log( 'Period 1:', { start: p1.start, end: p1.end } );
            console.log( 'Period 2:', { start: p2.start, end: p2.end } );

            const [ energyData1, energyData2 ] = await Promise.all( [
                this.getEnergyConsumed( p1.start, new Date( p1.end.getTime() + 60000 ), payload.DeviceId ),
                this.getEnergyConsumed( p2.start, new Date( p2.end.getTime() + 60000 ), payload.DeviceId ),
            ] );

            let d1 = this.processHarmonicsData( raw15min1, payload.DeviceId );
            let d2 = this.processHarmonicsData( raw15min2, payload.DeviceId );

            d1 = this.calculateOverallMinMax( d1, payload.DeviceId );
            d2 = this.calculateOverallMinMax( d2, payload.DeviceId );

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
            console.log( '\n=== FETCHING HARMONICS DATA ===' );
            console.log( 'Period 1:', { start: p1.start, end: p1.end } );
            console.log( 'Period 2:', { start: p2.start, end: p2.end } );

            const [ raw15min1, raw15min2 ] = await Promise.all( [
                this.fetchHarmonicsData( p1.start, p1.end, tags, '15mins' ),
                this.fetchHarmonicsData( p2.start, p2.end, tags, '15mins' ),
            ] );

            console.log( '\n=== FETCHING ENERGY DATA ===' );
            const [ energyData1, energyData2 ] = await Promise.all( [
                this.getEnergyConsumed( p1.start, p1.end, payload.DeviceId ),
                this.getEnergyConsumed( p2.start, p2.end, payload.DeviceId ),
            ] );

            let d1 = this.processHarmonicsData( raw15min1, payload.DeviceId );
            let d2 = this.processHarmonicsData( raw15min2, payload.DeviceId );

            d1 = this.groupByHourWithMinMax( d1, payload.DeviceId );
            d2 = this.groupByHourWithMinMax( d2, payload.DeviceId );

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
        console.log( '\n=== FETCHING HARMONICS DATA ===' );
        console.log( 'Period 1:', { start: p1.start, end: p1.end } );
        console.log( 'Period 2:', { start: p2.start, end: p2.end } );

        const [ raw1, raw2 ] = await Promise.all( [
            this.fetchHarmonicsData( p1.start, p1.end, tags, payload.resolution ),
            this.fetchHarmonicsData( p2.start, p2.end, tags, payload.resolution ),
        ] );

        console.log( '\n=== FETCHING ENERGY DATA ===' );
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

        console.log( '\n=== DATABASE ENERGY QUERY ===' );
        console.log( 'Query parameters:', { start, end, devices } );

        for ( const device of devices )
        {
            const energyTag = `${ device }_Del_ActiveEnergy`;
            const collection = this.connection.collection( 'historical' );

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

            if ( results.length > 0 && results[ 0 ].firstValue !== null && results[ 0 ].lastValue !== null )
            {
                const firstValue = results[ 0 ].firstValue;
                const lastValue = results[ 0 ].lastValue;
                const energyConsumed = lastValue - firstValue;
                energyData[ device ] = energyConsumed;
            } else
            {
                energyData[ device ] = 0;
            }
        }

        console.log( 'Database energy results:', energyData );

        console.log( '\n=== FIELD METER QUERY ===' );
        const start_date = moment( start ).tz( this.TIMEZONE ).format( 'YYYY-MM-DD' );
        const end_date = moment( end ).tz( this.TIMEZONE ).format( 'YYYY-MM-DD' );
        const start_time = moment( start ).tz( this.TIMEZONE ).format( 'HH:mm:ss' );
        const end_time = moment( end ).tz( this.TIMEZONE ).format( 'HH:mm:ss' );

        console.log( 'Meter service parameters:', { start_date, end_date, start_time, end_time } );

        const fmCons = await this.meterService.getMeterWiseConsumption(
            start_date,
            end_date,
            { startTime: start_time, endTime: end_time },
        );

        console.log( 'Field meter results received:', fmCons );

        if ( fmCons && Object.keys( fmCons ).length > 0 )
        {
            const PDB07_U4 = +( Number( fmCons?.U4_U22_GW03_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB1CD1_U5 = +( Number( fmCons?.U5_U1_GW02_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB1CD1_U4 = +( Number( fmCons?.U4_U1_GW02_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB1CD1_Total = Math.max( 0, +( PDB1CD1_U4 + PDB1CD1_U5 ).toFixed( 2 ) );

            const PDB2CD2_U4 = +( Number( fmCons?.U4_U2_GW02_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB2CD2_U5 = +( Number( fmCons?.U5_U2_GW02_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB2CD2_Total = Math.max( 0, +( PDB2CD2_U4 + PDB2CD2_U5 ).toFixed( 2 ) );

            const PDB10_U4 = +( Number( fmCons?.U4_U23_GW03_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB08_U4 = +( Number( fmCons?.U4_U4_GW02_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB08_U5 = +( Number( fmCons?.U5_U4_GW02_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB08_Total = Math.max( 0, +( PDB08_U4 + PDB08_U5 ).toFixed( 2 ) );

            const CardPDB1_U5 = +( Number( fmCons?.U5_U3_GW02_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const CardPDB1_U4 = +( Number( fmCons?.U4_U3_GW02_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const CardPDB1_sum = Math.max( 0, +( CardPDB1_U5 + CardPDB1_U4 ).toFixed( 2 ) );

            const PDB07_U5 = +( Number( fmCons?.U5_U22_GW03_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB07_sum = Math.max( 0, +( PDB07_U5 + PDB07_U4 ).toFixed( 2 ) );

            const PDB10_U5 = +( Number( fmCons?.U5_U23_GW03_Del_ActiveEnergy ?? 0 ).toFixed( 2 ) );
            const PDB10_sum = Math.max( 0, +( PDB10_U4 + PDB10_U5 ).toFixed( 2 ) );

            console.log( '\n=== APPLYING FIELD METER ADJUSTMENTS ===' );
            console.log( 'Field meter values:', {
                PDB1CD1_Total,
                PDB2CD2_Total,
                PDB08_Total,
                CardPDB1_sum,
                PDB07_sum,
                PDB10_sum,
                PDB10_U4
            } );

            for ( const device of devices )
            {
                const databaseValue = energyData[ device ];
                let finalValue = databaseValue;

                if ( device === 'U12_PLC' )
                {
                    finalValue = Math.max( 0, +( finalValue - PDB07_U4 ).toFixed( 2 ) );
                }
                if ( device === 'U5_GW01' )
                {
                    finalValue = PDB1CD1_Total;
                } else if ( device === 'U9_GW01' )
                {
                    finalValue = PDB2CD2_Total;
                } else if ( device === 'U15_GW01' )
                {
                    finalValue = Math.max( 0, +( databaseValue - PDB10_U4 ).toFixed( 2 ) );
                } else if ( device === 'U14_GW02' )
                {
                    finalValue = PDB08_Total;
                } else if ( device === 'U17_GW02' )
                {
                    finalValue = CardPDB1_sum;
                } else if ( device === 'U18_GW02' )
                {
                    finalValue = PDB07_sum;
                } else if ( device === 'U10_GW03' )
                {
                    finalValue = PDB10_sum;
                }

                energyData[ device ] = finalValue;
            }
        }

        console.log( 'Final energy consumption:', energyData );
        return energyData;
    }

    private addEnergyConsumedToResults ( data: any[], energyData: Record<string, number> ): any[]
    {
        console.log( '\n=== ADDING ENERGY TO RESULTS ===' );
        console.log( 'Energy data:', energyData );

        return data.map( ( row ) =>
        {
            Object.keys( energyData ).forEach( device =>
            {
                const energyKey = `${ device }_Total_Energy_Consumed`;
                row[ energyKey ] = +energyData[ device ].toFixed( 3 );
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

        console.log( '\n=== CALCULATING OVERALL MIN/MAX ===' );
        console.log( 'Input data count:', data.length );

        const overallStats: Record<string, {
            vValues: Array<{ value: number, timestamp: string }>;
            iValues: Array<{ value: number, timestamp: string }>;
        }> = {};

        devices.forEach( dev =>
        {
            overallStats[ dev ] = {
                vValues: [],
                iValues: []
            };
        } );

        data.forEach( ( row ) =>
        {
            devices.forEach( dev =>
            {
                const vKey = `${ dev }_Harmonics_V_THD`;
                const iKey = `${ dev }_Harmonics_I_THD`;

                const vValue = row[ vKey ];
                const iValue = row[ iKey ];

                if ( typeof vValue === 'number' && vValue !== 0 && !isNaN( vValue ) )
                {
                    overallStats[ dev ].vValues.push( {
                        value: vValue,
                        timestamp: row.timestamp
                    } );
                }

                if ( typeof iValue === 'number' && iValue !== 0 && !isNaN( iValue ) )
                {
                    overallStats[ dev ].iValues.push( {
                        value: iValue,
                        timestamp: row.timestamp
                    } );
                }
            } );
        } );

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

        devices.forEach( dev =>
        {
            const vKey = `${ dev }_Harmonics_V_THD`;
            const iKey = `${ dev }_Harmonics_I_THD`;

            const vValues = overallStats[ dev ].vValues;
            const iValues = overallStats[ dev ].iValues;

            if ( vValues.length > 0 )
            {
                const vAvg = vValues.reduce( ( sum, item ) => sum + item.value, 0 ) / vValues.length;
                overallSummary[ vKey ] = +vAvg.toFixed( 2 );

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
            } else
            {
                overallSummary[ vKey ] = 0;
                overallSummary[ `${ vKey }_min` ] = 0;
                overallSummary[ `${ vKey }_max` ] = 0;
                overallSummary[ `${ vKey }_minTime` ] = null;
                overallSummary[ `${ vKey }_maxTime` ] = null;
            }

            if ( iValues.length > 0 )
            {
                const iAvg = iValues.reduce( ( sum, item ) => sum + item.value, 0 ) / iValues.length;
                overallSummary[ iKey ] = +iAvg.toFixed( 2 );

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
            } else
            {
                overallSummary[ iKey ] = 0;
                overallSummary[ `${ iKey }_min` ] = 0;
                overallSummary[ `${ iKey }_max` ] = 0;
                overallSummary[ `${ iKey }_minTime` ] = null;
                overallSummary[ `${ iKey }_maxTime` ] = null;
            }
        } );

        console.log( 'Overall summary calculated' );
        return [ overallSummary ];
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

        console.log( '\n=== DATABASE QUERY ===' );
        console.log( 'Query parameters:', { start, end, resolution, tagsCount: tags.length } );

        if ( [ 'day', '1day' ].includes( resolution ) )
        {
            const adjustedEnd = new Date( end.getTime() + 1000 );

            const data = await collection
                .aggregate( [
                    { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
                    { $match: { ts: { $gte: start, $lte: adjustedEnd } } },
                    { $project: { timestamp: 1, ...this.roundFields( tags ) } },
                    { $sort: { timestamp: 1 } },
                ] )
                .toArray();

            console.log( 'Database response:', {
                count: data.length,
                firstTimestamp: data[ 0 ]?.timestamp,
                lastTimestamp: data[ data.length - 1 ]?.timestamp
            } );
            return data;
        }

        const { unit, binSize } = this.getBucketConfig( resolution );
        let adjustedEnd = end;
        if ( [ '15mins', '30mins', 'hour', '1hour' ].includes( resolution ) )
        {
            adjustedEnd = new Date( end.getTime() + 60000 );
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

        console.log( 'Database response:', {
            count: data.length,
            firstTimestamp: data[ 0 ]?.timestamp,
            lastTimestamp: data[ data.length - 1 ]?.timestamp
        } );
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

    private avgFieldsExcludingZero ( tags: string[] )
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
                        else: null
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
        console.log( '\n=== PROCESSING HARMONICS DATA ===' );
        console.log( 'Input data count:', data.length );

        const result = data.map( ( d ) =>
        {
            const out: any = { timestamp: d.timestamp };

            devices.forEach( ( dev ) =>
            {
                const v = [ 'V1', 'V2', 'V3' ]
                    .map( ( x ) => d[ `${ dev }_Harmonics_${ x }_THD` ] )
                    .filter( ( v ) => typeof v === 'number' && v !== 0 && !isNaN( v ) );

                const i = [ 'I1', 'I2', 'I3' ]
                    .map( ( x ) => d[ `${ dev }_Harmonics_${ x }_THD` ] )
                    .filter( ( v ) => typeof v === 'number' && v !== 0 && !isNaN( v ) );

                out[ `${ dev }_Harmonics_V_THD` ] = v.length > 0
                    ? +( v.reduce( ( a, b ) => a + b, 0 ) / v.length ).toFixed( 2 )
                    : 0;

                out[ `${ dev }_Harmonics_I_THD` ] = i.length > 0
                    ? +( i.reduce( ( a, b ) => a + b, 0 ) / i.length ).toFixed( 2 )
                    : 0;
            } );

            return out;
        } );

        console.log( 'Processed data count:', result.length );
        return result;
    }

    /* ===================== 15 / 30 MIN MIN–MAX ===================== */

    private attachMinMaxSamePoint ( data: any[], devices: string[] ): any[]
    {
        console.log( '\n=== ATTACHING MIN/MAX ===' );
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
        console.log( '\n=== GROUPING BY HOUR ===' );
        console.log( 'Input data count:', data.length );

        const hourMap = new Map<string, {
            hourStart: moment.Moment;
            hourEnd: moment.Moment;
            intervals: any[];
            deviceStats: Map<string, {
                vValues: Array<{ value: number, timestamp: string, localTime: string }>;
                iValues: Array<{ value: number, timestamp: string, localTime: string }>;
            }>;
        }>();

        data.forEach( ( row ) =>
        {
            const timestampStr = row.timestamp;
            let rowTime: moment.Moment;
            if ( timestampStr.includes( '+' ) && timestampStr.length > 19 )
            {
                rowTime = moment.parseZone( timestampStr );
            } else
            {
                rowTime = moment.tz( timestampStr, this.TIMEZONE );
            }

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

                if ( typeof vValue === 'number' && vValue !== 0 && !isNaN( vValue ) )
                {
                    deviceStats.vValues.push( {
                        value: vValue,
                        timestamp: row.timestamp,
                        localTime: localTimeStr
                    } );
                }

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

        const result: any[] = [];
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

                if ( stats.vValues.length > 0 )
                {
                    const vAvg = stats.vValues.reduce( ( sum, item ) => sum + item.value, 0 ) / stats.vValues.length;
                    hourlySummary[ vKey ] = +vAvg.toFixed( 2 );

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
                } else
                {
                    hourlySummary[ vKey ] = 0;
                    hourlySummary[ `${ vKey }_min` ] = 0;
                    hourlySummary[ `${ vKey }_max` ] = 0;
                    hourlySummary[ `${ vKey }_minTime` ] = null;
                    hourlySummary[ `${ vKey }_maxTime` ] = null;
                }

                if ( stats.iValues.length > 0 )
                {
                    const iAvg = stats.iValues.reduce( ( sum, item ) => sum + item.value, 0 ) / stats.iValues.length;
                    hourlySummary[ iKey ] = +iAvg.toFixed( 2 );

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
                } else
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

        console.log( 'Hourly groups created:', result.length );
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