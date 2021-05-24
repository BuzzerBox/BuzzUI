import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuestionPaneComponent } from './question-pane.component';

describe('QuestionPaneComponent', () => {
  let component: QuestionPaneComponent;
  let fixture: ComponentFixture<QuestionPaneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ QuestionPaneComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(QuestionPaneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
