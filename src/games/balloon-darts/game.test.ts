import { describe, expect, it } from 'vitest';
import {
  BOARD,
  DARTS_PER_ROUND,
  GOLD_POINTS,
  BALLOON_POINTS,
  balloonAt,
  createState,
  step,
  throwDart,
  toScreen,
  type Balloon,
} from './game';

const balloons: Balloon[] = [
  { angle: 0, distance: 150, gold: false, popped: false },
  { angle: Math.PI / 2, distance: 150, gold: true, popped: false },
];

describe('balloon darts', () => {
  it('starts with a full quiver, some gold balloons and no score', () => {
    const state = createState();
    expect(state.dartsLeft).toBe(DARTS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.balloons.some((b) => b.gold)).toBe(true);
    expect(state.balloons.filter((b) => b.gold).length).toBeLessThan(state.balloons.length / 2);
  });

  it('finds the balloon under a dart on an unturned board', () => {
    expect(balloonAt(balloons, 0, BOARD.x + 150, BOARD.y)).toBe(0);
    expect(balloonAt(balloons, 0, BOARD.x + 160, BOARD.y + 8)).toBe(0);
  });

  it('finds the balloon that the turning board has carried under the dart', () => {
    // A quarter turn carries balloon 0 to where balloon 1 started.
    expect(balloonAt(balloons, Math.PI / 2, BOARD.x, BOARD.y + 150)).toBe(0);
    expect(balloonAt(balloons, Math.PI / 2, BOARD.x + 150, BOARD.y)).toBe(-1);
  });

  it('misses when a dart lands on the board between balloons', () => {
    const between = toScreen(0, Math.PI / 4, 150);
    expect(balloonAt(balloons, 0, between.x, between.y)).toBe(-1);
    expect(balloonAt(balloons, 0, BOARD.x, BOARD.y)).toBe(-1);
  });

  it('misses between balloons on the real board too', () => {
    const state = createState();
    const outerGap = toScreen(0, Math.PI / 12, 150);
    const ringGap = toScreen(0, 0, 112);
    expect(balloonAt(state.balloons, 0, outerGap.x, outerGap.y)).toBe(-1);
    expect(balloonAt(state.balloons, 0, ringGap.x, ringGap.y)).toBe(-1);
  });

  it('ignores popped balloons', () => {
    const popped = balloons.map((b) => ({ ...b, popped: true }));
    expect(balloonAt(popped, 0, BOARD.x + 150, BOARD.y)).toBe(-1);
  });

  it('pops a balloon and scores 10, or 50 for gold', () => {
    const state = createState();
    state.balloons = balloons.map((b) => ({ ...b }));
    expect(throwDart(state, BOARD.x + 150, BOARD.y)).toBe(BALLOON_POINTS);
    expect(throwDart(state, BOARD.x, BOARD.y + 150)).toBe(GOLD_POINTS);
    expect(state.score).toBe(BALLOON_POINTS + GOLD_POINTS);
    expect(state.balloons.every((b) => b.popped)).toBe(true);
  });

  it('scores 0 for a dart between balloons but still uses it up', () => {
    const state = createState();
    expect(throwDart(state, BOARD.x, BOARD.y)).toBe(0);
    expect(state.score).toBe(0);
    expect(state.dartsLeft).toBe(DARTS_PER_ROUND - 1);
    expect(state.darts).toHaveLength(1);
  });

  it('ends the round after the last dart', () => {
    const state = createState();
    for (let i = 0; i < DARTS_PER_ROUND; i++) throwDart(state, BOARD.x, BOARD.y);
    expect(state.phase).toBe('over');
    expect(throwDart(state, BOARD.x, BOARD.y)).toBeNull();
  });

  it('ends the round early when every balloon pops', () => {
    const state = createState();
    state.balloons = [{ ...balloons[0] }];
    throwDart(state, BOARD.x + 150, BOARD.y);
    expect(state.phase).toBe('over');
    expect(state.dartsLeft).toBe(DARTS_PER_ROUND - 1);
  });

  it('spins the board at a steady speed while playing, and stops when the round ends', () => {
    const state = createState();
    step(state, 0.5);
    const half = state.boardAngle;
    step(state, 0.5);
    expect(half).toBeGreaterThan(0);
    expect(state.boardAngle).toBeCloseTo(half * 2);
    state.phase = 'over';
    step(state, 0.5);
    expect(state.boardAngle).toBeCloseTo(half * 2);
  });
});
