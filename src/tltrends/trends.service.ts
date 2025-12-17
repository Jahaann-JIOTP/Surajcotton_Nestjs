// src/trends/trends.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel, raw } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CSNew } from './schemas/CS-new.schema';
import * as moment from 'moment-timezone';


@Injectable()
export class TLTrendsService
{
  constructor (
    @InjectModel( CSNew.name, 'surajcotton' )
    private readonly csNewModel: Model<CSNew>,
  ) { }

  // async getTrendData (
  //   startDate: string,
  //   endDate: string,
  // )
  // {
  //   const startISO = `${ startDate }T06:00:00.000+05:00`;
  //   const nextDay = moment( endDate ).add( 1, 'day' ).format( 'YYYY-MM-DD' );
  //   const endISO = `${ nextDay }T06:00:59.999+05:00`;

  //   const projection = {
  //     timestamp: true,
  //     U23_GW01_Del_ActiveEnergy: true,
  //     U22_GW01_Del_ActiveEnergy: true,
  //     U20_GW03_Del_ActiveEnergy: true,
  //     U19_GW03_Del_ActiveEnergy: true,
  //     U21_PLC_Del_ActiveEnergy: true,
  //     U13_GW01_Del_ActiveEnergy: true,
  //     U13_GW02_Del_ActiveEnergy: true,
  //     U16_GW03_Del_ActiveEnergy: true,
  //     _id: false
  //   };

  //   const rawData = await this.csNewModel
  //     .find(
  //       { timestamp: { $gte: startISO, $lte: endISO } },
  //       projection
  //     )
  //     .lean();

  //   // Cast to any to bypass TypeScript checks
  //   const typedData = rawData as any[];

  //   const processedData = typedData.map( ( document ) =>
  //   {
  //     const Trafo1Incoming = document.U23_GW01_Del_ActiveEnergy || 0;
  //     const Trafo2Incoming = document.U22_GW01_Del_ActiveEnergy || 0;
  //     const Trafo1Outgoing = document.U21_PLC_Del_ActiveEnergy || 0;
  //     const Trafo2Outgoing = document.U13_GW01_Del_ActiveEnergy || 0;

  //     const Trafo3Incoming = document.U20_GW03_Del_ActiveEnergy || 0;
  //     const Trafo4Incoming = document.U19_GW03_Del_ActiveEnergy || 0;
  //     const Trafo3Outgoing = document.U13_GW02_Del_ActiveEnergy || 0;
  //     const Trafo4Outgoing = document.U16_GW03_Del_ActiveEnergy || 0;
      
  //     //Unit 5 Single
  //     const Unit5Trafo3NetLosses = Trafo3Incoming - Trafo3Outgoing;
  //     const Unit5Trafo3NetLossesPercentage = ( Unit5Trafo3NetLosses / Trafo3Incoming ) * 100 

  //     const Unit5Trafo4NetLosses = Trafo4Incoming - Trafo4Outgoing;
  //     const Unit5Trafo4NetLossesPercentage = ( Unit5Trafo4NetLosses / Trafo4Incoming ) * 100 
  //     //Unit 4 Combine
  //     const Unit4CombineTransformerIncoming = Trafo1Incoming + Trafo2Incoming;
  //     const Unit4CombineTransformerOutgoing = Trafo1Outgoing + Trafo2Outgoing;
  //     const Unit4CombineNetLosses = Unit4CombineTransformerIncoming - Unit4CombineTransformerOutgoing
  //     const Unit4CombineNetLossesPercentage = ( Unit4CombineNetLosses / Unit4CombineTransformerIncoming ) * 100

  //     //Unit 5 Combine
  //     const Unit5CombineTransformerIncoming = Trafo3Incoming + Trafo4Incoming;
  //     const Unit5CombineTransformerOutgoing = Trafo3Outgoing + Trafo4Outgoing;
  //     const Unit5CombineNetLosses = Unit5CombineTransformerIncoming - Unit5CombineTransformerOutgoing
  //     const Unit5CombineNetLossesPercentage = ( Unit5CombineNetLosses / Unit5CombineTransformerIncoming ) * 100
  //     return {
  //       timestamp: document.timestamp,
  //       Trafo1Incoming,
  //       Trafo1Outgoing,
  //       Trafo2Incoming,
  //       Trafo2Outgoing,
  //       Unit4CombineTransformerIncoming,
  //       Unit4CombineTransformerOutgoing,
  //       Unit4CombineNetLosses,
  //       Unit4CombineNetLossesPercentage,
  //       Trafo3Incoming,
  //       Trafo3Outgoing,
  //       Unit5Trafo3NetLosses,
  //       Unit5Trafo3NetLossesPercentage,
  //       Trafo4Incoming,
  //       Trafo4Outgoing,
  //       Unit5Trafo4NetLosses,
  //       Unit5Trafo4NetLossesPercentage,
  //       Unit5CombineTransformerIncoming,
  //       Unit5CombineTransformerOutgoing,
  //       Unit5CombineNetLosses,
  //       Unit5CombineNetLossesPercentage
  //     };
  //   } );

