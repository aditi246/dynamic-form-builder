import { Component, output, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../icon/icon';

@Component({
  selector: 'app-audio-textarea',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './audio-textarea.html'
})
export class AudioTextareaComponent implements OnInit, OnDestroy {
  textChange = output<string>();

  textValue = signal<string>('');
  finalText: string = '';
  isRecording = signal<boolean>(false);
  isProcessing = signal<boolean>(false);
  recognition: any = null;
  
  readonly placeholder = 'e.g., \'Fill out the form for a new user named John Doe...\'';
  readonly rows = 4;

  ngOnInit() {
    // Initialize Speech Recognition API
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let newFinalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              newFinalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          // Update final text with new final transcripts
          if (newFinalTranscript) {
            this.finalText += newFinalTranscript;
          }

          // Update text value: final text + current interim
          this.textValue.set(this.finalText + interimTranscript);
        };

        this.recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          this.isRecording.set(false);
          this.isProcessing.set(false);
        };

        this.recognition.onend = () => {
          this.isRecording.set(false);
          this.isProcessing.set(false);
          this.textValue.set(this.finalText);
        };
      }
    }
  }

  ngOnDestroy() {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  startRecording() {
    if (!this.recognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    try {
      this.isRecording.set(true);
      this.isProcessing.set(true);
      // Reset final text when starting new recording
      this.textValue.set('');
      this.finalText = '';
      this.recognition.start();
    } catch (error) {
      console.error('Error starting recording:', error);
      this.isRecording.set(false);
      this.isProcessing.set(false);
    }
  }

  stopRecording() {
    if (this.recognition && this.isRecording()) {
      this.recognition.stop();
      this.isRecording.set(false);
      this.isProcessing.set(true);
      // The onend event will handle setting isProcessing to false and emitting
    }
  }

  onTextChange(value: string) {
    this.textValue.set(value);
    this.finalText = value;
  }

  fillWithAI() {
    this.textChange.emit(this.textValue());
  }
}

