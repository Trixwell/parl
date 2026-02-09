import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';

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

  it('focuses the input on init', fakeAsync(() => {
    const localFixture = TestBed.createComponent(InputMessageComponent);
    const focusSpy = spyOn(HTMLElement.prototype, 'focus');
    spyOn(window, 'requestAnimationFrame').and.callFake((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    localFixture.detectChanges();
    flushMicrotasks();

    expect(focusSpy).toHaveBeenCalled();
  }));
});
