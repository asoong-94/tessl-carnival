import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

/** Size of one tile in pixels. Distance is scored per tile. */
export const TILE = 32;
/** Rows in a level, top to bottom. Heights are counted in tiles from the bottom. */
export const ROWS = 15;
export const GROUND_HEIGHT = 2;
/** The level keeps adding features until it is at least this many tiles long. */
export const LEVEL_LENGTH = 150;

export const RUN_SPEED = 240;
export const JUMP_SPEED = 620;
export const GRAVITY = 1800;
/** Letting go of jump while rising makes gravity this much stronger, so short taps jump lower. */
export const RELEASE_GRAVITY = 3;
export const MAX_FALL_SPEED = 900;
/** Physics runs in steps no longer than this, so a fast fall never skips a tile. */
export const MAX_STEP = 1 / 120;

export const TICKET_POINTS = 10;
export const FINISH_BONUS = 200;
export const TICKET_RADIUS = 10;

export const PLAYER_WIDTH = 22;
export const PLAYER_HEIGHT = 40;

export type Tile = 'empty' | 'ground' | 'brick' | 'crate';

/** A surface the route stands on: columns `start` to `end`, with its top `top` tiles up. */
export interface Surface {
  start: number;
  end: number;
  top: number;
}

export interface Ticket {
  x: number;
  y: number;
  collected: boolean;
}

export interface Level {
  seed: number;
  /** Columns across. */
  width: number;
  /** `tiles[row][col]`, with row 0 at the top. */
  tiles: Tile[][];
  /** Every surface the route crosses, left to right. */
  route: Surface[];
  tickets: Ticket[];
  /** Pixel x of the exit tent's door. */
  exitX: number;
  /** Pixel position the acrobat starts at (top-left). */
  startX: number;
  startY: number;
}

export interface Body {
  /** Top-left corner, in pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  onGround: boolean;
}

export interface Player extends Body {
  /** Whether jump was held last step, so holding it doesn't keep jumping. */
  jumpHeld: boolean;
}

export interface Input {
  left: boolean;
  right: boolean;
  jump: boolean;
}

export interface Contact {
  landed: boolean;
  bumpedHead: boolean;
  hitSide: boolean;
}

export interface BigTopRunnerState {
  level: Level;
  player: Player;
  tickets: number;
  /** Tiles run past the start, at the furthest point reached. */
  distance: number;
  finished: boolean;
  score: number;
  phase: 'playing' | 'over';
}

/** A small seeded random number generator (mulberry32). Returns numbers in [0, 1). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pixel y of the top of a surface `top` tiles up. */
export function surfaceY(top: number): number {
  return (ROWS - top) * TILE;
}

