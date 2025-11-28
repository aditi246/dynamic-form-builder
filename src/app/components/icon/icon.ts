import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon.html',
})
export class IconComponent {
  name = input.required<string>();
  class = input<string>('w-5 h-5');
}
