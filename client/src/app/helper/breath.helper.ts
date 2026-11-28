/**
 * The waiting screen's logo breathes (scale 1 → 1.06, opacity 0.9 → 1 and back, ease-in-out, 2.4 s), but cheaply for
 * the box's Pi: each frame of a running animation is a whole frame for Chromium's compositor and GPU process, which
 * with a CSS animation at the display's 60 frames a second kept the idle box at 78 °C. So it breathes at 25 frames a
 * second, and only for a minute after the screen changed; then it rests until the next change.
 */
export class BreathHelper {
  /** One breath, from rest to full and back */
  public static readonly BREATH_MS = 2400;
  /** How often the logo changes while it breathes */
  public static readonly FPS = 25;
  /** How long it breathes after the screen changed */
  public static readonly BREATHE_FOR_MS = 60_000;

  /** CSS's ease-in-out */
  private static readonly easeInOut = BreathHelper.cubicBezier(0.42, 0, 0.58, 1);

  private constructor() {
    // avoid instantiation
  }

  /** CSS's cubic-bezier(x1, y1, x2, y2) timing function: time share → progress */
  public static cubicBezier(x1: number, y1: number, x2: number, y2: number): (x: number) => number {
    const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
    return x => {
      if (x <= 0 || x >= 1) {
        return Math.min(1, Math.max(0, x));
      }
      // x(t) rises monotonically for 0 ≤ x1, x2 ≤ 1: bisection finds t
      let lo = 0;
      let hi = 1;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (at(x1, x2, mid) < x) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
      return at(y1, y2, (lo + hi) / 2);
    };
  }

  /**
   * One breath as keyframes sampled `fps` times a second, each held until the next ("step-end"), so the compositor
   * draws a new frame only that often. Ease-in-out up in the first half, down in the second; the last keyframe is the
   * rest state, which the logo's own style has to match.
   */
  public static keyframes(fps = BreathHelper.FPS): Keyframe[] {
    const n = Math.max(2, Math.round((BreathHelper.BREATH_MS / 1000) * fps));
    const round = (v: number) => Math.round(v * 10000) / 10000;
    return Array.from({length: n + 1}, (_, i) => {
      const phase = i / n;
      const x = phase < 0.5 ? BreathHelper.easeInOut(phase * 2) : 1 - BreathHelper.easeInOut(phase * 2 - 1);
      return {offset: phase, transform: `scale(${round(1 + 0.06 * x)})`, opacity: round(0.9 + 0.1 * x), easing: 'step-end'};
    });
  }

  /** Lets `el` breathe for BREATHE_FOR_MS, from the start again if it already does (`previous`) */
  public static breathe(el: Element, previous?: Animation): Animation {
    previous?.cancel();
    return el.animate(BreathHelper.keyframes(), {
      duration: BreathHelper.BREATH_MS,
      iterations: Math.round(BreathHelper.BREATHE_FOR_MS / BreathHelper.BREATH_MS)
    });
  }
}