/** Builds the level for a seed. The same seed always builds the same level. */
export function generateLevel(seed: number): Level {
  const random = createRng(seed);
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

  const blocks: { start: number; end: number; bottom: number; top: number; tile: Tile }[] = [];
  const route: Surface[] = [];
  const tickets: Ticket[] = [];
  let col = 0;

  const block = (start: number, width: number, bottom: number, top: number, tile: Tile) => {
    blocks.push({ start, end: start + width - 1, bottom, top, tile });
  };
  const surface = (start: number, width: number, top: number) => {
    route.push({ start, end: start + width - 1, top });
  };
  const ticket = (col: number, height: number) => {
    tickets.push({ x: col * TILE, y: surfaceY(height), collected: false });
  };
  /** Tickets floating over a surface, about one and a half tiles up. */
  const ticketsOver = (start: number, width: number, top: number) => {
    for (let c = start; c < start + width; c += 2) ticket(c + 0.5, top + 1.5);
  };
  /** A ticket in the air over a gap, along the arc of a jump. */
  const ticketOverGap = (start: number, width: number, from: number) => {
    ticket(start + width / 2, from + 2.5);
  };
  const ground = (width: number) => {
    block(col, width, 0, GROUND_HEIGHT, 'ground');
    surface(col, width, GROUND_HEIGHT);
    if (random() < 0.4) ticket(col + width / 2, GROUND_HEIGHT + 1.5);
    col += width;
  };

  ground(8);
  while (col < LEVEL_LENGTH) {
    const feature = between(0, 3);
    if (feature === 0) {
      // A gap in the ground.
      const gap = between(1, 3);
      ticketOverGap(col, gap, GROUND_HEIGHT);
      col += gap;
      ground(between(3, 6));
    } else if (feature === 1) {
      // A stack of crates on the ground, one or two high.
      const height = between(1, 2);
      const width = between(1, 2);
      const top = GROUND_HEIGHT + height;
      // The ground carries on under the crates.
      blocks[blocks.length - 1].end += width;
      block(col, width, GROUND_HEIGHT, top, 'crate');
      surface(col, width, top);
      ticketsOver(col, width, top);
      col += width;
      ground(between(3, 5));
    } else if (feature === 2) {
      // A brick platform over a pit, at ground height or up to two tiles higher.
      const top = GROUND_HEIGHT + between(0, 2);
      const width = between(2, 4);
      const gapBefore = between(1, 2);
      const gapAfter = between(1, 2);
      ticketOverGap(col, gapBefore, GROUND_HEIGHT);
      col += gapBefore;
      block(col, width, top - 1, top, 'brick');
      surface(col, width, top);
      ticketsOver(col, width, top);
      col += width;
      ticketOverGap(col, gapAfter, top);
      col += gapAfter;
      ground(between(3, 6));
    } else {
      // A crate to climb, then a floating row of bricks across a pit.
      blocks[blocks.length - 1].end += 2;
      const crateTop = GROUND_HEIGHT + 1;
      block(col, 2, GROUND_HEIGHT, crateTop, 'crate');
      surface(col, 2, crateTop);
      col += 2;
      const top = crateTop + between(1, 2);
      const width = between(3, 6);
      const gapBefore = between(1, 2);
      const gapAfter = between(1, 2);
      ticketOverGap(col, gapBefore, crateTop);
      col += gapBefore;
      block(col, width, top - 1, top, 'brick');
      surface(col, width, top);
      ticketsOver(col, width, top);
      col += width;
      ticketOverGap(col, gapAfter, top);
      col += gapAfter;
      ground(between(3, 6));
    }
  }
  ground(12);

  const width = col;
  const tiles: Tile[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: width }, (): Tile => 'empty'),
  );
  for (const b of blocks) {
    for (let c = b.start; c <= b.end; c++) {
      for (let h = b.bottom + 1; h <= b.top; h++) tiles[ROWS - h][c] = b.tile;
    }
  }

  return {
    seed,
    width,
    tiles,
    route,
    tickets,
    exitX: (width - 5) * TILE,
    startX: 2 * TILE,
    startY: surfaceY(GROUND_HEIGHT) - PLAYER_HEIGHT,
  };
}

/**
 * Whether the tile at a column and row stops the acrobat. The level's left and
 * right ends are walls; above the top and below the bottom are open.
 */
export function isSolid(level: Level, col: number, row: number): boolean {
  if (col < 0 || col >= level.width) return true;
  if (row < 0 || row >= ROWS) return false;
  return level.tiles[row][col] !== 'empty';
}

/**
 * How far, in pixels, a full jump carries the acrobat before it comes back
 * down to `rise` tiles above where it left, or -1 if it never gets that high.
 */
export function jumpReach(rise: number): number {
  const height = rise * TILE;
  const discriminant = JUMP_SPEED ** 2 - 2 * GRAVITY * height;
  if (discriminant < 0) return -1;
  return (RUN_SPEED * (JUMP_SPEED + Math.sqrt(discriminant))) / GRAVITY;
}

/**
 * Whether a full running jump from the end of one surface lands on the next.
 * It allows the acrobat's whole width on top of the gap, to leave some slack.
 */
