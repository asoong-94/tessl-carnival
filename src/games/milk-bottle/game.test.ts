import { describe, expect, it } from 'vitest';
import {
  BALLS,
  CLEAR_BONUS,
  FLIGHT_TIME,
  POINTS_PER_BOTTLE,
  bottlesKnockedDown,
  createBottles,
  createState,
  powerFor,
  rowFor,
  scoreFor,
  step,
  throwBall,
  type Bottle,
} from './game';

// Powers in the middle of each row's band.
const BOTTOM = 0.35;
const MIDDLE = 0.6;
const TOP = 0.85;
// Aims straight at a bottle on the bottom row: 60 px apart, 200 px of aim range.
const LEFT = -0.3;
const CENTRE = 0;
const RIGHT = 0.3;

const ids = (bottles: Bottle[]) => bottles.map((b) => `${b.row}:${b.index}`).sort();

function knockOver(bottles: Bottle[], ...keys: string[]) {
  for (const b of bottles) if (keys.includes(`${b.row}:${b.index}`)) b.standing = false;
}

describe('milk bottle knockdown', () => {
  it('starts with a pyramid of six bottles: three, two, then one', () => {
    const state = createState();
    expect(state.bottles.filter((b) => b.row === 0)).toHaveLength(3);
    expect(state.bottles.filter((b) => b.row === 1)).toHaveLength(2);
    expect(state.bottles.filter((b) => b.row === 2)).toHaveLength(1);
    expect(state.bottles.every((b) => b.standing)).toBe(true);
    expect(state.ballsLeft).toBe(BALLS);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('maps power to the row the ball reaches, missing when too soft or too hard', () => {
    expect(rowFor(0.1)).toBeUndefined();
    expect(rowFor(BOTTOM)).toBe(0);
    expect(rowFor(MIDDLE)).toBe(1);
    expect(rowFor(TOP)).toBe(2);
    expect(rowFor(1)).toBeUndefined();
  });

  it('charges power up to full and back down while held', () => {
    expect(powerFor(0)).toBe(0);
    expect(powerFor(0.5)).toBeCloseTo(0.5);
    expect(powerFor(1)).toBe(1);
    expect(powerFor(1.25)).toBeCloseTo(0.75);
  });

  it('knocks over the bottle the ball hits', () => {
    const bottles = createBottles();
    expect(ids(bottlesKnockedDown(bottles, LEFT, BOTTOM))).toEqual(['0:0']);
    expect(ids(bottlesKnockedDown(bottles, CENTRE, TOP))).toEqual(['2:0']);
  });

  it('knocks over nothing when the throw misses', () => {
    const bottles = createBottles();
    expect(bottlesKnockedDown(bottles, -1, BOTTOM)).toEqual([]);
    expect(bottlesKnockedDown(bottles, CENTRE, 0.05)).toEqual([]);
    expect(bottlesKnockedDown(bottles, CENTRE, 1)).toEqual([]);
  });

  it('knocks over two bottles when aimed between them', () => {
    const bottles = createBottles();
    expect(ids(bottlesKnockedDown(bottles, CENTRE, MIDDLE))).toEqual(['1:0', '1:1', '2:0']);
  });

  it('drops a bottle once nothing is left under it', () => {
    const bottles = createBottles();
    knockOver(bottles, '0:0');
    // The middle-left bottle still rests on the bottom-centre bottle until that falls.
    expect(ids(bottlesKnockedDown(bottles, CENTRE, BOTTOM))).toEqual(['0:1', '1:0']);
  });

  it('lets a fall carry up the pyramid', () => {
    const bottles = createBottles();
    knockOver(bottles, '0:0', '0:2', '1:1');
    // Bottom-centre holds up middle-left, which holds up the top bottle.
    expect(ids(bottlesKnockedDown(bottles, CENTRE, BOTTOM))).toEqual(['0:1', '1:0', '2:0']);
  });

  it('keeps a bottle up while one bottle under it still stands', () => {
    const bottles = createBottles();
    expect(ids(bottlesKnockedDown(bottles, LEFT, BOTTOM))).not.toContain('1:0');
  });

  it('ignores bottles that are already down', () => {
    const bottles = createBottles();
    knockOver(bottles, '0:2');
    expect(bottlesKnockedDown(bottles, RIGHT, BOTTOM)).toEqual([]);
  });

  it('scores 10 a bottle, and a 50 point bonus for clearing all six', () => {
    const bottles = createBottles();
    knockOver(bottles, '0:0', '0:1');
    expect(scoreFor(bottles)).toBe(2 * POINTS_PER_BOTTLE);
    knockOver(bottles, '0:2', '1:0', '1:1', '2:0');
    expect(scoreFor(bottles)).toBe(6 * POINTS_PER_BOTTLE + CLEAR_BONUS);
  });

  it('knocks bottles over when the ball lands and uses one ball a throw', () => {
    const state = createState();
    expect(throwBall(state, LEFT, BOTTOM)).toBe(true);
    expect(state.ballsLeft).toBe(BALLS - 1);
    expect(throwBall(state, LEFT, BOTTOM)).toBe(false);
    step(state, FLIGHT_TIME / 2);
    expect(state.bottles.every((b) => b.standing)).toBe(true);
    step(state, FLIGHT_TIME);
    expect(state.ball).toBeUndefined();
    expect(state.score).toBe(POINTS_PER_BOTTLE);
  });

  it('clears the pyramid in three balls for 110 points', () => {
    const state = createState();
    for (const aim of [LEFT, CENTRE, RIGHT]) {
      throwBall(state, aim, BOTTOM);
      step(state, FLIGHT_TIME);
    }
    expect(state.bottles.some((b) => b.standing)).toBe(false);
    expect(state.score).toBe(110);
  });

  it('ends the round after the third ball lands', () => {
    const state = createState();
    for (let i = 0; i < BALLS; i++) {
      expect(state.phase).toBe('playing');
      throwBall(state, -1, BOTTOM);
      step(state, FLIGHT_TIME);
    }
    expect(state.phase).toBe('over');
    expect(throwBall(state, CENTRE, BOTTOM)).toBe(false);
  });
});
