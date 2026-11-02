import { describe, expect, it } from 'vitest';
import {
  FINISH_BONUS,
  GRAVITY,
  GROUND_HEIGHT,
  JUMP_SPEED,
  LEVEL_LENGTH,
  MAX_FALL_SPEED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  ROWS,
  RUN_SPEED,
  TICKET_POINTS,
  TILE,
  applyGravity,
  applyJump,
  applyRun,
  collectTickets,
  createPlayer,
  createRng,
  createState,
  generateLevel,
  isReachable,
  moveAndCollide,
  scoreFor,
  step,
  surfaceY,
  type Body,
  type Level,
  type Player,
  type Tile,
} from './game';

const SEEDS = [1, 2, 3, 42, 99, 1234, 2026, 31337, 65535, 987654321];
const idle = { left: false, right: false, jump: false };

/** A level from rows of text: `#` brick, `=` ground, anything else empty. */
function levelFrom(rows: string[]): Level {
  const padded = [...Array.from({ length: ROWS - rows.length }, () => ''), ...rows];
  const width = Math.max(...rows.map((r) => r.length));
  const tiles = padded.map((row) =>
    Array.from({ length: width }, (_, c): Tile => {
      const ch = row[c];
      return ch === '#' ? 'brick' : ch === '=' ? 'ground' : 'empty';
    }),
  );
  return { seed: 0, width, tiles, route: [], tickets: [], exitX: 1e9, startX: 0, startY: 0 };
}

function body(x: number, y: number, vx = 0, vy = 0): Body {
  return { x, y, width: PLAYER_WIDTH, height: PLAYER_HEIGHT, vx, vy, onGround: false };
}

function player(x: number, y: number, onGround = true): Player {
  return { ...body(x, y), onGround, jumpHeld: false };
}

describe('seeded random numbers', () => {
  it('repeats for the same seed and differs for another', () => {
    const a = createRng(7);
    const b = createRng(7);
    const c = createRng(8);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
    for (const n of first) {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    }
  });
});

describe('level generation', () => {
  it('builds the same level from the same seed', () => {
    for (const seed of SEEDS) expect(generateLevel(seed)).toEqual(generateLevel(seed));
  });

  it('builds different levels from different seeds', () => {
    expect(generateLevel(1).tiles).not.toEqual(generateLevel(2).tiles);
  });

  it('keeps every gap and platform step within jump reach', () => {
    for (const seed of SEEDS) {
      const { route } = generateLevel(seed);
      for (let i = 1; i < route.length; i++) {
        expect(isReachable(route[i - 1], route[i]), `seed ${seed}, step ${i}`).toBe(true);
      }
    }
  });

  it('has gaps, bricks, crates and tickets, and runs to the exit tent', () => {
    for (const seed of SEEDS) {
      const level = generateLevel(seed);
      const tiles = level.tiles.flat();
      expect(tiles).toContain('brick');
      expect(tiles).toContain('crate');
      expect(level.tiles[ROWS - 1]).toContain('empty');
      expect(level.tickets.length).toBeGreaterThan(0);
      expect(level.width).toBeGreaterThanOrEqual(LEVEL_LENGTH);
      expect(level.route[0].start).toBe(0);
      expect(level.route.at(-1)!.end).toBe(level.width - 1);
      expect(level.exitX).toBeGreaterThan(level.route.at(-1)!.start * TILE);
    }
  });

  it('puts every route surface on solid tiles with open space above', () => {
    for (const seed of SEEDS) {
      const level = generateLevel(seed);
      for (const s of level.route) {
        for (let c = s.start; c <= s.end; c++) {
          expect(level.tiles[ROWS - s.top][c], `seed ${seed}, col ${c}`).not.toBe('empty');
          expect(level.tiles[ROWS - s.top - 1][c], `seed ${seed}, col ${c}`).toBe('empty');
        }
      }
    }
  });

  it('starts the acrobat standing on the ground', () => {
    const level = generateLevel(5);
    expect(level.startY + PLAYER_HEIGHT).toBe((ROWS - GROUND_HEIGHT) * TILE);
  });
});

