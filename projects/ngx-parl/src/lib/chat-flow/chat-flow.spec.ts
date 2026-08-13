import {provideHttpClient} from '@angular/common/http';
import {ComponentFixture, TestBed, fakeAsync, flushMicrotasks} from '@angular/core/testing';

import {ChatMessage} from '../core/entity/chat';
import {provideNgxParl} from '../ngx-parl.providers';
import {ChatFlowComponent} from './chat-flow';

type ChatFlowScrollInternals = {
    scrollContainerReady: boolean;
    scrollListener: (() => void) | null;
    resizeObserver: ResizeObserver | null;
};

function scrollInternals(component: ChatFlowComponent): ChatFlowScrollInternals {
    return component as unknown as ChatFlowScrollInternals;
}

function createMessage(id: number): ChatMessage {
    return new ChatMessage({
        id,
        chat_id: 1,
        cr_time: '2026-07-30 12:00:00',
        type: 'outgoing',
        user: 'user',
        content: `message ${id}`,
    });
}

describe('ChatFlowComponent', () => {
    let component: ChatFlowComponent;
    let fixture: ComponentFixture<ChatFlowComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChatFlowComponent],
            providers: [provideHttpClient(), provideNgxParl()],
        }).compileComponents();

        fixture = TestBed.createComponent(ChatFlowComponent);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('messageListInput', []);
        fixture.componentRef.setInput('selectedForEdit', null);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('tears down scroll listeners and observers when messages become empty', () => {
        fixture.componentRef.setInput('messageListInput', [createMessage(1)]);
        fixture.detectChanges();

        const flow = fixture.nativeElement.querySelector('.chat__flow') as HTMLElement | null;
        expect(flow).withContext('scroll container should render with messages').not.toBeNull();

        (component as unknown as {setupScrollContainer: () => void}).setupScrollContainer();

        const internals = scrollInternals(component);
        expect(internals.scrollContainerReady).toBe(true);
        expect(internals.scrollListener).not.toBeNull();
        expect(internals.resizeObserver).not.toBeNull();

        const removeListenerSpy = spyOn(flow!, 'removeEventListener').and.callThrough();
        const disconnectSpy = spyOn(ResizeObserver.prototype, 'disconnect').and.callThrough();

        fixture.componentRef.setInput('messageListInput', []);
        fixture.detectChanges();

        expect(removeListenerSpy).toHaveBeenCalledWith('scroll', jasmine.any(Function));
        expect(disconnectSpy).toHaveBeenCalled();
        expect(internals.scrollContainerReady).toBe(false);
        expect(internals.scrollListener).toBeNull();
        expect(internals.resizeObserver).toBeNull();
        expect(fixture.nativeElement.querySelector('.chat__flow')).toBeNull();
    });

    it('opens delete confirm for a message id', () => {
        component.onRequestDelete(42);

        expect(component.deleteConfirmOpen()).toBe(true);
        expect(component.pendingDeleteMessageId()).toBe(42);
        expect(component.selectedForEdit()).toBeNull();
    });

    it('ignores null delete requests', () => {
        component.onRequestDelete(null);

        expect(component.deleteConfirmOpen()).toBe(false);
        expect(component.pendingDeleteMessageId()).toBeNull();
    });

    it('closes delete confirm and clears pending id', () => {
        component.onRequestDelete(7);
        component.closeDeleteConfirm();

        expect(component.deleteConfirmOpen()).toBe(false);
        expect(component.pendingDeleteMessageId()).toBeNull();
    });

    it('confirmDelete emits requestDelete then clears it', fakeAsync(() => {
        component.onRequestDelete(11);
        component.confirmDelete();

        expect(component.deleteConfirmOpen()).toBe(false);
        expect(component.pendingDeleteMessageId()).toBeNull();
        expect(component.requestDelete()).toBe(11);

        flushMicrotasks();

        expect(component.requestDelete()).toBeNull();
    }));

    it('confirmDelete closes without emitting when nothing is pending', () => {
        component.confirmDelete();

        expect(component.deleteConfirmOpen()).toBe(false);
        expect(component.requestDelete()).toBeNull();
    });

    it('opens message actions for a message', () => {
        const message = createMessage(5);
        component.onRequestMessageActions(message);

        expect(component.messageActionsOpen()).toBe(true);
        expect(component.pendingActionsMessage()).toBe(message);
    });

    it('ignores null message action requests', () => {
        component.onRequestMessageActions(null);

        expect(component.messageActionsOpen()).toBe(false);
        expect(component.pendingActionsMessage()).toBeNull();
    });

    it('closes message actions and clears the pending message', () => {
        component.onRequestMessageActions(createMessage(8));
        component.closeMessageActions();

        expect(component.messageActionsOpen()).toBe(false);
        expect(component.pendingActionsMessage()).toBeNull();
    });

    it('edit from message actions starts edit and closes the sheet', () => {
        const message = createMessage(9);
        fixture.componentRef.setInput('messageListInput', [message]);
        fixture.detectChanges();

        component.onRequestMessageActions(message);
        component.onMessageActionsEdit();

        expect(component.messageActionsOpen()).toBe(false);
        expect(component.pendingActionsMessage()).toBeNull();
        expect(component.selectedForEdit()).toBe(message);
        expect(message.edit).toBe(true);
    });

    it('delete from message actions opens delete confirm', () => {
        const message = createMessage(10);
        component.onRequestMessageActions(message);
        component.onMessageActionsDelete();

        expect(component.messageActionsOpen()).toBe(false);
        expect(component.deleteConfirmOpen()).toBe(true);
        expect(component.pendingDeleteMessageId()).toBe(10);
    });

    it('ignores the first backdrop click after opening actions so iOS ghost clicks do not close it', () => {
        component.onRequestMessageActions(createMessage(12));

        expect(component.messageActionsInteractive()).toBe(false);
        component.onMessageActionsBackdropClick();
        expect(component.messageActionsOpen()).toBe(true);

        component.messageActionsInteractive.set(true);
        component.onMessageActionsBackdropClick();
        expect(component.messageActionsOpen()).toBe(false);
    });
});
