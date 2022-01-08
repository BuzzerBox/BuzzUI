import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectMediaComponent } from './select-media.component';

describe('SelectMediaComponent', () => {
  let component: SelectMediaComponent;
  let fixture: ComponentFixture<SelectMediaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SelectMediaComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectMediaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
