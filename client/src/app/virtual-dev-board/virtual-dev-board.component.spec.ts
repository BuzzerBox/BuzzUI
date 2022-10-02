import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VirtualDevBoardComponent } from './virtual-dev-board.component';

describe('VirtualDevBoardComponent', () => {
  let component: VirtualDevBoardComponent;
  let fixture: ComponentFixture<VirtualDevBoardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ VirtualDevBoardComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(VirtualDevBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
