import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayUiComponent } from './play-ui.component';

describe('PlayUiComponent', () => {
  let component: PlayUiComponent;
  let fixture: ComponentFixture<PlayUiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ PlayUiComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(PlayUiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
