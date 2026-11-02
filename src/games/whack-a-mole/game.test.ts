import { describe, expect, it } from 'vitest';
import {
  COLUMNS,
  MOLE_RISE,
  POINTS_PER_WHACK,
  ROUND_TIME,
  ROWS,
  SPAWN_GAP,
  UP_TIME,
  createState,
  popUp,
  spawnGap,
  step,
  upTime,
  whack,
} from './game';

describe('whack-a-mole', () => {
  it('starts with a full clock, no score and every mole down', () => {
    const state = createState();
    expect(state.holes).toHaveLength(COLUMNS * ROWS);
    expect(state.holes.every((h) => h.up === 0)).toBe(true);
    expect(state.timeLeft).toBe(ROUND_TIME);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('pops a mole up from an empty hole', () => {
    const state = createState();
    expect(popUp(state, () => 0)).toBe(true);
    expect(state.holes[0].up).toBe(UP_TIME.start);
  });

  it('does not pop up when every hole is busy', () => {
    const state = createState();
    for (const hole of state.holes) hole.up = 1;
    expect(popUp(state, () => 0)).toBe(false);
  });

  it('scores a whack on a mole that is up and knocks it down', () => {
    const state = createState();
    const hole = state.holes[4];
    hole.up = 1;
    expect(whack(state, hole.x, hole.y - MOLE_RISE)).toBe(true);
    expect(state.score).toBe(POINTS_PER_WHACK);
    expect(hole.up).toBe(0);
  });

  it('scores nothing for whacking an empty hole', () => {
    const state = createState();
    const hole = state.holes[4];
    expect(whack(state, hole.x, hole.y - MOLE_RISE)).toBe(false);
    expect(state.score).toBe(0);
  });

  it('scores a mole only once', () => {
    const state = createState();
    const hole = state.holes[0];
    hole.up = 1;
    whack(state, hole.x, hole.y - MOLE_RISE);
    whack(state, hole.x, hole.y - MOLE_RISE);
    expect(state.score).toBe(POINTS_PER_WHACK);
  });

  it('drops a mole back down when its time is up', () => {
    const state = createState();
    state.nextMole = 10;
    state.holes[0].up = 0.5;
    step(state, 0.6);
    expect(state.holes[0].up).toBe(0);
    expect(whack(state, state.holes[0].x, state.holes[0].y - MOLE_RISE)).toBe(false);
  });

  it('pops moles up faster and for less time as the round goes on', () => {
    const state = createState();
    expect(spawnGap(state)).toBe(SPAWN_GAP.start);
    expect(upTime(state)).toBe(UP_TIME.start);
    state.timeLeft = ROUND_TIME / 2;
    expect(spawnGap(state)).toBeLessThan(SPAWN_GAP.start);
    expect(upTime(state)).toBeLessThan(UP_TIME.start);
    state.timeLeft = 0;
    expect(spawnGap(state)).toBeCloseTo(SPAWN_GAP.end);
    expect(upTime(state)).toBeCloseTo(UP_TIME.end);
  });

  it('ends the round when the clock runs out, and ignores whacks after', () => {
    const state = createState();
    state.holes[0].up = 5;
    step(state, ROUND_TIME + 1);
    expect(state.phase).toBe('over');
    expect(state.timeLeft).toBe(0);
    expect(whack(state, state.holes[0].x, state.holes[0].y - MOLE_RISE)).toBe(false);
  });

  it('keeps playing before the clock runs out', () => {
    const state = createState();
    step(state, ROUND_TIME - 1);
    expect(state.phase).toBe('playing');
  });
});
