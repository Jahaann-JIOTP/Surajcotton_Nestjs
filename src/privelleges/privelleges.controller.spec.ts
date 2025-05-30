import { Test, TestingModule } from '@nestjs/testing';
import { PrivellegesController } from './privelleges.controller';

describe('PrivellegesController', () => {
  let controller: PrivellegesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrivellegesController],
    }).compile();

    controller = module.get<PrivellegesController>(PrivellegesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
