import {Component, ElementRef, model, ViewChild} from '@angular/core';
import {MatIcon, MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';

@Component({
    selector: 'app-input-message',
    imports: [
        MatIcon,
    ],
    templateUrl: './input-message.html',
    styleUrl: './input-message.scss',
})


export class InputMessage {
    input_text = model<string>();
    @ViewChild('inputText', {static: false}) inputTextElement!: ElementRef<HTMLDivElement>;

    constructor(private iconRegistry: MatIconRegistry, private sanitizer: DomSanitizer) {
        this.iconRegistry.addSvgIcon('attach-filled', this.sanitizer.bypassSecurityTrustResourceUrl('./assets/icons/attach-filled.svg'));
        this.iconRegistry.addSvgIcon('send', this.sanitizer.bypassSecurityTrustResourceUrl('./assets/icons/send.svg'));
    }

    ngAfterViewInit() {
        this.autoResize();
    }

    onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.enterDown();
        } else {
            queueMicrotask(() => this.autoResize());
        }
    }

    autoResize() {
        const el = this.inputTextElement.nativeElement;
        el.style.height = 'auto';
        const max = this.getMaxHeightPx();
        const next = Math.min(el.scrollHeight, max);
        el.style.height = next + 'px';

        return this;
    }

    autoResizeNextTick() {
        setTimeout(() => this.autoResize(), 0);

        return this;
    }

    getMaxHeightPx(): number {
        const styles = getComputedStyle(this.inputTextElement.nativeElement);
        const lh = parseFloat(styles.getPropertyValue('--lh')) || parseFloat(styles.lineHeight) || 24;
        const maxRows = parseFloat(styles.getPropertyValue('--max-rows')) || 8;

        return Math.round(lh * maxRows);
    }

    enterDown() {
        const text = this.inputTextElement.nativeElement.innerText.trim();

        if (text !== '') {
            this.input_text.set(text);
            this.inputTextElement.nativeElement.innerHTML = '';
            this.autoResize();
        }

        return this;
    }

    attachFilled() {
        return this;
    }
}
