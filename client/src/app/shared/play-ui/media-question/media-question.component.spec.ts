import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MediaQuestionComponent } from './media-question.component';

describe('MediaQuestionComponent', () => {
  let component: MediaQuestionComponent;
  let fixture: ComponentFixture<MediaQuestionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ MediaQuestionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(MediaQuestionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