export function isReachable(from: Surface, to: Surface): boolean {
  const gap = (to.start - from.end - 1) * TILE;
  if (gap <= 0 && to.top <= from.top) return true;
  const reach = jumpReach(to.top - from.top);
  return reach >= 0 && reach >= gap + PLAYER_WIDTH;
}

/** Running: left and right set the speed, and both or neither stand still. */
export function applyRun(body: Body, input: Input): void {
  body.vx = (input.right ? RUN_SPEED : 0) - (input.left ? RUN_SPEED : 0);
}

/** Starts a jump when jump is first pressed on the ground. Returns whether it jumped. */
export function applyJump(player: Player, input: Input): boolean {
  const pressed = input.jump && !player.jumpHeld;
  player.jumpHeld = input.jump;
  if (!pressed || !player.onGround) return false;
  player.vy = -JUMP_SPEED;
  player.onGround = false;
  return true;
}

/** Gravity pulls down, harder while rising without jump held, up to a top falling speed. */
export function applyGravity(body: Body, jumpHeld: boolean, dt: number): void {
  const rising = body.vy < 0;
  const pull = rising && !jumpHeld ? GRAVITY * RELEASE_GRAVITY : GRAVITY;
  body.vy = Math.min(body.vy + pull * dt, MAX_FALL_SPEED);
}

function overlapping(start: number, size: number): [number, number] {
  return [Math.floor(start / TILE), Math.floor((start + size - 0.001) / TILE)];
}

/**
 * Moves a body by its speed for `dt` seconds, across then down, and stops it
 * at solid tiles: landing on top, bumping its head on the underside, or
 * stopping at a side.
 */
export function moveAndCollide(level: Level, body: Body, dt: number): Contact {
  const contact: Contact = { landed: false, bumpedHead: false, hitSide: false };

  body.x += body.vx * dt;
  if (body.vx !== 0) {
    const [top, bottom] = overlapping(body.y, body.height);
    const col = Math.floor((body.vx > 0 ? body.x + body.width - 0.001 : body.x) / TILE);
    for (let row = top; row <= bottom; row++) {
      if (!isSolid(level, col, row)) continue;
      body.x = body.vx > 0 ? col * TILE - body.width : (col + 1) * TILE;
      body.vx = 0;
      contact.hitSide = true;
      break;
    }
  }

  body.y += body.vy * dt;
  body.onGround = false;
  const [left, right] = overlapping(body.x, body.width);
  if (body.vy >= 0) {
    const row = Math.floor((body.y + body.height) / TILE);
    // Standing still counts too: the body rests on the tile just below its feet.
    for (let col = left; col <= right; col++) {
      if (!isSolid(level, col, row)) continue;
      if (body.y + body.height >= row * TILE) {
        body.y = row * TILE - body.height;
        if (body.vy > 0) contact.landed = true;
        body.vy = 0;
        body.onGround = true;
      }
      break;
    }
  } else {
    const row = Math.floor(body.y / TILE);
    for (let col = left; col <= right; col++) {
      if (!isSolid(level, col, row)) continue;
      body.y = (row + 1) * TILE;
      body.vy = 0;
      contact.bumpedHead = true;
      break;
    }
  }
  return contact;
}

export function createPlayer(level: Level): Player {
  return {
    x: level.startX,
    y: level.startY,
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
    vx: 0,
    vy: 0,
    onGround: true,
    jumpHeld: false,
  };
}

/** Moves the acrobat for one physics step: run, jump, gravity, then collide. */
export function stepPlayer(level: Level, player: Player, input: Input, dt: number): Contact {
  applyRun(player, input);
  applyJump(player, input);
  applyGravity(player, player.jumpHeld, dt);
  return moveAndCollide(level, player, dt);
}

export function createState(seed: number): BigTopRunnerState {
  const level = generateLevel(seed);
  return {
    level,
    player: createPlayer(level),
    tickets: 0,
    distance: 0,
    finished: false,
    score: 0,
    phase: 'playing',
  };
}

export function scoreFor(tickets: number, distance: number, finished: boolean): number {
  return tickets * TICKET_POINTS + distance + (finished ? FINISH_BONUS : 0);
}

