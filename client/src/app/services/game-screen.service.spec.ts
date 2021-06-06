import { TestBed } from '@angular/core/testing';

import { GameScreenService } from './game-screen.service';

describe('GameScreenService', () => {
  let service: GameScreenService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GameScreenService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
