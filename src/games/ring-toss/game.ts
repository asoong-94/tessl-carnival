import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const RINGS_PER_ROUND = 8;
/** How close to the centre of a bottle's neck a ring has to land to score. */
export const NECK_RADIUS = 10;
/** Seconds a ring spends in the air. */
export const FLIGHT_TIME = 0.6;
/** How far, in pixels, the thrower's hand sways either side of the aim. */
export const WOBBLE = 24;
export const THROWER = { x: WIDTH / 2, y: HEIGHT - 30 } as const;
/** Back row first: bottles further back score more. */
const ROWS = [
  { y: 120, points: 30 },
  { y: 185, points: 20 },
  { y: 250, points: 10 },
];
const BOTTLES_PER_ROW = 5;
const BOTTLE_SPACING = 110;

export interface Bottle {
  x: number;
  y: number;
  points: number;
  /** Rings that have landed on this bottle's neck. */
  rings: number;
}

export interface Ring {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Seconds since the ring was thrown. */
  age: number;
}

export interface Miss {
  x: number;
  y: number;
  age: number;
}

export interface RingTossState {
  bottles: Bottle[];
  rings: Ring[];
  misses: Miss[];
  ringsLeft: number;
  score: number;
  /** Seconds since the round started; drives the hand's sway. */
  time: number;
  phase: 'playing' | 'over';
}

export function createState(): RingTossState {
  const left = WIDTH / 2 - ((BOTTLES_PER_ROW - 1) * BOTTLE_SPACING) / 2;
  const bottles = ROWS.flatMap((row) =>
    Array.from({ length: BOTTLES_PER_ROW }, (_, i) => ({
      x: left + i * BOTTLE_SPACING,
      y: row.y,
      points: row.points,
      rings: 0,
    })),
  );
  return {
    bottles,
    rings: [],
    misses: [],
    ringsLeft: RINGS_PER_ROUND,
    score: 0,
    time: 0,
    phase: 'playing',
  };
}

/** The sideways sway of the thrower's hand at a moment in the round. */
export function wobble(time: number): number {
  return Math.sin(time * 2.7) * WOBBLE;
}

/** The bottle whose neck a ring landing at (x, y) rings, if any. */
export function bottleAt(state: RingTossState, x: number, y: number): Bottle | undefined {
  return state.bottles.find((b) => Math.hypot(x - b.x, y - b.y) <= NECK_RADIUS);
}

/** Where a ring thrown now at the aim point lands: swayed by the hand, and always ahead of it. */
export function landingPoint(
  state: RingTossState,
  aimX: number,
  aimY: number,
): { x: number; y: number } {
  return { x: aimX + wobble(state.time), y: Math.min(aimY, THROWER.y - 1) };
}

/** Throws one ring at the aim point, swayed by the hand. Returns false if nothing was thrown. */
export function toss(state: RingTossState, aimX: number, aimY: number): boolean {
  if (state.phase !== 'playing' || state.ringsLeft === 0) return false;
  const landing = landingPoint(state, aimX, aimY);
  state.rings.push({
    fromX: THROWER.x,
    fromY: THROWER.y,
    toX: landing.x,
    toY: landing.y,
    age: 0,
  });
  state.ringsLeft -= 1;
  return true;
}

/** Where a ring is in its flight: along the line from the hand, lifted by an arc. */
export function ringPosition(ring: Ring): { x: number; y: number } {
  const t = Math.min(ring.age / FLIGHT_TIME, 1);
  const lift = Math.sin(t * Math.PI) * 80;
  return {
    x: ring.fromX + (ring.toX - ring.fromX) * t,
    y: ring.fromY + (ring.toY - ring.fromY) * t - lift,
  };
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  state.time += dt;
  for (const miss of state.misses) miss.age += dt;
  state.misses = state.misses.filter((m) => m.age < 0.6);

  const flying: Ring[] = [];
  for (const ring of state.rings) {
    ring.age += dt;
    if (ring.age < FLIGHT_TIME) {
      flying.push(ring);
      continue;
    }
    const bottle = bottleAt(state, ring.toX, ring.toY);
    if (bottle) {
      bottle.rings += 1;
      state.score += bottle.points;
    } else {
      state.misses.push({ x: ring.toX, y: ring.toY, age: 0 });
    }
  }
  state.rings = flying;

  if (state.ringsLeft === 0 && state.rings.length === 0) state.phase = 'over';
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, 16, 6, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Shelves, one under each row of bottles.
  for (const row of ROWS) {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(40, row.y + 34, WIDTH - 80, 6);
  }

  for (const bottle of state.bottles) {
    ctx.fillStyle = colors.water;
    ctx.fillRect(bottle.x - 12, bottle.y + 6, 24, 28);
    ctx.fillRect(bottle.x - 4, bottle.y - 10, 8, 18);
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(bottle.x, bottle.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 3;
    for (let i = 0; i < bottle.rings; i++) drawRing(ctx, bottle.x, bottle.y + 6 + i * 4);
  }

  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 3;
  for (const miss of state.misses) {
    ctx.globalAlpha = 1 - miss.age / 0.6;
    drawRing(ctx, miss.x, miss.y + miss.age * 60);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 4;
  for (const ring of state.rings) {
    const { x, y } = ringPosition(ring);
    drawRing(ctx, x, y);
  }

  // Where the next ring would land, swaying with the hand.
  if (state.phase === 'playing' && state.ringsLeft > 0) {
    const { x, y } = landingPoint(state, aim.x, aim.y);
    ctx.strokeStyle = colors.danger;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
  }

  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(THROWER.x, THROWER.y, 20, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.ringsLeft}/${RINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description:
    'Land rings on the bottle necks before you run out. Bottles further back score more.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: WIDTH / 2, y: HEIGHT / 3 };

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(aim, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(aim, toCanvas(event));
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        toss(state, aim.x, aim.y);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, aim);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default ringToss;