/** Picks up every ticket the acrobat touches. Returns how many it picked up. */
export function collectTickets(state: BigTopRunnerState): number {
  const { player } = state;
  let collected = 0;
  for (const ticket of state.level.tickets) {
    if (ticket.collected) continue;
    const nearestX = Math.max(player.x, Math.min(ticket.x, player.x + player.width));
    const nearestY = Math.max(player.y, Math.min(ticket.y, player.y + player.height));
    if (Math.hypot(ticket.x - nearestX, ticket.y - nearestY) <= TICKET_RADIUS) {
      ticket.collected = true;
      collected += 1;
    }
  }
  state.tickets += collected;
  return collected;
}

/** Advances the round by `dt` seconds. */
export function step(state: BigTopRunnerState, input: Input, dt: number): void {
  if (state.phase !== 'playing') return;
  const { level, player } = state;
  let left = dt;
  while (left > 0 && state.phase === 'playing') {
    const slice = Math.min(left, MAX_STEP);
    left -= slice;
    stepPlayer(level, player, input, slice);
    collectTickets(state);
    state.distance = Math.max(
      state.distance,
      Math.floor((Math.min(player.x, level.exitX) - level.startX) / TILE),
    );
    if (player.x + player.width / 2 >= level.exitX) {
      state.finished = true;
      state.phase = 'over';
    } else if (player.y > ROWS * TILE) {
      state.phase = 'over';
    }
  }
  state.score = scoreFor(state.tickets, state.distance, state.finished);
}

/** Where the camera's left edge sits: following the acrobat, inside the level. */
export function cameraX(state: BigTopRunnerState): number {
  const max = state.level.width * TILE - WIDTH;
  return Math.max(0, Math.min(state.player.x - WIDTH / 3, max));
}

const TOP = HEIGHT - ROWS * TILE;

function drawTent(ctx: CanvasRenderingContext2D, x: number, groundY: number, size: number) {
  const { colors } = theme;
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.beginPath();
    ctx.moveTo(x, groundY - size * 1.6);
    ctx.lineTo(x - size + (i * 2 * size) / stripes, groundY);
    ctx.lineTo(x - size + ((i + 1) * 2 * size) / stripes, groundY);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.moveTo(x, groundY - size * 1.6);
  ctx.lineTo(x, groundY - size * 2);
  ctx.lineTo(x + size * 0.4, groundY - size * 1.8);
  ctx.closePath();
  ctx.fill();
}

function drawTile(ctx: CanvasRenderingContext2D, tile: Tile, x: number, y: number, top: boolean) {
  const { colors } = theme;
  if (tile === 'ground') {
    ctx.fillStyle = colors.surface;
    ctx.fillRect(x, y, TILE, TILE);
    if (top) {
      ctx.fillStyle = colors.muted;
      ctx.fillRect(x, y, TILE, 5);
    }
  } else if (tile === 'brick') {
    ctx.fillStyle = colors.stripeA;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = colors.background;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.beginPath();
    ctx.moveTo(x, y + TILE / 2);
    ctx.lineTo(x + TILE, y + TILE / 2);
    ctx.moveTo(x + TILE / 2, y);
    ctx.lineTo(x + TILE / 2, y + TILE / 2);
    ctx.stroke();
  } else if (tile === 'crate') {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 2);
    ctx.lineTo(x + TILE - 2, y + TILE - 2);
    ctx.stroke();
  }
}

