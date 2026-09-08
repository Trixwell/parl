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

  it('does not focus the input when autoFocus is false', fakeAsync(() => {
    const localFixture = TestBed.createComponent(InputMessageComponent);
    localFixture.componentRef.setInput('autoFocus', false);
    const focusSpy = spyOn(HTMLElement.prototype, 'focus');
    spyOn(window, 'requestAnimationFrame').and.callFake((callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    });

    localFixture.detectChanges();
    flushMicrotasks();

    expect(focusSpy).not.toHaveBeenCalled();
  }));

  it('renders a textarea composer in mobileMode', () => {
    fixture.componentRef.setInput('mobileMode', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('textarea.message__input')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('div.message__input[contenteditable]')).toBeNull();
  });

  it('shows an empty mobile composer with a placeholder and no leading gap', () => {
    fixture.componentRef.setInput('mobileMode', true);
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea.message__input') as HTMLTextAreaElement;

    expect(textarea.value).toBe('');
    expect(textarea.placeholder).toBeTruthy();
    expect(textarea.getAttribute('cols')).toBeNull();
  });

  it('places emoji on the left and attach next to send in mobileMode', () => {
    fixture.componentRef.setInput('mobileMode', true);
    fixture.detectChanges();

    const composerButtons = fixture.nativeElement.querySelectorAll('.message__wrap .message__button');

    expect(composerButtons[0].classList.contains('message__button--emoji')).toBeTrue();
    expect(composerButtons[1].classList.contains('message__button--attach')).toBeTrue();
    expect(composerButtons[2].classList.contains('message__button--send')).toBeTrue();
    expect(fixture.nativeElement.querySelector('.message__wrap--input .message__button--attach')).toBeNull();
  });

    it('keeps the emoji picker open when the composer is refocused', () => {
        fixture.componentRef.setInput('mobileMode', true);
        fixture.detectChanges();

        component.toggleEmojiPicker();
        fixture.detectChanges();
        component.onFocus();
        fixture.detectChanges();

        expect(component.emojiPickerOpen()).toBeTrue();
        expect(component.composerInputMode()).toBe('none');
    });

    it('uses inputmode none while the emoji picker is open', () => {
        fixture.componentRef.setInput('mobileMode', true);
        fixture.detectChanges();

        const textarea = fixture.nativeElement.querySelector('textarea.message__input') as HTMLTextAreaElement;
        expect(textarea.getAttribute('inputmode')).toBe('text');

        component.toggleEmojiPicker();
        fixture.detectChanges();

        expect(component.emojiPickerOpen()).toBeTrue();
        expect(component.composerInputMode()).toBe('none');
        expect(textarea.getAttribute('inputmode')).toBe('none');
        expect(document.activeElement).not.toBe(textarea);
    });

    it('inserts a native emoji into the mobile composer', () => {
    fixture.componentRef.setInput('mobileMode', true);
    fixture.detectChanges();

    component.toggleEmojiPicker();
    fixture.detectChanges();
    component.insertEmoji('😀');
    fixture.detectChanges();

    expect(component.emojiPickerOpen()).toBeTrue();
    expect(component.draft()).toBe('😀');
    expect(fixture.nativeElement.querySelector('textarea.message__input').value).toBe('😀');
    expect(fixture.nativeElement.querySelector('.message__emoji')).not.toBeNull();
    expect(component.canSend()).toBeTrue();
  });

  it('collapses the mobile composer after sending a long message', () => {
    fixture.componentRef.setInput('mobileMode', true);
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea.message__input') as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get: () => textarea.value ? 90 : 18,
    });

    textarea.value = 'so I can do it for you and you can do it on the office';
    component.onInput();
    fixture.detectChanges();

    const expandedHeight = Number.parseInt(textarea.style.height, 10);
    expect(expandedHeight).toBeGreaterThan(24);

    component.enterDown();
    fixture.detectChanges();

    expect(textarea.value).toBe('');
    expect(Number.parseInt(textarea.style.height, 10)).toBeLessThan(expandedHeight);
    expect(textarea.rows).toBe(1);
  });

  it('sends an emoji-only message from the mobile composer', () => {
    fixture.componentRef.setInput('mobileMode', true);
    fixture.detectChanges();

    const textarea = fixture.nativeElement.querySelector('textarea.message__input') as HTMLTextAreaElement;
    textarea.value = '😜';
    component.onCompositionEnd();
    fixture.detectChanges();

    expect(component.canSend()).toBeTrue();

    const payloadSpy = spyOn(component.input_text, 'set').and.callThrough();
    component.enterDown();
    fixture.detectChanges();

    expect(payloadSpy).toHaveBeenCalledWith(jasmine.objectContaining({ content: '😜' }));
    expect(textarea.value).toBe('');
  });

  it('sends photo attachments without text', () => {
    const photo = new File([new Uint8Array(1024)], 'photo.png', {type: 'image/png'});
    component.addFiles([photo]);
    component.previews.set(
      component.previews().map((item) => ({
        ...item,
        src: item.src || 'data:image/png;base64,aaa',
        status: 'ready',
        progress: 100,
      })),
    );
    fixture.detectChanges();

    expect(component.canSend()).toBeTrue();

    const payloadSpy = spyOn(component.input_text, 'set').and.callThrough();
    component.enterDown();
    fixture.detectChanges();

    expect(payloadSpy).toHaveBeenCalled();
    const payload = payloadSpy.calls.mostRecent().args[0] as {content: string; file_list: File[]};
    expect(payload.content).toBe('');
    expect(payload.file_list.length).toBe(1);
    expect(payload.file_list[0].name).toBe('photo.png');
  });

  it('rejects photos larger than 8 MB and does not queue them for send', () => {
    fixture.componentRef.setInput('maxFileSizeBytes', 8 * 1024 * 1024);
    fixture.detectChanges();

    const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.png', {
      type: 'image/png',
    });
    const allowed = new File([new Uint8Array(1024)], 'ok.png', {type: 'image/png'});

    component.addFiles([oversized, allowed]);
    fixture.detectChanges();

    expect(component.files().length).toBe(1);
    expect(component.files()[0].name).toBe('ok.png');
    expect(component.previews().some(item => item.status === 'oversized')).toBeTrue();
    expect(component.fileError()).toContain('8 MB');
  });
});
