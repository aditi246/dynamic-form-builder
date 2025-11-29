import {
  Component,
  HostListener,
  computed,
  effect,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { BuilderTourService } from './builder-tour.service';

@Component({
  selector: 'app-builder-tour-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './builder-tour-overlay.html',
})
export class BuilderTourOverlay {
  highlightRect = signal<DOMRect | null>(null);

  calloutStyle = computed(() => {
    const hasWindow = typeof window !== 'undefined';
    if (!hasWindow) {
      return { bottom: '24px', right: '24px' };
    }

    const rect = this.highlightRect();
    if (!rect) {
      return { bottom: '24px', right: '24px' };
    }

    const padding = 14;
    const defaultLeft = Math.max(
      16,
      Math.min(rect.left, window.innerWidth - 360),
    );

    // Prefer placing the callout to the right of the highlight, then below, then above.
    if (window.innerWidth - rect.right > 320) {
      return {
        top: `${Math.max(16, rect.top)}px`,
        left: `${rect.right + padding}px`,
      };
    }

    if (window.innerHeight - rect.bottom > 220) {
      return {
        top: `${rect.bottom + padding}px`,
        left: `${defaultLeft}px`,
      };
    }

    return {
      top: `${Math.max(16, rect.top - 220)}px`,
      left: `${defaultLeft}px`,
    };
  });

  constructor(public tour: BuilderTourService) {
    effect(() => {
      const step = this.tour.currentStep();
      if (!step) {
        this.highlightRect.set(null);
        return;
      }
      this.measureTarget(step.selector);
    });
  }

  @HostListener('window:resize')
  @HostListener('window:scroll')
  onViewportChange() {
    const step = this.tour.currentStep();
    this.measureTarget(step?.selector);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (this.tour.isActive()) {
      this.tour.skip();
    }
  }

  px(value: number) {
    return `${value}px`;
  }

  private measureTarget(selector?: string) {
    if (!this.tour.isActive()) {
      this.highlightRect.set(null);
      return;
    }

    if (typeof document === 'undefined') {
      this.highlightRect.set(null);
      return;
    }

    // Wait for the DOM to settle before measuring
    requestAnimationFrame(() => {
      const padding = 8;
      const target = selector
        ? (document.querySelector(selector) as HTMLElement | null)
        : null;

      if (target) {
        const rect = target.getBoundingClientRect();
        this.highlightRect.set(
          new DOMRect(
            rect.x - padding,
            rect.y - padding,
            rect.width + padding * 2,
            rect.height + padding * 2,
          ),
        );
      } else {
        this.highlightRect.set(null);
      }
    });
  }
}
