import { Test, TestingModule } from '@nestjs/testing';
import { HarmonicsService } from './harmonics.service';

describe('HarmonicsService', () => {
  let service: HarmonicsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HarmonicsService],
    }).compile();

    service = module.get<HarmonicsService>(HarmonicsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
