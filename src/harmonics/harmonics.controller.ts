// harmonics.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { HarmonicsService } from './harmonics.service';

@Controller( 'harmonics' )
export class HarmonicsController
{
    constructor ( private readonly harmonicsService: HarmonicsService ) { }

    @Post( 'report' )
    async getHarmonics ( @Body() body: any )
    {
        // Call the new service method
        return this.harmonicsService.getRawHarmonicsData( body );
    }
}
