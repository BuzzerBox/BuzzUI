import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BuzzerLockComponent } from './buzzer-lock.component';

describe('BuzzerLockComponent', () => {
  let component: BuzzerLockComponent;
  let fixture: ComponentFixture<BuzzerLockComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BuzzerLockComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BuzzerLockComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
