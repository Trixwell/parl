import {Component, ElementRef, model, ViewChild} from '@angular/core';
import {MatIcon} from '@angular/material/icon';
import {MatMiniFabButton} from '@angular/material/button';

@Component({
  selector: 'app-input-message',
    imports: [
        MatIcon,
        MatMiniFabButton
    ],
  templateUrl: './input-message.html',
  styleUrl: './input-message.scss',
})
export class InputMessage {
    input_text = model<string>();
    @ViewChild('inputText', {static: false}) inputTextElement!: ElementRef<HTMLDivElement>;

    enterDown() {
        const text = this.inputTextElement.nativeElement.innerText.trim();

        if (text !== '') {
            this.input_text.set(text);
            this.inputTextElement.nativeElement.innerHTML = '';
        }
    }
}
