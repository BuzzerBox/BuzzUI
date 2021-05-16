import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ToolbarMasterComponent } from './toolbar-master.component';

describe('ToolbarMasterComponent', () => {
  let component: ToolbarMasterComponent;
  let fixture: ComponentFixture<ToolbarMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ToolbarMasterComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ToolbarMasterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
