import {
    afterNextRender,
    ChangeDetectorRef,
    Component,
    DestroyRef,
    ElementRef,
    inject,
    Injector,
    input,
    model,
    NgZone,
    signal,
    ViewChild,
} from '@angular/core';
import {NgOptimizedImage} from '@angular/common';
import {TranslocoPipe} from '@ngneat/transloco';
import {PARL_DEFAULT_REACTION_EMOJIS} from '../../entity/chat';
import {
    createEmojiMartPicker,
    ensureEmojiMartReady,
} from '../../service/emoji-mart/emoji-mart';

@Component({
    selector: 'lib-emoji-picker',
    imports: [NgOptimizedImage, TranslocoPipe],
    templateUrl: './emoji-picker.html',
    styleUrl: './emoji-picker.scss',
    standalone: true,
})
export class EmojiPicker {
    private readonly changeDetector = inject(ChangeDetectorRef);
    private readonly destroyRef = inject(DestroyRef);
    private readonly injector = inject(Injector);
    private readonly ngZone = inject(NgZone);

    @ViewChild('emojiMartHost') emojiMartHost?: ElementRef<HTMLElement>;

    public emojis = input<readonly string[]>(PARL_DEFAULT_REACTION_EMOJIS);
    public language = input<'en' | 'uk'>('en');
    public outgoing = input<boolean>(false);
    public mobileMode = input<boolean>(false);
    public pickedEmoji = model<string | null>(null);

    public readonly showMartPicker = signal(false);

    private emojiMartPicker: HTMLElement | null = null;
    private emojiMartMountGeneration = 0;

    constructor() {
        void ensureEmojiMartReady();
        this.destroyRef.onDestroy(() => this.destroyEmojiMartPicker());
    }

    pickEmoji(emoji: string, event?: Event): this {
        event?.preventDefault();
        event?.stopPropagation();
        this.destroyEmojiMartPicker();
        this.showMartPicker.set(false);
        this.pickedEmoji.set(emoji);

        return this;
    }

    toggleMartPicker(event: Event): this {
        event.preventDefault();
        event.stopPropagation();
        this.showMartPicker.update(open => !open);

        if (this.showMartPicker()) {
            afterNextRender(() => {
                void this.mountEmojiMartPicker();
            }, {injector: this.injector});
        } else {
            this.destroyEmojiMartPicker();
        }

        return this;
    }

    onMartHostClick(event: Event): this {
        event.stopPropagation();

        return this;
    }

    private destroyEmojiMartPicker(): this {
        this.emojiMartMountGeneration += 1;
        this.emojiMartPicker?.remove();
        this.emojiMartPicker = null;
        this.emojiMartHost?.nativeElement.replaceChildren();

        return this;
    }

    private async resolvePickerHost(): Promise<HTMLElement | null> {
        this.changeDetector.detectChanges();
        if (this.emojiMartHost?.nativeElement) {
            return this.emojiMartHost.nativeElement;
        }

        await new Promise<void>(resolve => {
            requestAnimationFrame(() => resolve());
        });
        this.changeDetector.detectChanges();

        return this.emojiMartHost?.nativeElement ?? null;
    }

    private readPickerTheme(): 'light' | 'dark' {
        if (typeof document === 'undefined') {
            return 'light';
        }

        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    }

    private fillPickerFrame(picker: HTMLElement): this {
        picker.style.setProperty('display', 'flex', 'important');
        picker.style.setProperty('width', '100%', 'important');
        picker.style.setProperty('min-width', '100%', 'important');
        picker.style.setProperty('max-width', 'none', 'important');
        picker.style.setProperty('height', '100%', 'important');
        picker.style.setProperty('box-sizing', 'border-box', 'important');

        if (this.readPickerTheme() === 'dark') {
            picker.style.setProperty('--rgb-background', '19, 22, 34');
            picker.style.setProperty('--rgb-input', '34, 40, 54');
            picker.style.setProperty('--rgb-color', '240, 242, 246');
            picker.style.setProperty('--rgb-accent', '89, 74, 225');
        }

        const shadow = picker.shadowRoot;
        if (shadow && !shadow.querySelector('style[data-parl-fill]')) {
            const sheet = document.createElement('style');
            sheet.setAttribute('data-parl-fill', '');
            sheet.textContent = `
                :host {
                    width: 100% !important;
                    min-width: 100% !important;
                    max-width: none !important;
                    height: 100% !important;
                }
                #root {
                    width: 100% !important;
                    height: 100% !important;
                    flex: 1 1 auto;
                }
            `;
            shadow.appendChild(sheet);
        }

        return this;
    }

    private async mountEmojiMartPicker(): Promise<this> {
        const host = await this.resolvePickerHost();
        if (!host || !this.showMartPicker()) {
            return this;
        }

        const mountGeneration = ++this.emojiMartMountGeneration;
        this.destroyEmojiMartPicker();
        this.emojiMartMountGeneration = mountGeneration;

        try {
            const picker = await createEmojiMartPicker({
                theme: this.readPickerTheme(),
                navPosition: 'bottom',
                skinTonePosition: 'search',
                emojiSize: 22,
                maxFrequentRows: 2,
                onEmojiSelect: emoji => {
                    this.ngZone.run(() => {
                        if (emoji.native) {
                            this.pickEmoji(emoji.native);
                            this.changeDetector.detectChanges();
                        }
                    });
                },
            });

            if (mountGeneration !== this.emojiMartMountGeneration || !this.showMartPicker()) {
                picker.remove();

                return this;
            }

            this.fillPickerFrame(picker);
            host.replaceChildren(picker);
            this.emojiMartPicker = picker;
            this.fillPickerFrame(picker);
        } catch {
            this.showMartPicker.set(false);
        }

        return this;
    }
}
