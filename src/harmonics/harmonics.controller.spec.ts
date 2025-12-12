import { Test, TestingModule } from '@nestjs/testing';
import { HarmonicsController } from './harmonics.controller';

describe('HarmonicsController', () => {
  let controller: HarmonicsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HarmonicsController],
    }).compile();

    controller = module.get<HarmonicsController>(HarmonicsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
