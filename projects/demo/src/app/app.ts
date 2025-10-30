import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {NgxParlComponent} from 'ngx-parl';

@Component({
  selector: 'app-root',
  standalone: true,
    imports: [RouterOutlet, NgxParlComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('demo');
}
