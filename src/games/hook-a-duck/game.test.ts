import { describe, expect, it } from 'vitest';
import {
  CASTS,
  CATCH_RADIUS,
  DUCK_POINTS,
  HOOK_REST_Y,
  cast,
  createState,
  duckPosition,
  duckUnderHook,
  step,
  type HookADuckState,
} from './game';

/** Steps until the hook is back at rest, a little at a time. */
function finishCast(state: HookADuckState) {
  for (let i = 0; i < 200 && state.hook.phase !== 'idle'; i++) step(state, 0.02);
}

/** A state with one still duck, so a cast lands exactly where the test says. */
function oneDuck(points: number): HookADuckState {
  const state = createState();
  state.ducks = [{ angle: Math.PI / 2, points }];
  return state;
}

describe('hook a duck', () => {
  it('starts with every cast left and no score', () => {
    const state = createState();
    expect(state.casts).toBe(CASTS);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.ducks).toHaveLength(DUCK_POINTS.length);
    expect(state.hook.y).toBe(HOOK_REST_Y);
  });

  it('floats the ducks round the stream', () => {
    const state = createState();
    const before = duckPosition(state.ducks[0]);
    step(state, 0.5);
    expect(duckPosition(state.ducks[0])).not.toEqual(before);
  });

  it('uses one cast each time the hook goes down', () => {
    const state = createState();
    expect(cast(state, 400, 300)).toBe(true);
    expect(state.casts).toBe(CASTS - 1);
    expect(state.hook.phase).toBe('lowering');
  });

  it('cannot cast again while the hook is still out', () => {
    const state = createState();
    cast(state, 400, 300);
    expect(cast(state, 200, 300)).toBe(false);
    expect(state.casts).toBe(CASTS - 1);
  });

  it('scores the number on a hooked duck', () => {
    const state = oneDuck(50);
    const { x, y } = duckPosition(state.ducks[0]);
    cast(state, x, y);
    state.hook.y = y;
    step(state, 0);
    expect(state.score).toBe(50);
    expect(state.hook.caught?.points).toBe(50);
    expect(state.ducks).toHaveLength(0);
  });

  it('puts a caught duck back in the stream once the hook is up', () => {
    const state = oneDuck(20);
    const { x, y } = duckPosition(state.ducks[0]);
    cast(state, x, y);
    state.hook.y = y;
    step(state, 0);
    finishCast(state);
    expect(state.hook.caught).toBeNull();
    expect(state.ducks.map((d) => d.points)).toEqual([20]);
  });

  it('scores nothing when the hook misses', () => {
    const state = oneDuck(100);
    const { x, y } = duckPosition(state.ducks[0]);
    cast(state, x + CATCH_RADIUS * 3, y);
    state.hook.y = y;
    step(state, 0);
    expect(state.score).toBe(0);
    expect(state.hook.caught).toBeNull();
  });

  it('only catches a duck close to the hook', () => {
    const state = oneDuck(10);
    const { x, y } = duckPosition(state.ducks[0]);
    Object.assign(state.hook, { x: x + CATCH_RADIUS - 1, y });
    expect(duckUnderHook(state)?.points).toBe(10);
    Object.assign(state.hook, { x: x + CATCH_RADIUS + 1, y });
    expect(duckUnderHook(state)).toBeUndefined();
  });

  it('ends the round once the last cast is back up', () => {
    const state = createState();
    state.casts = 1;
    cast(state, 400, 300);
    step(state, 0.02);
    expect(state.phase).toBe('playing');
    finishCast(state);
    expect(state.phase).toBe('over');
    expect(cast(state, 400, 300)).toBe(false);
  });
});
