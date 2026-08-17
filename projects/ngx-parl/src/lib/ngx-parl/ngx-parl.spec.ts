import {provideHttpClient} from '@angular/common/http';
import {ComponentFixture, TestBed} from '@angular/core/testing';

import {ChatMessageDTO} from '../core/entity/chat';
import {provideNgxParl} from '../ngx-parl.providers';
import {NgxParlComponent} from './ngx-parl';

function createOutgoingDto(id: number, content = `message ${id}`): ChatMessageDTO {
    return {
        id,
        chat_id: 1,
        cr_time: '2026-07-30 12:00:00',
        type: 'outgoing',
        user: 'user',
        content,
    };
}

describe('NgxParlComponent', () => {
    let component: NgxParlComponent;
    let fixture: ComponentFixture<NgxParlComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NgxParlComponent],
            providers: [provideHttpClient(), provideNgxParl()],
        }).compileComponents();

        fixture = TestBed.createComponent(NgxParlComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('defaults to dialog layout without fill host class', () => {
        expect(component.layout()).toBe('dialog');
        expect(component.isFillLayout()).toBe(false);
        expect(fixture.nativeElement.classList.contains('ngx-parl--fill')).toBe(false);
    });

    it('applies fill layout host class', () => {
        fixture.componentRef.setInput('layout', 'fill');
        fixture.detectChanges();

        expect(component.isFillLayout()).toBe(true);
        expect(fixture.nativeElement.classList.contains('ngx-parl--fill')).toBe(true);
        expect(fixture.nativeElement.querySelector('.modal-chat--fill')).not.toBeNull();
    });

    it('applies keyboard inset as a CSS custom property', () => {
        fixture.componentRef.setInput('keyboardInset', 120);
        fixture.detectChanges();

        expect(component.isKeyboardOpen()).toBe(true);
        expect(component.keyboardInsetCss()).toBe('120px');
        expect(fixture.nativeElement.classList.contains('ngx-parl--keyboard-open')).toBe(true);
        expect(fixture.nativeElement.style.getPropertyValue('--parl-keyboard-inset')).toBe('120px');
    });

    it('ignores keyboard inset while the emoji picker is open', () => {
        fixture.componentRef.setInput('keyboardInset', 120);
        component.emojiPickerOpen.set(true);
        fixture.detectChanges();

        expect(component.isKeyboardOpen()).toBe(false);
        expect(component.keyboardInsetCss()).toBe('0px');
        expect(fixture.nativeElement.classList.contains('ngx-parl--keyboard-open')).toBe(false);
        expect(fixture.nativeElement.classList.contains('ngx-parl--emoji-open')).toBe(true);
        expect(fixture.nativeElement.style.getPropertyValue('--parl-keyboard-inset')).toBe('0px');
    });

    it('skips initial focus when autoFocus is false', () => {
        component.ngOnDestroy();
        fixture.componentRef.setInput('autoFocus', false);
        component.ngAfterViewInit();

        expect(component['focusTimers'].length).toBe(0);
    });

    it('allocates negative temp ids and confirms pending messages', () => {
        component.sendMessage({content: 'hello'});

        const pending = component.messageList()[0];
        expect(pending.id).toBeLessThan(0);
        expect(pending.pending).toBe(true);
        expect(component.messageAction()?.action).toBe('send');
        expect(component.messageAction()?.chatMessageId).toBe(pending.id);

        component.confirmPending(pending.id, createOutgoingDto(42, 'hello'));

        const confirmed = component.messageList()[0];
        expect(confirmed.id).toBe(42);
        expect(confirmed.pending).toBe(false);
        expect(confirmed.content).toBe('hello');
    });

    it('rejects pending messages by temp id', () => {
        component.sendMessage({content: 'gone'});
        const tempId = component.messageList()[0].id;

        component.rejectPending(tempId);

        expect(component.messageList().length).toBe(0);
    });

    it('does not double-send a quick action click', () => {
        const sendSpy = spyOn(component, 'sendMessage').and.callThrough();

        component.onQuickActionClick({
            actionId: '1',
            messageId: 1,
            value: 'Quick reply',
        });

        expect(sendSpy).toHaveBeenCalledTimes(1);
        expect(component.messageList().length).toBe(1);
    });
});
