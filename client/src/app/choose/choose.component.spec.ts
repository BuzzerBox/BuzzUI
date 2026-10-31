import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChooseComponent } from './choose.component';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {RouterModule} from '@angular/router';

describe('ChooseComponent', () => {
  let component: ChooseComponent;
  let fixture: ComponentFixture<ChooseComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ChooseComponent ],
      imports: [ MatButtonModule, MatIconModule, RouterModule.forRoot([]) ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ChooseComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
