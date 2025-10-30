import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputMessage } from './input-message';

describe('InputMessage', () => {
  let component: InputMessage;
  let fixture: ComponentFixture<InputMessage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputMessage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InputMessage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
