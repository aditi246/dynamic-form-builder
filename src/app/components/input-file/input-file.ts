import { Component, Input, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon';

export interface DisplayFile {
  file: File;
  previewUrl?: string;
  isBlurry?: boolean;
}

@Component({
  selector: 'app-file-input',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './input-file.html',
})
export class FileInputComponent {
  private _files: DisplayFile[] = [];
  dragActive = signal<boolean>(false);

  @Input() multiple = true;
  @Input() accept = 'image/*';
  @Input() blurryIndex: number | null = null;
  @Input() analyzingIndex: number | null = null;
  @Input() blurryMessage = 'Blurry image detected. Please reupload the image.';

  @Input()
  set files(value: DisplayFile[] | null | undefined) {
    this._files = value || [];
  }

  get filesList(): DisplayFile[] {
    return this._files;
  }

  filesAdded = output<File[]>();
  removeFile = output<number>();
  blurryAction = output<{ action: 'reupload' | 'keep'; index: number }>();

  onFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.emitFiles(input.files);
    input.value = '';
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragActive.set(false);
    if (!event.dataTransfer?.files?.length) return;
    this.emitFiles(event.dataTransfer.files);
  }

  onRemove(index: number) {
    this.removeFile.emit(index);
  }

  resolveBlurry(action: 'reupload' | 'keep') {
    if (this.blurryIndex === null || this.blurryIndex === undefined) return;
    this.blurryAction.emit({ action, index: this.blurryIndex });
  }

  private emitFiles(fileList: FileList) {
    let files = Array.from(fileList);
    if (!this.multiple) {
      files = files.slice(0, 1);
    }
    if (files.length) {
      this.filesAdded.emit(files);
    }
  }
}
