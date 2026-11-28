import {BreathHelper} from './breath.helper';

describe('BreathHelper', () => {
  const kf = BreathHelper.keyframes();

  it('has one keyframe per frame at 25 fps, each held until the next', () => {
    expect(kf.length).toBe(61);
    expect(kf.every(k => k.easing === 'step-end')).toBeTrue();
    expect(kf[0].offset).toBe(0);
    expect(kf[60].offset).toBe(1);
  });

  it('goes from rest to full at half time and back, as the CSS animation did', () => {
    expect(kf[0]).toEqual(jasmine.objectContaining({transform: 'scale(1)', opacity: 0.9}));
    expect(kf[60]).toEqual(jasmine.objectContaining({transform: 'scale(1)', opacity: 0.9}));
    expect(kf[30]).toEqual(jasmine.objectContaining({offset: 0.5, transform: 'scale(1.06)', opacity: 1}));
    expect(kf[10].opacity as number).toBeCloseTo(kf[50].opacity as number, 4);
  });

  it('eases in and out: slow at the ends, fast in the middle', () => {
    const op = kf.map(k => k.opacity as number);
    expect(op[1] - op[0]).toBeLessThan(op[16] - op[15]);
    expect(op[30] - op[29]).toBeLessThan(op[16] - op[15]);
  });

  it('matches CSS ease-in-out', () => {
    const ease = BreathHelper.cubicBezier(0.42, 0, 0.58, 1);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(0.5)).toBeCloseTo(0.5, 6);
    expect(ease(0.25)).toBeCloseTo(0.1291, 3);
  });

  it('breathes for a minute, and starts over when asked again', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const first = BreathHelper.breathe(el);
    expect(first.effect!.getComputedTiming().endTime).toBe(60_000);
    const second = BreathHelper.breathe(el, first);
    expect(first.playState).toBe('idle');
    expect(el.getAnimations()).toEqual([second]);
    second.cancel();
    el.remove();
  });
});
