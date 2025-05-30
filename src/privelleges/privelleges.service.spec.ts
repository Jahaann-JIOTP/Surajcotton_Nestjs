import { Test, TestingModule } from '@nestjs/testing';
import { PrivellegesService } from './privelleges.service';

describe('PrivellegesService', () => {
  let service: PrivellegesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrivellegesService],
    }).compile();

    service = module.get<PrivellegesService>(PrivellegesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
