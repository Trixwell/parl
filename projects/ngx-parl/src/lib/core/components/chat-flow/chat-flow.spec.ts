import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatFlow } from './chat-flow';

describe('ChatFlow', () => {
  let component: ChatFlow;
  let fixture: ComponentFixture<ChatFlow>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatFlow]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatFlow);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