describe('jump reach', () => {
  it('cannot reach a gap wider than a jump carries', () => {
    const from = { start: 0, end: 4, top: 2 };
    expect(isReachable(from, { start: 6, end: 9, top: 2 })).toBe(true);
    expect(isReachable(from, { start: 20, end: 24, top: 2 })).toBe(false);
    expect(isReachable(from, { start: 6, end: 9, top: 10 })).toBe(false);
  });
});

describe('movement', () => {
  it('runs left and right, and stands still with neither or both', () => {
    const b = body(0, 0);
    applyRun(b, { ...idle, right: true });
    expect(b.vx).toBe(RUN_SPEED);
    applyRun(b, { ...idle, left: true });
    expect(b.vx).toBe(-RUN_SPEED);
    applyRun(b, { ...idle, left: true, right: true });
    expect(b.vx).toBe(0);
    applyRun(b, idle);
    expect(b.vx).toBe(0);
  });

  it('jumps only from the ground, once per press', () => {
    const p = player(0, 0);
    expect(applyJump(p, { ...idle, jump: true })).toBe(true);
    expect(p.vy).toBe(-JUMP_SPEED);
    p.onGround = true;
    expect(applyJump(p, { ...idle, jump: true })).toBe(false);
    applyJump(p, idle);
    const air = player(0, 0, false);
    expect(applyJump(air, { ...idle, jump: true })).toBe(false);
  });
});

describe('gravity', () => {
  it('pulls down and caps the falling speed', () => {
    const b = body(0, 0);
    applyGravity(b, false, 0.1);
    expect(b.vy).toBeCloseTo(GRAVITY * 0.1);
    b.vy = MAX_FALL_SPEED;
    applyGravity(b, false, 0.1);
    expect(b.vy).toBe(MAX_FALL_SPEED);
  });

  it('jumps higher while jump is held', () => {
    const level = levelFrom(['====']);
    const peak = (hold: boolean) => {
      const p = player(TILE, (ROWS - 1) * TILE - PLAYER_HEIGHT);
      let top = p.y;
      applyJump(p, { ...idle, jump: true });
      p.jumpHeld = hold;
      for (let i = 0; i < 120; i++) {
        applyGravity(p, hold, 1 / 120);
        moveAndCollide(level, p, 1 / 120);
        top = Math.min(top, p.y);
      }
      return top;
    };
    expect(peak(true)).toBeLessThan(peak(false));
  });
});

describe('collision with bricks', () => {
  const level = levelFrom([
    '..........',
    '....#.....',
    '..........',
    '..........',
    '......#...',
    '......#...',
    '==========',
  ]);
  const floorY = (ROWS - 1) * TILE;

  it('lands on top of a tile', () => {
    const b = body(TILE, floorY - PLAYER_HEIGHT - 5, 0, 600);
    const contact = moveAndCollide(level, b, 0.05);
    expect(contact.landed).toBe(true);
    expect(b.y + b.height).toBe(floorY);
    expect(b.vy).toBe(0);
    expect(b.onGround).toBe(true);
  });

  it('stays standing on the tile below', () => {
    const b = body(TILE, floorY - PLAYER_HEIGHT);
    const contact = moveAndCollide(level, b, 0.05);
    expect(contact.landed).toBe(false);
    expect(b.onGround).toBe(true);
    expect(b.y + b.height).toBe(floorY);
  });

  it('bumps its head on the underside of a brick', () => {
    const brickBottom = (ROWS - 6 + 1) * TILE;
    const b = body(4 * TILE + 4, brickBottom + 4, 0, -600);
    const contact = moveAndCollide(level, b, 0.05);
    expect(contact.bumpedHead).toBe(true);
    expect(b.y).toBe(brickBottom);
    expect(b.vy).toBe(0);
  });

  it('stops at the side of a brick', () => {
    const b = body(6 * TILE - PLAYER_WIDTH - 2, floorY - PLAYER_HEIGHT, RUN_SPEED, 0);
    const contact = moveAndCollide(level, b, 0.05);
    expect(contact.hitSide).toBe(true);
    expect(b.x + b.width).toBe(6 * TILE);
    expect(b.vx).toBe(0);

    const fromRight = body(7 * TILE + 2, floorY - PLAYER_HEIGHT, -RUN_SPEED, 0);
    expect(moveAndCollide(level, fromRight, 0.05).hitSide).toBe(true);
    expect(fromRight.x).toBe(7 * TILE);
  });

  it('falls where there is no tile below', () => {
    const pit = levelFrom(['==..==']);
    const b = body(2 * TILE + 4, (ROWS - 1) * TILE - PLAYER_HEIGHT, 0, 100);
    moveAndCollide(pit, b, 0.05);
    expect(b.onGround).toBe(false);
    expect(b.y + b.height).toBeGreaterThan((ROWS - 1) * TILE);
  });
});

