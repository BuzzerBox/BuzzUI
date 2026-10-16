import {AfterViewInit, Directive, ElementRef, Input, NgZone, OnChanges, OnDestroy} from '@angular/core';

/**
 * Shrinks the text of an element until it fits into the element's box, so long texts don't get clipped or need
 * scrolling. The font size from the stylesheet is the largest size used, so short texts keep it. The box must be
 * limited (e.g. a fixed height or a max-height, with overflow hidden).
 *
 * Usage: <div [appFitText]="true">...</div>; with false, the stylesheet's size is used as it is.
 */
@Directive({
    selector: '[appFitText]',
    standalone: false
})
export class FitTextDirective implements AfterViewInit, OnChanges, OnDestroy {
  private static readonly MIN_FONT_SIZE_IN_PX = 10;
  // binary search steps; 8 get within 1% of the largest size that fits
  private static readonly SEARCH_STEPS = 8;

  @Input() appFitText: boolean | '' = true;

  private resizeObserver: ResizeObserver;
  private mutationObserver: MutationObserver;
  private scheduledFrame: number | null = null;
  private readonly onWindowResize = () => this.scheduleFit();

  constructor(private elementRef: ElementRef<HTMLElement>, private zone: NgZone) { }

  ngAfterViewInit(): void {
    // fitting changes no Angular state, so it doesn't need change detection
    this.zone.runOutsideAngular(() => {
      const element = this.elementRef.nativeElement;
      this.resizeObserver = new ResizeObserver(() => this.scheduleFit());
      this.resizeObserver.observe(element);
      // the box can stay the same while the space around it grows, e.g. with a max-height in percent
      if (element.parentElement) {
        this.resizeObserver.observe(element.parentElement);
      }
      this.mutationObserver = new MutationObserver(() => this.scheduleFit());
      this.mutationObserver.observe(element, {characterData: true, childList: true, subtree: true});
      window.addEventListener('resize', this.onWindowResize);
      // the web font changes the size of the text once it is loaded
      document.fonts?.ready.then(() => this.scheduleFit());
      this.scheduleFit();
    });
  }

  ngOnChanges(): void {
    this.scheduleFit();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
    window.removeEventListener('resize', this.onWindowResize);
    if (this.scheduledFrame != null) {
      cancelAnimationFrame(this.scheduledFrame);
    }
  }

  private isEnabled(): boolean {
    return this.appFitText !== false;
  }

  private scheduleFit(): void {
    if (this.scheduledFrame != null) {
      return;
    }
    this.scheduledFrame = requestAnimationFrame(() => {
      this.scheduledFrame = null;
      this.fit();
    });
  }

  private fit(): void {
    const element = this.elementRef.nativeElement;
    element.style.removeProperty('font-size');
    if (!this.isEnabled() || this.fits(element)) {
      return;
    }
    const largest = parseFloat(getComputedStyle(element).fontSize);
    let low = Math.min(FitTextDirective.MIN_FONT_SIZE_IN_PX, largest);
    let high = largest;
    for (let i = 0; i < FitTextDirective.SEARCH_STEPS; i++) {
      const size = (low + high) / 2;
      this.setFontSize(element, size);
      if (this.fits(element)) {
        low = size;
      } else {
        high = size;
      }
    }
    this.setFontSize(element, low);
  }

  private setFontSize(element: HTMLElement, size: number): void {
    // important, since some stylesheets (e.g. of Material buttons) set the font size with !important
    element.style.setProperty('font-size', size + 'px', 'important');
  }

  private fits(element: HTMLElement): boolean {
    return element.scrollHeight <= element.clientHeight + 1 && element.scrollWidth <= element.clientWidth + 1;
  }
}
