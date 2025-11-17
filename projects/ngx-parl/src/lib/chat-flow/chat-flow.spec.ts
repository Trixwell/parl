import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatFlowComponent } from './chat-flow';

describe('ChatFlowComponent', () => {
  let component: ChatFlowComponent;
  let fixture: ComponentFixture<ChatFlowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatFlowComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ChatFlowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
