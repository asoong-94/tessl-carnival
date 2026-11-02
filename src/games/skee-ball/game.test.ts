import { describe, expect, it } from 'vitest';
import {
  BALLS_PER_ROUND,
  MIN_POWER,
  POCKET_POINTS,
  ROLL_TIME,
  createState,
  landingFor,
  release,
  setAim,
  startCharge,
  step,
} from './game';

describe('skee-ball', () => {
  it('starts with a full rack of balls and no score', () => {
    const state = createState();
    expect(state.balls).toBe(BALLS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('drops a ball with too little power in the gutter for 0 points', () => {
    expect(landingFor(0, 0)).toMatchObject({ kind: 'gutter', points: 0 });
    expect(landingFor(0, MIN_POWER - 0.01)).toMatchObject({ kind: 'gutter', points: 0 });
  });

  it('lands a straight ball with middle power in the 50 ring', () => {
    expect(landingFor(0, 0.6)).toMatchObject({ kind: 'ring', points: 50 });
  });

  it('scores lower rings further from the centre', () => {
    expect(landingFor(0, 0.5).points).toBe(40);
    expect(landingFor(0, 0.4).points).toBe(30);
    expect(landingFor(0, 0.3).points).toBe(20);
    expect(landingFor(0, 0.25).points).toBe(10);
  });

  it('scores 100 in either corner pocket', () => {
    expect(landingFor(-0.88, 0.94)).toMatchObject({ kind: 'pocket', points: POCKET_POINTS });
    expect(landingFor(0.88, 0.94)).toMatchObject({ kind: 'pocket', points: POCKET_POINTS });
  });

  it('scores 0 on the board outside every ring and pocket', () => {
    expect(landingFor(-1, 0.3)).toMatchObject({ kind: 'miss', points: 0 });
  });

  it('charges power while held and rolls on release', () => {
    const state = createState();
    setAim(state, 0);
    expect(startCharge(state)).toBe(true);
    step(state, 0.5);
    expect(state.power).toBeCloseTo(0.4);
    expect(release(state)).toBe(true);
    expect(state.balls).toBe(BALLS_PER_ROUND - 1);
    step(state, ROLL_TIME);
    expect(state.score).toBe(landingFor(0, 0.4).points);
    expect(state.roll).toBeNull();
  });

  it('cannot roll another ball while one is on the ramp', () => {
    const state = createState();
    startCharge(state);
    release(state);
    expect(startCharge(state)).toBe(false);
  });

  it('ends the round after the last ball lands', () => {
    const state = createState();
    for (let i = 0; i < BALLS_PER_ROUND; i++) {
      expect(state.phase).toBe('playing');
      startCharge(state);
      release(state);
      step(state, ROLL_TIME);
    }
    expect(state.balls).toBe(0);
    expect(state.phase).toBe('over');
    expect(startCharge(state)).toBe(false);
  });
});