describe('a round', () => {
  it('starts with no score, standing at the start', () => {
    const state = createState(3);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.player).toEqual(createPlayer(state.level));
  });

  it('scores 10 a ticket, 1 a tile and 200 for finishing', () => {
    expect(scoreFor(3, 40, false)).toBe(3 * TICKET_POINTS + 40);
    expect(scoreFor(3, 40, true)).toBe(3 * TICKET_POINTS + 40 + FINISH_BONUS);
  });

  it('collects a ticket the acrobat touches, once', () => {
    const state = createState(3);
    const { player: p } = state;
    state.level.tickets = [{ x: p.x + 5, y: p.y + 5, collected: false }];
    expect(collectTickets(state)).toBe(1);
    expect(collectTickets(state)).toBe(0);
    expect(state.tickets).toBe(1);
  });

  it('scores distance as the acrobat runs', () => {
    const state = createState(3);
    step(state, { ...idle, right: true }, 0.5);
    expect(state.distance).toBe(Math.floor((RUN_SPEED * 0.5) / TILE));
    expect(state.score).toBe(scoreFor(state.tickets, state.distance, false));
  });

  it('ends the run when the acrobat falls into a gap', () => {
    const state = createState(3);
    state.level.tiles[ROWS - 1].fill('empty');
    state.level.tiles[ROWS - 2].fill('empty');
    for (let i = 0; i < 40 && state.phase === 'playing'; i++) step(state, idle, 0.05);
    expect(state.phase).toBe('over');
    expect(state.finished).toBe(false);
  });

  it('ends the round with the bonus at the exit tent', () => {
    const state = createState(3);
    state.player.x = state.level.exitX - TILE;
    state.player.y = (ROWS - GROUND_HEIGHT) * TILE - PLAYER_HEIGHT;
    step(state, { ...idle, right: true }, 0.2);
    expect(state.phase).toBe('over');
    expect(state.finished).toBe(true);
    expect(state.score).toBe(scoreFor(state.tickets, state.distance, true));
  });

  it('can be finished by running and jumping along the route', () => {
    for (const seed of SEEDS) {
      const state = createState(seed);
      const { route } = state.level;
      let target = route[0];
      // Run right. Near the end of each surface, make a full jump for the next
      // one, and stop running once over it so the acrobat drops onto it.
      for (let t = 0; t < 60 && state.phase === 'playing'; t += 1 / 60) {
        const p = state.player;
        const feet = p.y + p.height;
        const here = route.find(
          (s) =>
            p.x + p.width > s.start * TILE && p.x < (s.end + 1) * TILE && feet === surfaceY(s.top),
        );
        let jump = false;
        let right = true;
        if (p.onGround && here) {
          const next = route[route.indexOf(here) + 1];
          const needed = next && (next.top > here.top || next.start > here.end + 1);
          if (needed && p.x + p.width >= (here.end + 1) * TILE - 4) {
            target = next;
            jump = true;
          }
        } else if (!p.onGround) {
          jump = p.vy < 0;
          right = p.x + p.width / 2 < (target.start + 0.5) * TILE;
        }
        step(state, { left: false, right, jump }, 1 / 60);
      }
      expect(state.finished, `seed ${seed}`).toBe(true);
    }
  });
});
