import { describe, expect, it } from 'vitest';
import {
  BANKRUPT,
  SLICES,
  SLICE_ANGLE,
  SPINS_PER_ROUND,
  applySlice,
  cancelCharge,
  createState,
  landingSlice,
  release,
  sliceIndexAt,
  spinSpeed,
  startCharge,
  step,
  stopAngle,
} from './game';

/** The start angle that lands a spin of `power` in the middle of slice `index`. */
function startFor(index: number, power: number): number {
  const target = -(index + 0.5) * SLICE_ANGLE;
  return target - stopAngle(0, power);
}

/** Runs one whole spin, holding for `seconds`. */
function spin(state: ReturnType<typeof createState>, seconds: number) {
  startCharge(state);
  step(state, seconds);
  release(state);
  for (let i = 0; i < 10_000 && state.phase === 'spinning'; i++) step(state, 1 / 60);
}

describe('spin the wheel', () => {
  it('has 12 slices with one 100 and one BANKRUPT', () => {
    expect(SLICES).toHaveLength(12);
    expect(SLICES.filter((s) => s === 100)).toHaveLength(1);
    expect(SLICES.filter((s) => s === BANKRUPT)).toHaveLength(1);
    for (const points of [5, 10, 20, 50]) expect(SLICES).toContain(points);
  });

  it('starts ready with five spins and no score', () => {
    const state = createState();
    expect(state.spinsLeft).toBe(SPINS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('ready');
  });

  it('puts the first slice under the pointer at angle 0', () => {
    expect(sliceIndexAt(0)).toBe(0);
    expect(sliceIndexAt(-SLICE_ANGLE * 1.5)).toBe(1);
    expect(sliceIndexAt(Math.PI * 2 * 3)).toBe(0);
  });

  it('lands on the slice that a start angle and power point to', () => {
    SLICES.forEach((slice, index) => {
      expect(landingSlice(startFor(index, 0.5), 0.5)).toBe(slice);
    });
  });

  it('lands on BANKRUPT for the matching start angle and power', () => {
    const index = SLICES.indexOf(BANKRUPT);
    expect(landingSlice(startFor(index, 0.8), 0.8)).toBe(BANKRUPT);
  });

  it('spins further with more power', () => {
    expect(stopAngle(0, 1)).toBeGreaterThan(stopAngle(0, 0.2));
    expect(spinSpeed(2)).toBe(spinSpeed(1));
    expect(spinSpeed(-1)).toBe(spinSpeed(0));
  });

  it('adds points, and BANKRUPT resets the score to 0', () => {
    expect(applySlice(30, 20)).toBe(50);
    expect(applySlice(120, BANKRUPT)).toBe(0);
  });

  it('charges more the longer the player holds', () => {
    const short = createState();
    startCharge(short);
    step(short, 0.3);
    const long = createState();
    startCharge(long);
    step(long, 1);
    expect(long.charge).toBeGreaterThan(short.charge);
    step(long, 10);
    expect(long.charge).toBe(1);
  });

  it('stops on the slice landingSlice predicts and scores it', () => {
    const state = createState();
    const index = SLICES.indexOf(50);
    state.angle = startFor(index, 1);
    spin(state, 10);
    expect(state.phase).toBe('ready');
    expect(state.lastSlice).toBe(50);
    expect(state.score).toBe(50);
    expect(state.spinsLeft).toBe(SPINS_PER_ROUND - 1);
  });

  it('resets the score when a spin stops on BANKRUPT', () => {
    const state = createState();
    state.score = 80;
    state.angle = startFor(SLICES.indexOf(BANKRUPT), 1);
    spin(state, 10);
    expect(state.lastSlice).toBe(BANKRUPT);
    expect(state.score).toBe(0);
  });

  it('cannot spin again while the wheel is turning', () => {
    const state = createState();
    startCharge(state);
    release(state);
    expect(startCharge(state)).toBe(false);
    expect(release(state)).toBe(false);
  });

  it('only lets the control that started a charge release it', () => {
    const state = createState();
    startCharge(state, 'space');
    expect(release(state, 'pointer')).toBe(false);
    expect(state.phase).toBe('charging');
    expect(release(state, 'space')).toBe(true);
    expect(state.phase).toBe('spinning');
  });

  it('drops a cancelled charge without using a spin', () => {
    const state = createState();
    startCharge(state, 'space');
    step(state, 1);
    expect(cancelCharge(state)).toBe(true);
    expect(state.phase).toBe('ready');
    expect(state.charge).toBe(0);
    expect(state.spinsLeft).toBe(SPINS_PER_ROUND);
    expect(release(state, 'space')).toBe(false);
    expect(startCharge(state, 'space')).toBe(true);
  });

  it('ends the round after the fifth spin', () => {
    const state = createState();
    for (let i = 0; i < SPINS_PER_ROUND - 1; i++) {
      spin(state, 0.5);
      expect(state.phase).toBe('ready');
    }
    spin(state, 0.5);
    expect(state.phase).toBe('over');
    expect(state.spinsLeft).toBe(0);
    expect(startCharge(state)).toBe(false);
  });
});
