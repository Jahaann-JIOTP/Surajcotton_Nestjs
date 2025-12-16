import { Test, TestingModule } from '@nestjs/testing';
import { HarmonicsDetailController } from './harmonics_detail.controller';

describe('HarmonicsDetailController', () => {
  let controller: HarmonicsDetailController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HarmonicsDetailController],
    }).compile();

    controller = module.get<HarmonicsDetailController>(HarmonicsDetailController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
