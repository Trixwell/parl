import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InputMessageComponent } from './input-message';

describe('InputMessage', () => {
  let component: InputMessageComponent;
  let fixture: ComponentFixture<InputMessageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputMessageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InputMessageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