function drawAcrobat(ctx: CanvasRenderingContext2D, player: Player, time: number) {
  const { colors } = theme;
  const { x, y, width, height } = player;
  const stride = player.onGround && player.vx !== 0 ? Math.sin(time * 18) * 5 : 0;
  // Legs.
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(x + 4 + stride, y + height - 12, 5, 12);
  ctx.fillRect(x + width - 9 - stride, y + height - 12, 5, 12);
  // Striped leotard.
  ctx.fillStyle = colors.stripeB;
  ctx.fillRect(x + 2, y + 14, width - 4, height - 26);
  ctx.fillStyle = colors.stripeA;
  ctx.fillRect(x + 2, y + 20, width - 4, 4);
  ctx.fillRect(x + 2, y + 28, width - 4, 2);
  // Head and star cap.
  ctx.fillStyle = colors.text;
  ctx.beginPath();
  ctx.arc(x + width / 2, y + 8, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.accent;
  ctx.fillRect(x + width / 2 - 7, y, 14, 4);
}

function draw(ctx: CanvasRenderingContext2D, state: BigTopRunnerState, time: number) {
  const { colors } = theme;
  const { level, player } = state;
  const camera = cameraX(state);

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Far-off tents, moving slower than the level.
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 8; i++) {
    const x = ((i * 260 - camera * 0.3) % 2080) + 130;
    if (x > -200 && x < WIDTH + 200) drawTent(ctx, x, TOP + surfaceY(GROUND_HEIGHT), 70);
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(-Math.round(camera), TOP);

  const firstCol = Math.max(0, Math.floor(camera / TILE));
  const lastCol = Math.min(level.width - 1, Math.ceil((camera + WIDTH) / TILE));
  for (let row = 0; row < ROWS; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const tile = level.tiles[row][col];
      if (tile === 'empty') continue;
      const top = row === 0 || level.tiles[row - 1][col] === 'empty';
      drawTile(ctx, tile, col * TILE, row * TILE, top);
    }
  }

  drawTent(ctx, level.exitX, surfaceY(GROUND_HEIGHT), 80);
  ctx.fillStyle = colors.background;
  ctx.fillRect(level.exitX - 14, surfaceY(GROUND_HEIGHT) - 44, 28, 44);

  for (const ticket of level.tickets) {
    if (ticket.collected) continue;
    const bob = Math.sin(time * 3 + ticket.x) * 3;
    ctx.fillStyle = colors.accent;
    ctx.fillRect(ticket.x - 10, ticket.y - 7 + bob, 20, 14);
    ctx.fillStyle = colors.background;
    ctx.beginPath();
    ctx.arc(ticket.x - 10, ticket.y + bob, 3, 0, Math.PI * 2);
    ctx.arc(ticket.x + 10, ticket.y + bob, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  drawAcrobat(ctx, player, time);
  ctx.restore();

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, 30);
  ctx.textAlign = 'right';
  ctx.fillText(`Tickets ${state.tickets}   Distance ${state.distance}`, WIDTH - 16, 30);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = state.finished ? colors.accent : colors.danger;
    ctx.font = canvasFont('title', 'bold');
    const headline = state.finished ? 'You made it to the tent!' : 'Into the gap!';
    ctx.fillText(`${headline} You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Press space or click to run again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

export const bigTopRunner: CarnivalGame = {
  id: 'big-top-runner',
  name: 'Big Top Runner',
  description: 'Run, jump and tumble through the backlot to the exit tent, grabbing tickets.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState(newSeed());
    let scoreRecorded = false;
    const input: Input = { left: false, right: false, jump: false };

    const restart = () => {
      state = createState(newSeed());
      scoreRecorded = false;
    };
    const keyFor = (code: string): keyof Input | undefined => {
      if (code === 'ArrowLeft' || code === 'KeyA') return 'left';
      if (code === 'ArrowRight' || code === 'KeyD') return 'right';
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') return 'jump';
      return undefined;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const key = keyFor(event.code);
      if (!key) return;
      event.preventDefault();
      if (key === 'jump' && state.phase === 'over' && !event.repeat) {
        restart();
        return;
      }
      input[key] = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const key = keyFor(event.code);
      if (key) input[key] = false;
    };
    // A key released elsewhere never arrives, so drop held keys instead.
    const onBlur = () => {
      input.left = false;
      input.right = false;
      input.jump = false;
    };
    const onDown = () => {
      if (state.phase === 'over') restart();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, input, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(bigTopRunner.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, time / 1000);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default bigTopRunner;
