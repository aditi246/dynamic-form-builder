import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-alert-popup',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alert-popup.html',
})
export class AlertPopupComponent {
  title = input<string>('');
  message = input<string>('');
  show = input<boolean>(false);

  action = output<'reupload' | 'keep'>();

  onReupload() {
    this.action.emit('reupload');
  }

  onKeep() {
    this.action.emit('keep');
  }

  onBackdropClick() {
    this.onKeep();
  }
}

