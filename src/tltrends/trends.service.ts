// src/trends/trends.service.ts

import { Injectable } from '@nestjs/common';
import { InjectModel, raw } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CSNew } from './schemas/CS-new.schema';
import * as moment from 'moment-timezone';


@Injectable()
export class TLTrendsService {
  constructor(
    @InjectModel(CSNew.name, 'surajcotton')
    private readonly csNewModel: Model<CSNew>,
  ) { }

  // async getTrendData (
  //   startDate: string,
  //   endDate: string,
  // )
  // {
  //   const startISO = `${ startDate }T06:00:00+05:00`;
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

  async getU4CombineTrendData(
    startDate: string,
    endDate: string,
  ) {
    const startISO = `${startDate}T06:00:00+05:00`;
    const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');
    const endISO = `${nextDay}T06:00:59.999+05:00`;

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
      .sort({ timestamp: 1 }) // IMPORTANT: Sort by timestamp
      .lean();

    // Cast to any to bypass TypeScript checks
    const typedData = rawData as any[];

    const processedData = typedData.map((document, index) => {
      // Get current values
      const currentTrafo1Incoming = document.U23_GW01_Del_ActiveEnergy || 0;
      const currentTrafo2Incoming = document.U22_GW01_Del_ActiveEnergy || 0;
      const currentTrafo1Outgoing = document.U21_PLC_Del_ActiveEnergy || 0;
      const currentTrafo2Outgoing = document.U13_GW01_Del_ActiveEnergy || 0;

      // Get previous values (for first record, previous = current)
      let previousTrafo1Incoming = currentTrafo1Incoming;
      let previousTrafo2Incoming = currentTrafo2Incoming;
      let previousTrafo1Outgoing = currentTrafo1Outgoing;
      let previousTrafo2Outgoing = currentTrafo2Outgoing;

      if (index > 0) {
        const prevDoc = typedData[index - 1];
        previousTrafo1Incoming = prevDoc.U23_GW01_Del_ActiveEnergy || 0;
        previousTrafo2Incoming = prevDoc.U22_GW01_Del_ActiveEnergy || 0;
        previousTrafo1Outgoing = prevDoc.U21_PLC_Del_ActiveEnergy || 0;
        previousTrafo2Outgoing = prevDoc.U13_GW01_Del_ActiveEnergy || 0;
      }

      // Calculate consumption (difference between current and previous)
      const Trafo1IncomingConsumption = Math.max(0, currentTrafo1Incoming - previousTrafo1Incoming);
      const Trafo2IncomingConsumption = Math.max(0, currentTrafo2Incoming - previousTrafo2Incoming);
      const Trafo1OutgoingConsumption = Math.max(0, currentTrafo1Outgoing - previousTrafo1Outgoing);
      const Trafo2OutgoingConsumption = Math.max(0, currentTrafo2Outgoing - previousTrafo2Outgoing);

      // Calculate total incoming and outgoing consumption for this interval
      const Unit4CombineIncomingConsumption = Trafo1IncomingConsumption + Trafo2IncomingConsumption;
      const Unit4CombineOutgoingConsumption = Trafo1OutgoingConsumption + Trafo2OutgoingConsumption;

      // Calculate net losses for this interval
      const Unit4CombineNetLosses = Unit4CombineIncomingConsumption - Unit4CombineOutgoingConsumption;

      // Calculate percentage (handle division by zero)
      let Unit4CombineNetLossesPercentage = 0;
      if (Unit4CombineIncomingConsumption > 0) {
        Unit4CombineNetLossesPercentage = (Unit4CombineNetLosses / Unit4CombineIncomingConsumption) * 100;
      }

      return {
        timestamp: document.timestamp,

        // Raw meter values (cumulative)
        Trafo1IncomingRaw: currentTrafo1Incoming,
        Trafo2IncomingRaw: currentTrafo2Incoming,
        Trafo1OutgoingRaw: currentTrafo1Outgoing,
        Trafo2OutgoingRaw: currentTrafo2Outgoing,

        // Previous meter values (for reference)
        PreviousTrafo1Incoming: previousTrafo1Incoming,
        PreviousTrafo2Incoming: previousTrafo2Incoming,
        PreviousTrafo1Outgoing: previousTrafo1Outgoing,
        PreviousTrafo2Outgoing: previousTrafo2Outgoing,

        // Consumption values (kWh used in this 15-min interval)
        Trafo1IncomingConsumption,
        Trafo2IncomingConsumption,
        Trafo1OutgoingConsumption,
        Trafo2OutgoingConsumption,

        // Combined calculations
        Unit4CombineIncomingConsumption,
        Unit4CombineOutgoingConsumption,
        Unit4CombineNetLosses,
        Unit4CombineNetLossesPercentage,
      };
    });

    return processedData;
  }
  async getU5T3TrendData(
    startDate: string,
    endDate: string,
  ) {
    const startISO = `${startDate}T06:00:00+05:00`;
    const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');
    const endISO = `${nextDay}T06:00:59.999+05:00`;

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
      .sort({ timestamp: 1 }) // IMPORTANT: Sort by timestamp
      .lean();

    // Cast to any to bypass TypeScript checks
    const typedData = rawData as any[];

    const processedData = typedData.map((document, index) => {
      // Get current values
      const currentTrafo3Incoming = document.U20_GW03_Del_ActiveEnergy || 0;
      const currentTrafo3Outgoing = document.U13_GW02_Del_ActiveEnergy || 0;

      // Get previous values (for first record, previous = current)
      let previousTrafo3Incoming = currentTrafo3Incoming;
      let previousTrafo3Outgoing = currentTrafo3Outgoing;

      if (index > 0) {
        const prevDoc = typedData[index - 1];
        previousTrafo3Incoming = prevDoc.U20_GW03_Del_ActiveEnergy || 0;
        previousTrafo3Outgoing = prevDoc.U13_GW02_Del_ActiveEnergy || 0;
      }

      // Calculate consumption (difference between current and previous)
      const Trafo3IncomingConsumption = Math.max(0, currentTrafo3Incoming - previousTrafo3Incoming);
      const Trafo3OutgoingConsumption = Math.max(0, currentTrafo3Outgoing - previousTrafo3Outgoing);

      //Unit 5 Trafo 3 calculations
      const Unit5Trafo3NetLosses = Trafo3IncomingConsumption - Trafo3OutgoingConsumption;

      // Calculate percentage (handle division by zero)
      let Unit5Trafo3NetLossesPercentage = 0;
      if (Trafo3IncomingConsumption > 0) {
        Unit5Trafo3NetLossesPercentage = (Unit5Trafo3NetLosses / Trafo3IncomingConsumption) * 100;
      }

      return {
        timestamp: document.timestamp,

        // Raw meter values (cumulative)
        Trafo3IncomingRaw: currentTrafo3Incoming,
        Trafo3OutgoingRaw: currentTrafo3Outgoing,

        // Previous meter values (for reference)
        PreviousTrafo3Incoming: previousTrafo3Incoming,
        PreviousTrafo3Outgoing: previousTrafo3Outgoing,

        // Consumption values (kWh used in this 15-min interval)
        Trafo3IncomingConsumption,
        Trafo3OutgoingConsumption,

        // Net losses for this interval
        Unit5Trafo3NetLosses,
        Unit5Trafo3NetLossesPercentage,
      };
    });

    return processedData;
  }
  async getU5T4TrendData(
    startDate: string,
    endDate: string,
  ) {
    const startISO = `${startDate}T06:00:00+05:00`;
    const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');
    const endISO = `${nextDay}T06:00:59.999+05:00`;

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
      .sort({ timestamp: 1 }) // IMPORTANT: Sort by timestamp
      .lean();

    // Cast to any to bypass TypeScript checks
    const typedData = rawData as any[];

    const processedData = typedData.map((document, index) => {
      // Get current values
      const currentTrafo4Incoming = document.U19_GW03_Del_ActiveEnergy || 0;
      const currentTrafo4Outgoing = document.U16_GW03_Del_ActiveEnergy || 0;

      // Get previous values (for first record, previous = current)
      let previousTrafo4Incoming = currentTrafo4Incoming;
      let previousTrafo4Outgoing = currentTrafo4Outgoing;

      if (index > 0) {
        const prevDoc = typedData[index - 1];
        previousTrafo4Incoming = prevDoc.U19_GW03_Del_ActiveEnergy || 0;
        previousTrafo4Outgoing = prevDoc.U16_GW03_Del_ActiveEnergy || 0;
      }

      // Calculate consumption (difference between current and previous)
      const Trafo4IncomingConsumption = Math.max(0, currentTrafo4Incoming - previousTrafo4Incoming);
      const Trafo4OutgoingConsumption = Math.max(0, currentTrafo4Outgoing - previousTrafo4Outgoing);

      // Unit 5 Trafo 4 calculations
      const Unit5Trafo4NetLosses = Trafo4IncomingConsumption - Trafo4OutgoingConsumption;

      // Calculate percentage (handle division by zero)
      let Unit5Trafo4NetLossesPercentage = 0;
      if (Trafo4IncomingConsumption > 0) {
        Unit5Trafo4NetLossesPercentage = (Unit5Trafo4NetLosses / Trafo4IncomingConsumption) * 100;
      }

      return {
        timestamp: document.timestamp,

        // Raw meter values (cumulative)
        Trafo4IncomingRaw: currentTrafo4Incoming,
        Trafo4OutgoingRaw: currentTrafo4Outgoing,

        // Previous meter values (for reference)
        PreviousTrafo4Incoming: previousTrafo4Incoming,
        PreviousTrafo4Outgoing: previousTrafo4Outgoing,

        // Consumption values (kWh used in this 15-min interval)
        Trafo4IncomingConsumption,
        Trafo4OutgoingConsumption,

        // Net losses for this interval
        Unit5Trafo4NetLosses,
        Unit5Trafo4NetLossesPercentage,
      };
    });

    return processedData;
  }
  async getU5CombineTrendData(
    startDate: string,
    endDate: string,
  ) {
    const startISO = `${startDate}T06:00:00+05:00`;
    const nextDay = moment(endDate).add(1, 'day').format('YYYY-MM-DD');
    const endISO = `${nextDay}T06:00:59.999+05:00`;

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
      .sort({ timestamp: 1 }) // IMPORTANT: Sort by timestamp
      .lean();

    // Cast to any to bypass TypeScript checks
    const typedData = rawData as any[];

    const processedData = typedData.map((document, index) => {
      // Get current values
      const currentTrafo3Incoming = document.U20_GW03_Del_ActiveEnergy || 0;
      const currentTrafo4Incoming = document.U19_GW03_Del_ActiveEnergy || 0;
      const currentTrafo3Outgoing = document.U13_GW02_Del_ActiveEnergy || 0;
      const currentTrafo4Outgoing = document.U16_GW03_Del_ActiveEnergy || 0;

      // Get previous values (for first record, previous = current)
      let previousTrafo3Incoming = currentTrafo3Incoming;
      let previousTrafo4Incoming = currentTrafo4Incoming;
      let previousTrafo3Outgoing = currentTrafo3Outgoing;
      let previousTrafo4Outgoing = currentTrafo4Outgoing;

      if (index > 0) {
        const prevDoc = typedData[index - 1];
        previousTrafo3Incoming = prevDoc.U20_GW03_Del_ActiveEnergy || 0;
        previousTrafo4Incoming = prevDoc.U19_GW03_Del_ActiveEnergy || 0;
        previousTrafo3Outgoing = prevDoc.U13_GW02_Del_ActiveEnergy || 0;
        previousTrafo4Outgoing = prevDoc.U16_GW03_Del_ActiveEnergy || 0;
      }

      // Calculate consumption (difference between current and previous)
      const Trafo3IncomingConsumption = Math.max(0, currentTrafo3Incoming - previousTrafo3Incoming);
      const Trafo4IncomingConsumption = Math.max(0, currentTrafo4Incoming - previousTrafo4Incoming);
      const Trafo3OutgoingConsumption = Math.max(0, currentTrafo3Outgoing - previousTrafo3Outgoing);
      const Trafo4OutgoingConsumption = Math.max(0, currentTrafo4Outgoing - previousTrafo4Outgoing);

      // Unit 5 Combine calculations (using consumption values)
      const Unit5CombineIncomingConsumption = Trafo3IncomingConsumption + Trafo4IncomingConsumption;
      const Unit5CombineOutgoingConsumption = Trafo3OutgoingConsumption + Trafo4OutgoingConsumption;
      const Unit5CombineNetLosses = Unit5CombineIncomingConsumption - Unit5CombineOutgoingConsumption;

      // Calculate percentage (handle division by zero)
      let Unit5CombineNetLossesPercentage = 0;
      if (Unit5CombineIncomingConsumption > 0) {
        Unit5CombineNetLossesPercentage = (Unit5CombineNetLosses / Unit5CombineIncomingConsumption) * 100;
      }

      return {
        timestamp: document.timestamp,

        // Raw meter values (cumulative)
        Trafo3IncomingRaw: currentTrafo3Incoming,
        Trafo4IncomingRaw: currentTrafo4Incoming,
        Trafo3OutgoingRaw: currentTrafo3Outgoing,
        Trafo4OutgoingRaw: currentTrafo4Outgoing,

        // Previous meter values (for reference)
        PreviousTrafo3Incoming: previousTrafo3Incoming,
        PreviousTrafo4Incoming: previousTrafo4Incoming,
        PreviousTrafo3Outgoing: previousTrafo3Outgoing,
        PreviousTrafo4Outgoing: previousTrafo4Outgoing,

        // Consumption values (kWh used in this 15-min interval)
        Trafo3IncomingConsumption,
        Trafo4IncomingConsumption,
        Trafo3OutgoingConsumption,
        Trafo4OutgoingConsumption,

        // Combined calculations for Unit 5
        Unit5CombineIncomingConsumption,
        Unit5CombineOutgoingConsumption,
        Unit5CombineNetLosses,
        Unit5CombineNetLossesPercentage,
      };
    });
    return processedData;
  }
}
