import { Test, TestingModule } from '@nestjs/testing';
import { HarmonicsDetailService } from './harmonics_detail.service';

describe('HarmonicsDetailService', () => {
  let service: HarmonicsDetailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HarmonicsDetailService],
    }).compile();

    service = module.get<HarmonicsDetailService>(HarmonicsDetailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
