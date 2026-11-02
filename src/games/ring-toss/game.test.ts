import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIME,
  NECK_RADIUS,
  RINGS_PER_ROUND,
  THROWER,
  WOBBLE,
  bottleAt,
  createState,
  landingPoint,
  ringPosition,
  step,
  toss,
  wobble,
} from './game';

describe('ring toss', () => {
  it('starts with a full set of rings, a grid of bottles and no score', () => {
    const state = createState();
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.bottles).toHaveLength(15);
  });

  it('scores bottles further back higher than bottles in front', () => {
    const { bottles } = createState();
    const back = bottles.reduce((a, b) => (b.y < a.y ? b : a));
    const front = bottles.reduce((a, b) => (b.y > a.y ? b : a));
    expect(back.points).toBeGreaterThan(front.points);
  });

  it('uses one ring per toss', () => {
    const state = createState();
    expect(toss(state, 400, 100)).toBe(true);
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND - 1);
    expect(state.rings).toHaveLength(1);
  });

  it('cannot toss once the rings run out', () => {
    const state = createState();
    state.ringsLeft = 0;
    expect(toss(state, 400, 100)).toBe(false);
    expect(state.rings).toHaveLength(0);
  });

  it('sways the landing point by the hand wobble, never more than WOBBLE', () => {
    const state = createState();
    state.time = 1.3;
    toss(state, 400, 100);
    expect(state.rings[0].toX).toBeCloseTo(400 + wobble(1.3));
    for (let t = 0; t < 5; t += 0.1) expect(Math.abs(wobble(t))).toBeLessThanOrEqual(WOBBLE);
  });

  it('lands the ring where the preview shows, even when aiming below the hand', () => {
    const state = createState();
    state.time = 0.7;
    const preview = landingPoint(state, 400, 490);
    expect(preview.y).toBe(THROWER.y - 1);
    toss(state, 400, 490);
    expect(state.rings[0].toX).toBe(preview.x);
    expect(state.rings[0].toY).toBe(preview.y);
  });

  it('scores a ring that lands on a bottle neck', () => {
    const state = createState();
    const bottle = state.bottles[0];
    state.rings = [{ fromX: 400, fromY: 470, toX: bottle.x, toY: bottle.y, age: 0 }];
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(bottle.points);
    expect(bottle.rings).toBe(1);
    expect(state.rings).toHaveLength(0);
  });

  it('does not score a ring that misses every neck', () => {
    const state = createState();
    state.rings = [{ fromX: 400, fromY: 470, toX: 5, toY: 400, age: 0 }];
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(0);
    expect(state.misses).toHaveLength(1);
  });

  it('only scores once the ring has landed', () => {
    const state = createState();
    const bottle = state.bottles[0];
    state.rings = [{ fromX: 400, fromY: 470, toX: bottle.x, toY: bottle.y, age: 0 }];
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(0);
    expect(state.rings).toHaveLength(1);
  });

  it('finds a neck inside NECK_RADIUS and nothing just outside it', () => {
    const state = createState();
    const bottle = state.bottles[7];
    expect(bottleAt(state, bottle.x + NECK_RADIUS - 1, bottle.y)).toBe(bottle);
    expect(bottleAt(state, bottle.x + NECK_RADIUS + 1, bottle.y)).toBeUndefined();
  });

  it('flies from the hand to the landing point', () => {
    const ring = { fromX: THROWER.x, fromY: THROWER.y, toX: 200, toY: 120, age: 0 };
    expect(ringPosition(ring)).toEqual({ x: THROWER.x, y: THROWER.y });
    const landed = ringPosition({ ...ring, age: FLIGHT_TIME });
    expect(landed.x).toBeCloseTo(200);
    expect(landed.y).toBeCloseTo(120);
  });

  it('ends the round when the rings run out and the last ring has landed', () => {
    const state = createState();
    state.ringsLeft = 0;
    state.rings = [{ fromX: 400, fromY: 470, toX: 5, toY: 400, age: 0 }];
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('playing');
    step(state, FLIGHT_TIME);
    expect(state.phase).toBe('over');
  });
});
