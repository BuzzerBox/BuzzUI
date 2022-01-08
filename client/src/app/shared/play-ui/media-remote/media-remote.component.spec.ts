import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaRemoteComponent } from './media-remote.component';

describe('MediaRemoteComponent', () => {
  let component: MediaRemoteComponent;
  let fixture: ComponentFixture<MediaRemoteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaRemoteComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaRemoteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
