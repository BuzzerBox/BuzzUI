import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MasterAlreadyRegisteredComponent } from './master-already-registered.component';

describe('MasterAlreadyRegisteredComponent', () => {
  let component: MasterAlreadyRegisteredComponent;
  let fixture: ComponentFixture<MasterAlreadyRegisteredComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MasterAlreadyRegisteredComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MasterAlreadyRegisteredComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
