import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DialogConfirmEndingGameComponent } from './dialog-confirm-ending-game.component';

describe('DialogConfirmEndingGameComponent', () => {
  let component: DialogConfirmEndingGameComponent;
  let fixture: ComponentFixture<DialogConfirmEndingGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DialogConfirmEndingGameComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DialogConfirmEndingGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
