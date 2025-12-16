import { Body, Controller, Post } from '@nestjs/common';
import { HarmonicsDetailService } from './harmonics_detail.service';
@Controller('harmonics-detail')
export class HarmonicsDetailController
{
     constructor ( private readonly harmonicsDetailService: HarmonicsDetailService ) { }
     @Post( 'report' )
        async getHarmonics ( @Body() body: any )
        {
            // Call the new service method
            return this.harmonicsDetailService.getHarmonicsDetailFromPayload( body );
        }
}
