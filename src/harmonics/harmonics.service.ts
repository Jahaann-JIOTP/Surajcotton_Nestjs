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

        if ( [ 'hour', '1hour' ].includes( payload.resolution ) )
        {
            d1 = this.groupByHourWithMinMax( d1, payload.DeviceId );
            d2 = this.groupByHourWithMinMax( d2, payload.DeviceId );
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
            return collection.aggregate( [
                { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
                { $match: { ts: { $gte: start, $lt: end } } },
                { $project: { timestamp: 1, ...this.roundFields( tags ) } },
                { $sort: { timestamp: 1 } }
            ] ).toArray();
        }

        const { unit, binSize } = this.getBucketConfig( resolution );

        return collection.aggregate( [
            { $addFields: { ts: { $dateFromString: { dateString: '$timestamp' } } } },
            { $match: { ts: { $gte: start, $lt: end } } },
            { $addFields: { tsShifted: { $add: [ '$ts', 1000 * 60 * 60 * 6 ] } } },
            {
                $group: {
                    _id: {
                        bucket: {
                            $dateTrunc: {
                                date: '$tsShifted',
                                unit,
                                binSize,
                                timezone: this.TIMEZONE
                            }
                        }
                    },
                    ...this.avgFields( tags )
                }
            },
            {
                $project: {
                    _id: 0,
                    timestamp: {
                        $dateToString: {
                            date: { $subtract: [ '$_id.bucket', 1000 * 60 * 60 * 6 ] },
                            format: '%Y-%m-%dT%H:%M:%S',
                            timezone: this.TIMEZONE
                        }
                    },
                    ...this.roundFields( tags )
                }
            },
            { $sort: { timestamp: 1 } }
        ] ).toArray();
    }

    /* ===================== HELPERS ===================== */

    private getBucketConfig ( res: string ): { unit: any; binSize: number }
    {
        switch ( res )
        {
            case '15mins': return { unit: 'minute', binSize: 15 };
            case '30mins': return { unit: 'minute', binSize: 30 };
            case 'hour':
            case '1hour': return { unit: 'hour', binSize: 1 };
            case 'day':
            case '1day': return { unit: 'day', binSize: 1 };
            default: return { unit: 'hour', binSize: 1 };
        }
    }

    private avgFields ( tags: string[] )
    {
        return Object.fromEntries( tags.map( t => [ t, { $avg: `$${ t }` } ] ) );
    }

    private roundFields ( tags: string[] )
    {
        return Object.fromEntries( tags.map( t => [ t, { $round: [ `$${ t }`, 2 ] } ] ) );
    }

    /* ===================== POST PROCESS ===================== */

    private processHarmonicsData ( data: any[], devices: string[] ): any[]
    {
        return data.map( d =>
        {
            const out: any = { timestamp: d.timestamp };

            devices.forEach( dev =>
            {
                const v = [ 'V1', 'V2', 'V3' ]
                    .map( x => d[ `${ dev }_Harmonics_${ x }_THD` ] )
                    .filter( v => typeof v === 'number' );

                const i = [ 'I1', 'I2', 'I3' ]
                    .map( x => d[ `${ dev }_Harmonics_${ x }_THD` ] )
                    .filter( v => typeof v === 'number' );

                out[ `${ dev }_Harmonics_V_THD` ] = v.length ? +( v.reduce( ( a, b ) => a + b, 0 ) / v.length ).toFixed( 2 ) : 0;
                out[ `${ dev }_Harmonics_I_THD` ] = i.length ? +( i.reduce( ( a, b ) => a + b, 0 ) / i.length ).toFixed( 2 ) : 0;
            } );

            return out;
        } );
    }

    /* ===================== 15 / 30 MIN MIN–MAX ===================== */

    private attachMinMaxSamePoint ( data: any[], devices: string[] ): any[]
    {
        return data.map( row =>
        {
            devices.forEach( dev =>
            {
                [ 'V', 'I' ].forEach( type =>
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
        const map: Record<string, any[]> = {};

        data.forEach( d =>
        {
            const t = moment.tz( d.timestamp, this.TIMEZONE ).startOf( 'hour' );
            const key = t.format( 'YYYY-MM-DD HH:00:00' );
            map[ key ] ??= [];
            map[ key ].push( d );
        } );

        return Object.entries( map ).map( ( [ hour, rows ] ) =>
        {
            const start = moment.tz( hour, 'YYYY-MM-DD HH:mm:ss', this.TIMEZONE );

            const out: any = {
                timestamp: start.format(),
                intervalStart: start.format( 'YYYY-MM-DD HH:mm:ss' ),
                intervalEnd: start.clone().add( 1, 'hour' ).format( 'YYYY-MM-DD HH:mm:ss' )
            };

            devices.forEach( dev =>
            {
                [ 'V', 'I' ].forEach( type =>
                {
                    const k = `${ dev }_Harmonics_${ type }_THD`;
                    const pts = rows.map( r => ( { v: r[ k ], t: r.timestamp } ) ).filter( p => typeof p.v === 'number' );

                    if ( !pts.length )
                    {
                        out[ k ] = out[ `${ k }_min` ] = out[ `${ k }_max` ] = 0;
                        out[ `${ k }_minTime` ] = out[ `${ k }_maxTime` ] = null;
                        return;
                    }

                    const min = pts.reduce( ( a, b ) => b.v < a.v ? b : a );
                    const max = pts.reduce( ( a, b ) => b.v > a.v ? b : a );

                    out[ k ] = +( pts.reduce( ( s, p ) => s + p.v, 0 ) / pts.length ).toFixed( 2 );
                    out[ `${ k }_min` ] = +min.v.toFixed( 2 );
                    out[ `${ k }_minTime` ] = min.t;
                    out[ `${ k }_max` ] = +max.v.toFixed( 2 );
                    out[ `${ k }_maxTime` ] = max.t;
                } );
            } );

            return out;
        } );
    }

    /* ===================== DAY MIN / MAX (6AM) ===================== */

    private groupByDayWithMinMax ( data: any[], devices: string[] ): any[]
    {
        const map: Record<string, any[]> = {};

        data.forEach( d =>
        {
            const t = moment.tz( d.timestamp, this.TIMEZONE );
            const day = t.hour() < 6 ? t.clone().subtract( 1, 'day' ) : t.clone();
            const key = day.format( 'YYYY-MM-DD' );
            map[ key ] ??= [];
            map[ key ].push( d );
        } );

        return Object.entries( map ).map( ( [ day, rows ] ) =>
        {
            const start = moment.tz( `${ day } 06:00:00`, this.TIMEZONE );

            const out: any = {
                timestamp: start.format(),
                intervalStart: start.format( 'YYYY-MM-DD HH:mm:ss' ),
                intervalEnd: start.clone().add( 24, 'hour' ).format( 'YYYY-MM-DD HH:mm:ss' ),
                displayDate: day
            };

            devices.forEach( dev =>
            {
                [ 'V', 'I' ].forEach( type =>
                {
                    const k = `${ dev }_Harmonics_${ type }_THD`;
                    const pts = rows.map( r => ( { v: r[ k ], t: r.timestamp } ) ).filter( p => typeof p.v === 'number' );

                    if ( !pts.length )
                    {
                        out[ k ] = out[ `${ k }_min` ] = out[ `${ k }_max` ] = 0;
                        out[ `${ k }_minTime` ] = out[ `${ k }_maxTime` ] = null;
                        return;
                    }

                    const min = pts.reduce( ( a, b ) => b.v < a.v ? b : a );
                    const max = pts.reduce( ( a, b ) => b.v > a.v ? b : a );

                    out[ k ] = +( pts.reduce( ( s, p ) => s + p.v, 0 ) / pts.length ).toFixed( 2 );
                    out[ `${ k }_min` ] = +min.v.toFixed( 2 );
                    out[ `${ k }_minTime` ] = min.t;
                    out[ `${ k }_max` ] = +max.v.toFixed( 2 );
                    out[ `${ k }_maxTime` ] = max.t;
                } );
            } );

            return out;
        } );
    }

    /* ===================== VALIDATION ===================== */

    private validatePayload ( payload: HarmonicsPayload ): void
    {
        if ( !payload.DeviceId?.length )
            throw new BadRequestException( 'DeviceId required' );
        if ( !payload.resolution )
            throw new BadRequestException( 'Resolution required' );
    }

    private parsePeriod ( sd: string, st: string, ed: string, et: string )
    {
        const start = moment.tz( `${ sd } ${ st }`, 'YYYY-MM-DD HH:mm:ss', this.TIMEZONE );
        const end = moment.tz( `${ ed } ${ et }`, 'YYYY-MM-DD HH:mm:ss', this.TIMEZONE );
        if ( !start.isValid() || !end.isValid() )
            throw new BadRequestException( 'Invalid period' );
        return { start: start.toDate(), end: end.toDate() };
    }

    private generateTags ( deviceIds: string[] ): string[]
    {
        const types = [
            'Harmonics_V1_THD',
            'Harmonics_V2_THD',
            'Harmonics_V3_THD',
            'Harmonics_I1_THD',
            'Harmonics_I2_THD',
            'Harmonics_I3_THD',
        ];
        return deviceIds.flatMap( id => types.map( t => `${ id }_${ t }` ) );
    }
}