  //   return processedData;
  // }
  
  async getU4CombineTrendData (
    startDate: string,
    endDate: string,
  )
  {
    const startISO = `${ startDate }T06:00:00.000+05:00`;
    const nextDay = moment( endDate ).add( 1, 'day' ).format( 'YYYY-MM-DD' );
    const endISO = `${ nextDay }T06:00:59.999+05:00`;

    const projection = {
      timestamp: true,
      U23_GW01_Del_ActiveEnergy: true,
      U22_GW01_Del_ActiveEnergy: true,
      U20_GW03_Del_ActiveEnergy: true,
      U19_GW03_Del_ActiveEnergy: true,
      U21_PLC_Del_ActiveEnergy: true,
      U13_GW01_Del_ActiveEnergy: true,
      U13_GW02_Del_ActiveEnergy: true,
      U16_GW03_Del_ActiveEnergy: true,
      _id: false
    };

    const rawData = await this.csNewModel
      .find(
        { timestamp: { $gte: startISO, $lte: endISO } },
        projection
      )
      .lean();

    // Cast to any to bypass TypeScript checks
    const typedData = rawData as any[];

    const processedData = typedData.map( ( document ) =>
    {
      const Trafo1Incoming = document.U23_GW01_Del_ActiveEnergy || 0;
      const Trafo2Incoming = document.U22_GW01_Del_ActiveEnergy || 0;
      const Trafo1Outgoing = document.U21_PLC_Del_ActiveEnergy || 0;
      const Trafo2Outgoing = document.U13_GW01_Del_ActiveEnergy || 0;

      //Unit 4 Combine
      const Unit4CombineTransformerIncoming = Trafo1Incoming + Trafo2Incoming;
      const Unit4CombineTransformerOutgoing = Trafo1Outgoing + Trafo2Outgoing;
      const Unit4CombineNetLosses = Unit4CombineTransformerIncoming - Unit4CombineTransformerOutgoing
      const Unit4CombineNetLossesPercentage = ( Unit4CombineNetLosses / Unit4CombineTransformerIncoming ) * 100
      return {
        timestamp: document.timestamp,
        Trafo1Incoming,
        Trafo1Outgoing,
        Trafo2Incoming,
        Trafo2Outgoing,
        Unit4CombineTransformerIncoming,
        Unit4CombineTransformerOutgoing,
        Unit4CombineNetLosses,
        Unit4CombineNetLossesPercentage,
      };
    } );

    return processedData;
  }
  async getU5T3TrendData (
    startDate: string,
    endDate: string,
  )
  {
    const startISO = `${ startDate }T06:00:00.000+05:00`;
    const nextDay = moment( endDate ).add( 1, 'day' ).format( 'YYYY-MM-DD' );
    const endISO = `${ nextDay }T06:00:59.999+05:00`;

    const projection = {
      timestamp: true,
      U23_GW01_Del_ActiveEnergy: true,
      U22_GW01_Del_ActiveEnergy: true,
      U20_GW03_Del_ActiveEnergy: true,
      U19_GW03_Del_ActiveEnergy: true,
      U21_PLC_Del_ActiveEnergy: true,
      U13_GW01_Del_ActiveEnergy: true,
      U13_GW02_Del_ActiveEnergy: true,
      U16_GW03_Del_ActiveEnergy: true,
      _id: false
    };

    const rawData = await this.csNewModel
      .find(
        { timestamp: { $gte: startISO, $lte: endISO } },
        projection
      )
      .lean();

    // Cast to any to bypass TypeScript checks
    const typedData = rawData as any[];

    const processedData = typedData.map( ( document ) =>
    {

      const Trafo3Incoming = document.U20_GW03_Del_ActiveEnergy || 0;
      const Trafo3Outgoing = document.U13_GW02_Del_ActiveEnergy || 0;


      //Unit 5 Single
      const Unit5Trafo3NetLosses = Trafo3Incoming - Trafo3Outgoing;
      const Unit5Trafo3NetLossesPercentage = ( Unit5Trafo3NetLosses / Trafo3Incoming ) * 100

      return {
        timestamp: document.timestamp,
        Trafo3Incoming,
        Trafo3Outgoing,
        Unit5Trafo3NetLosses,
        Unit5Trafo3NetLossesPercentage
      };
    } );

    return processedData;
  }
  async getU5T4TrendData (
    startDate: string,
    endDate: string,
  )
  {
    const startISO = `${ startDate }T06:00:00.000+05:00`;
    const nextDay = moment( endDate ).add( 1, 'day' ).format( 'YYYY-MM-DD' );
    const endISO = `${ nextDay }T06:00:59.999+05:00`;

    const projection = {
      timestamp: true,
      U23_GW01_Del_ActiveEnergy: true,
      U22_GW01_Del_ActiveEnergy: true,
      U20_GW03_Del_ActiveEnergy: true,
      U19_GW03_Del_ActiveEnergy: true,
      U21_PLC_Del_ActiveEnergy: true,
      U13_GW01_Del_ActiveEnergy: true,
      U13_GW02_Del_ActiveEnergy: true,
      U16_GW03_Del_ActiveEnergy: true,
      _id: false
    };

    const rawData = await this.csNewModel
      .find(
        { timestamp: { $gte: startISO, $lte: endISO } },
        projection
      )
      .lean();

    // Cast to any to bypass TypeScript checks
    const typedData = rawData as any[];

    const processedData = typedData.map( ( document ) =>
    {
      const Trafo4Incoming = document.U19_GW03_Del_ActiveEnergy || 0;
      const Trafo4Outgoing = document.U16_GW03_Del_ActiveEnergy || 0;

      const Unit5Trafo4NetLosses = Trafo4Incoming - Trafo4Outgoing;
      const Unit5Trafo4NetLossesPercentage = ( Unit5Trafo4NetLosses / Trafo4Incoming ) * 100
      return {
        timestamp: document.timestamp,
        Trafo4Incoming,
        Trafo4Outgoing,
        Unit5Trafo4NetLosses,
        Unit5Trafo4NetLossesPercentage
      };
    } );

    return processedData;
  }
  async getU5CombineTrendData (
    startDate: string,
    endDate: string,
  )
  {
    const startISO = `${ startDate }T06:00:00.000+05:00`;
    const nextDay = moment( endDate ).add( 1, 'day' ).format( 'YYYY-MM-DD' );
    const endISO = `${ nextDay }T06:00:59.999+05:00`;

    const projection = {
      timestamp: true,
      U23_GW01_Del_ActiveEnergy: true,
      U22_GW01_Del_ActiveEnergy: true,
      U20_GW03_Del_ActiveEnergy: true,
      U19_GW03_Del_ActiveEnergy: true,
      U21_PLC_Del_ActiveEnergy: true,
      U13_GW01_Del_ActiveEnergy: true,
      U13_GW02_Del_ActiveEnergy: true,
      U16_GW03_Del_ActiveEnergy: true,
      _id: false
    };

    const rawData = await this.csNewModel
      .find(
        { timestamp: { $gte: startISO, $lte: endISO } },
        projection
      )
      .lean();

    // Cast to any to bypass TypeScript checks
    const typedData = rawData as any[];

    const processedData = typedData.map( ( document ) =>
    {
      const Trafo3Incoming = document.U20_GW03_Del_ActiveEnergy || 0;
      const Trafo4Incoming = document.U19_GW03_Del_ActiveEnergy || 0;
      const Trafo3Outgoing = document.U13_GW02_Del_ActiveEnergy || 0;
      const Trafo4Outgoing = document.U16_GW03_Del_ActiveEnergy || 0;


      //Unit 5 Combine
      const Unit5CombineTransformerIncoming = Trafo3Incoming + Trafo4Incoming;
      const Unit5CombineTransformerOutgoing = Trafo3Outgoing + Trafo4Outgoing;
      const Unit5CombineNetLosses = Unit5CombineTransformerIncoming - Unit5CombineTransformerOutgoing
      const Unit5CombineNetLossesPercentage = ( Unit5CombineNetLosses / Unit5CombineTransformerIncoming ) * 100
      return {
        timestamp: document.timestamp,
        Trafo3Incoming,
        Trafo3Outgoing,
        Trafo4Incoming,
        Trafo4Outgoing,
        Unit5CombineTransformerIncoming,
        Unit5CombineTransformerOutgoing,
        Unit5CombineNetLosses,
        Unit5CombineNetLossesPercentage
      };
    } );

    return processedData;
  }
}
