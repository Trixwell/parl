import {provideHttpClient, withXhr} from '@angular/common/http';
import {ComponentFixture, TestBed, fakeAsync, flushMicrotasks} from '@angular/core/testing';

import {ChatMessage, ChatMessageDTO} from '../core/entity/chat';
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

function createPendingOutgoing(
    id: number,
    content: string,
    crTime: string,
    chatId = 1,
): ChatMessage {
    return new ChatMessage({
        id,
        chat_id: chatId,
        cr_time: crTime,
        type: 'outgoing',
        user: 'user',
        content,
        pending: true,
    });
}

describe('NgxParlComponent', () => {
    let component: NgxParlComponent;
    let fixture: ComponentFixture<NgxParlComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [NgxParlComponent],
            providers: [provideHttpClient(withXhr()), provideNgxParl()],
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

    it('lifts the composer from a keyboardDidShow event when the host inset is 0', () => {
        fixture.componentRef.setInput('layout', 'fill');
        fixture.componentRef.setInput('mobileMode', true);
        fixture.detectChanges();

        window.dispatchEvent(new CustomEvent('keyboardDidShow', {
            detail: {keyboardHeight: 340},
        }));
        fixture.detectChanges();

        expect(component.resolvedKeyboardInset()).toBe(340);
        expect(component.isKeyboardOpen()).toBe(true);
        expect(component.keyboardInsetCss()).toBe('340px');
        expect(fixture.nativeElement.classList.contains('ngx-parl--keyboard-open')).toBe(true);
        expect(fixture.nativeElement.querySelector('.modal-chat__keyboard-spacer')).not.toBeNull();
    });

    it('lifts the fill layout with a keyboard spacer instead of shell padding', () => {
        fixture.componentRef.setInput('layout', 'fill');
        fixture.componentRef.setInput('keyboardInset', 120);
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('.modal-chat__keyboard-spacer')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('.modal-chat--fill')).not.toBeNull();
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
        expect(confirmed.clientKey).toBe(pending.clientKey);
        expect(confirmed).not.toBe(pending);
        expect(confirmed.id).toBe(42);
        expect(confirmed.pending).toBe(false);
        expect(confirmed.content).toBe('hello');
    });

    it('replaces upload state on confirm without changing clientKey', () => {
        component.sendMessage({
            content: 'pic',
            file_path: ['assets/demo.png'],
            file_list: [],
        });

        const pending = component.messageList()[0];
        expect(pending.upload?.status).toBe('uploading');

        component.confirmPending(
            pending.id,
            {
                ...createOutgoingDto(99, 'pic'),
                file_path: ['assets/demo.png'],
                upload: {progress: 100, status: 'done'},
            },
        );

        const confirmed = component.messageList()[0];
        expect(confirmed.clientKey).toBe(pending.clientKey);
        expect(confirmed).not.toBe(pending);
        expect(confirmed.upload?.status).toBe('done');
        expect(confirmed.upload?.progress).toBe(100);
    });

    it('does not mark an existing message checked on realtime updates that omit checked', fakeAsync(() => {
        const existing = new ChatMessage({
            id: 10,
            chat_id: 1,
            cr_time: '2026-01-01 12:00:00',
            type: 'incoming',
            user: 'agent',
            content: 'hello',
            checked: null,
            reactions: [],
        });
        component.messageList.set([existing]);

        component.messageUpdate.set(new ChatMessage({
            id: 10,
            chat_id: 1,
            cr_time: '2026-01-01 12:00:00',
            type: 'incoming',
            user: 'agent',
            content: 'hello',
            reactions: [{emoji: '👍', count: 1, reactedByMe: true}],
        }));
        fixture.detectChanges();
        flushMicrotasks();

        const updated = component.messageList()[0];
        expect(updated.checked).toBeNull();
        expect(updated.reactions).toEqual([{emoji: '👍', count: 1, reactedByMe: true}]);
    }));

    it('rejects pending messages by temp id', () => {
        component.sendMessage({content: 'gone'});
        const tempId = component.messageList()[0].id;

        component.rejectPending(tempId);

        expect(component.messageList().length).toBe(0);
    });

    it('matches duplicate pending content to the closest cr_time on realtime ack', fakeAsync(() => {
        const first = createPendingOutgoing(-1, 'hello', '2026-01-01 12:00:00');
        const second = createPendingOutgoing(-2, 'hello', '2026-01-01 12:00:10');
        component.messageList.set([first, second]);

        component.messageUpdate.set(new ChatMessage({
            id: 50,
            chat_id: 1,
            cr_time: '2026-01-01 12:00:11',
            type: 'outgoing',
            user: 'user',
            content: 'hello',
        }));
        fixture.detectChanges();
        flushMicrotasks();

        const list = component.messageList();
        expect(list.length).toBe(2);
        expect(list[0].id).toBe(-1);
        expect(list[0].pending).toBe(true);
        expect(list[0].clientKey).toBe(first.clientKey);
        expect(list[1].id).toBe(50);
        expect(list[1].pending).toBe(false);
        expect(list[1].clientKey).toBe(second.clientKey);
    }));

    it('does not attach a realtime ack to a pending message from another chat', fakeAsync(() => {
        const pending = createPendingOutgoing(-1, 'hello', '2026-01-01 12:00:00', 1);
        component.messageList.set([pending]);

        component.messageUpdate.set(new ChatMessage({
            id: 50,
            chat_id: 2,
            cr_time: '2026-01-01 12:00:00',
            type: 'outgoing',
            user: 'user',
            content: 'hello',
        }));
        fixture.detectChanges();
        flushMicrotasks();

        const list = component.messageList();
        expect(list.length).toBe(2);
        expect(list[0].id).toBe(-1);
        expect(list[0].pending).toBe(true);
        expect(list[1].id).toBe(50);
        expect(list[1].pending).toBe(false);
    }));

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
