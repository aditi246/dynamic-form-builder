import { Component, input, signal, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../icon/icon';
import { AlertPopupComponent } from '../alert-popup/alert-popup';
import { DocumentAnalysisResult } from '../../shared/services/open-ai.service';

export interface DisplayFile {
  file: File;
  previewUrl?: string;
  isBlurry?: boolean;
  documentQuality?: DocumentAnalysisResult;
}

@Component({
  selector: 'app-file-input',
  standalone: true,
  imports: [CommonModule, IconComponent, AlertPopupComponent],
  templateUrl: './input-file.html',
})
export class FileInputComponent {
  dragActive = signal<boolean>(false);

  multiple = input<boolean>(true);
  accept = input<string>('image/*');
  blurryIndex = input<number | null>(null);
  analyzingIndex = input<number | null>(null);
  blurryMessage = input<string>(
    'Blurry image detected. Please reupload the image.',
  );
  documentQualityIndex = input<number | null>(null);
  analyzingDocumentIndex = input<number | null>(null);
  documentQualityMessage = input<string>('');
  files = input<DisplayFile[] | null | undefined>([]);

  filesList = computed(() => this.files() || []);

  supportedFileTypeLabel = computed(() => {
    const acceptValue = this.accept();
    if (acceptValue === 'image/*') return 'Images';
    if (acceptValue === '*/*') return 'All files';
    // Check if accept contains document extensions
    if (
      acceptValue.includes('.pdf') ||
      acceptValue.includes('.doc') ||
      acceptValue.includes('.xls') ||
      acceptValue.includes('.ppt')
    ) {
      return 'Documents';
    }
    return 'All files';
  });

  /**
   * Checks if a file is a PDF or document
   */
  isDocumentFile(file: File): boolean {
    const fileName = file.name.toLowerCase();
    const fileType = file.type.toLowerCase();

    return (
      fileType === 'application/pdf' ||
      fileName.endsWith('.pdf') ||
      fileName.endsWith('.doc') ||
      fileName.endsWith('.docx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.ppt') ||
      fileName.endsWith('.pptx') ||
      fileName.endsWith('.txt') ||
      fileName.endsWith('.rtf') ||
      fileName.endsWith('.odt') ||
      fileName.endsWith('.ods') ||
      fileName.endsWith('.odp')
    );
  }

  filesAdded = output<File[]>();
  removeFile = output<number>();
  blurryAction = output<{ action: 'reupload' | 'keep'; index: number }>();
  documentQualityAction = output<{
    action: 'reupload' | 'keep';
    index: number;
  }>();

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

  onBlurryPopupAction(action: 'reupload' | 'keep') {
    const index = this.blurryIndex();
    if (index === null || index === undefined) return;
    this.blurryAction.emit({ action, index });
  }

  onDocumentQualityPopupAction(action: 'reupload' | 'keep') {
    const index = this.documentQualityIndex();
    if (index === null || index === undefined) return;
    this.documentQualityAction.emit({ action, index });
  }

  private emitFiles(fileList: FileList) {
    let files = Array.from(fileList);
    if (!this.multiple()) {
      files = files.slice(0, 1);
    }
    if (files.length) {
      this.filesAdded.emit(files);
    }
  }
}
