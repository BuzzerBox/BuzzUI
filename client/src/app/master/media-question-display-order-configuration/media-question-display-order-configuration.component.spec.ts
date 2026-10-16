import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaQuestionDisplayOrderConfigurationComponent } from './media-question-display-order-configuration.component';

describe('MediaQuestionDisplayOrderConfigurationComponent', () => {
  let component: MediaQuestionDisplayOrderConfigurationComponent;
  let fixture: ComponentFixture<MediaQuestionDisplayOrderConfigurationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaQuestionDisplayOrderConfigurationComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaQuestionDisplayOrderConfigurationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
