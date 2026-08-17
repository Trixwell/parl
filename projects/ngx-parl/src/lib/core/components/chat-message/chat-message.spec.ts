import {provideHttpClient} from '@angular/common/http';
import {ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick} from '@angular/core/testing';
import {provideNoopAnimations} from '@angular/platform-browser/animations';

import {ChatMessage} from '../../entity/chat';
import {provideNgxParl} from '../../../ngx-parl.providers';
import {ChatMessageComponent} from './chat-message';

function createOutgoingMessage(id = 1, pending = false): ChatMessage {
    return new ChatMessage({
        id,
        chat_id: 1,
        cr_time: '2026-08-13 12:00:00',
        type: 'outgoing',
        user: 'user',
        content: 'hello',
        pending,
    });
}

function createIncomingMessage(id = 2): ChatMessage {
    return new ChatMessage({
        id,
        chat_id: 1,
        cr_time: '2026-08-13 12:00:00',
        type: 'incoming',
        user: 'client',
        content: 'hi',
    });
}

describe('ChatMessageComponent', () => {
    let component: ChatMessageComponent;
    let fixture: ComponentFixture<ChatMessageComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChatMessageComponent],
            providers: [provideHttpClient(), provideNgxParl(), provideNoopAnimations()],
        }).compileComponents();

        fixture = TestBed.createComponent(ChatMessageComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('currentMessage', createOutgoingMessage());
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('allows context actions for sent outgoing messages', () => {
        expect(component.canOpenContextMenu()).toBe(true);
    });

    it('does not allow context actions for pending or incoming messages', () => {
        fixture.componentRef.setInput('currentMessage', createOutgoingMessage(3, true));
        fixture.detectChanges();
        expect(component.canOpenContextMenu()).toBe(false);

        fixture.componentRef.setInput('currentMessage', createIncomingMessage());
        fixture.detectChanges();
        expect(component.canOpenContextMenu()).toBe(false);
    });

    it('uses long-press for mobile actions and does not render an actions button', () => {
        fixture.componentRef.setInput('mobileMode', true);
        fixture.detectChanges();

        expect(component.useMobileMessageActions()).toBe(true);
        expect(fixture.nativeElement.querySelector('.message__actions-button')).toBeNull();
    });

    it('opens the mobile action sheet for touch long-press', fakeAsync(() => {
        fixture.componentRef.setInput('mobileMode', true);
        fixture.detectChanges();

        const pointerDown = new PointerEvent('pointerdown', {
            pointerType: 'touch',
            clientX: 40,
            clientY: 80,
        });
        component.onMessagePointerDown(pointerDown);
        tick(480);
        expect(component.requestMessageActions()?.id).toBe(1);

        flushMicrotasks();
        expect(component.requestMessageActions()).toBeNull();
    }));

    it('cancels long-press when the pointer moves too far', fakeAsync(() => {
        fixture.componentRef.setInput('mobileMode', true);
        fixture.detectChanges();

        component.onMessagePointerDown(new PointerEvent('pointerdown', {
            pointerType: 'touch',
            clientX: 40,
            clientY: 80,
        }));
        component.onMessagePointerMove(new PointerEvent('pointermove', {
            pointerType: 'touch',
            clientX: 40,
            clientY: 120,
        }));
        tick(480);

        expect(component.requestMessageActions()).toBeNull();
    }));

    it('does not show an actions button for incoming messages', () => {
        fixture.componentRef.setInput('mobileMode', true);
        fixture.componentRef.setInput('currentMessage', createIncomingMessage());
        fixture.detectChanges();

        expect(fixture.nativeElement.querySelector('.message__actions-button')).toBeNull();
    });

    it('renders the avatar with src so repeated avatars can load', () => {
        const message = createOutgoingMessage();
        message.avatar = 'https://cdn.example/user.png';
        fixture.componentRef.setInput('currentMessage', message);
        fixture.detectChanges();

        const avatar = fixture.nativeElement.querySelector('.message__avatar img') as HTMLImageElement | null;
        expect(avatar).not.toBeNull();
        expect(avatar?.getAttribute('ng-img')).toBeNull();
        expect(avatar?.getAttribute('src')).toBe('https://cdn.example/user.png');
        expect(component.displayedAvatarSrc()).toBe('https://cdn.example/user.png');
    });

    it('falls back to the anonymous avatar when the image fails to load', () => {
        const message = createOutgoingMessage();
        message.avatar = 'https://cdn.example/missing.png';
        fixture.componentRef.setInput('currentMessage', message);
        fixture.detectChanges();

        component.onAvatarError();
        fixture.detectChanges();

        expect(component.avatarLoadFailed()).toBe(true);
        expect(component.displayedAvatarSrc()).toContain('avatar_anonym.svg');
    });

    it('falls back to incomingAvatar for incoming messages without avatar', () => {
        fixture.componentRef.setInput('incomingAvatar', 'https://cdn.example/peer.png');
        fixture.componentRef.setInput('currentMessage', createIncomingMessage());
        fixture.detectChanges();

        expect(component.displayedAvatarSrc()).toBe('https://cdn.example/peer.png');
    });

    it('opens the mobile action sheet from a touch long-press', fakeAsync(() => {
        fixture.componentRef.setInput('mobileMode', true);
        fixture.detectChanges();

        const touch = {clientX: 24, clientY: 40} as Touch;
        const touchList = {
            length: 1,
            item: () => touch,
            0: touch,
        } as unknown as TouchList;
        component.onMessageTouchStart({
            touches: touchList,
        } as TouchEvent);
        tick(480);
        expect(component.requestMessageActions()?.id).toBe(1);

        flushMicrotasks();
        expect(component.requestMessageActions()).toBeNull();
    }));
});
