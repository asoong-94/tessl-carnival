import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_TIME = 30;
export const POINTS_PER_WHACK = 10;
export const COLUMNS = 3;
export const ROWS = 3;
export const HOLE_RADIUS = 50;
/** Seconds between pop-ups at the start and at the end of a round. */
export const SPAWN_GAP = { start: 1, end: 0.35 } as const;
/** Seconds a mole stays up at the start and at the end of a round. */
export const UP_TIME = { start: 1.2, end: 0.6 } as const;
/** How far above its hole a mole's body is drawn. */
export const MOLE_RISE = 20;
const BONK_TIME = 0.3;

export interface Hole {
  x: number;
  y: number;
  /** Seconds this hole's mole has left above ground; 0 when it is down. */
  up: number;
  /** Seconds left on the bonk shown after a whack; 0 when there is none. */
  bonk: number;
}

export interface WhackAMoleState {
  holes: Hole[];
  /** Seconds until the next mole pops up. */
  nextMole: number;
  timeLeft: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): WhackAMoleState {
  const holes: Hole[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLUMNS; col++) {
      holes.push({
        x: (WIDTH / COLUMNS) * (col + 0.5),
        y: 120 + row * 125,
        up: 0,
        bonk: 0,
      });
    }
  }
  return { holes, nextMole: 0.5, timeLeft: ROUND_TIME, score: 0, phase: 'playing' };
}

/** How far through the round we are, from 0 at the start to 1 at the end. */
function progress(state: WhackAMoleState): number {
  return Math.min(Math.max(1 - state.timeLeft / ROUND_TIME, 0), 1);
}

/** Seconds until the next pop-up; shrinks as the round goes on. */
export function spawnGap(state: WhackAMoleState): number {
  return SPAWN_GAP.start + (SPAWN_GAP.end - SPAWN_GAP.start) * progress(state);
}

/** Seconds a new mole stays up; shrinks as the round goes on. */
export function upTime(state: WhackAMoleState): number {
  return UP_TIME.start + (UP_TIME.end - UP_TIME.start) * progress(state);
}

/** Whether a point lands on the mole that pops up from this hole. */
export function isOnMole(hole: Hole, x: number, y: number): boolean {
  return Math.hypot(x - hole.x, y - (hole.y - MOLE_RISE)) <= HOLE_RADIUS;
}

/** Pops a mole up from a random empty hole. Returns false if every hole is busy. */
export function popUp(state: WhackAMoleState, random: () => number = Math.random): boolean {
  const empty = state.holes.filter((h) => h.up === 0 && h.bonk === 0);
  if (empty.length === 0) return false;
  const hole = empty[Math.min(Math.floor(random() * empty.length), empty.length - 1)];
  hole.up = upTime(state);
  return true;
}

/** Whacks the mole at a point, if one is up there. Returns true on a hit. */
export function whack(state: WhackAMoleState, x: number, y: number): boolean {
  if (state.phase !== 'playing') return false;
  const hole = state.holes.find((h) => h.up > 0 && isOnMole(h, x, y));
  if (!hole) return false;
  hole.up = 0;
  hole.bonk = BONK_TIME;
  state.score += POINTS_PER_WHACK;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: WhackAMoleState, dt: number, random: () => number = Math.random): void {
  if (state.phase !== 'playing') return;

  state.timeLeft = Math.max(state.timeLeft - dt, 0);
  for (const hole of state.holes) {
    hole.up = Math.max(hole.up - dt, 0);
    hole.bonk = Math.max(hole.bonk - dt, 0);
  }

  if (state.timeLeft === 0) {
    for (const hole of state.holes) hole.up = 0;
    state.phase = 'over';
    return;
  }

  state.nextMole -= dt;
  if (state.nextMole <= 0) {
    popUp(state, random);
    state.nextMole = spawnGap(state);
  }
}

function drawMole(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const { colors } = theme;
  ctx.fillStyle = colors.wood;
  ctx.beginPath();
  ctx.ellipse(x, y - MOLE_RISE, 32, 38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.text;
  ctx.beginPath();
  ctx.arc(x - 11, y - 32, 5, 0, Math.PI * 2);
  ctx.arc(x + 11, y - 32, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.background;
  ctx.beginPath();
  ctx.arc(x - 11, y - 32, 2, 0, Math.PI * 2);
  ctx.arc(x + 11, y - 32, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.stripeA;
  ctx.beginPath();
  ctx.arc(x, y - MOLE_RISE, 6, 0, Math.PI * 2);
  ctx.fill();
}

function draw(ctx: CanvasRenderingContext2D, state: WhackAMoleState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  for (const hole of state.holes) {
    // The hole's dark mouth, then the mole, then the front lip covering its base.
    ctx.fillStyle = colors.surface;
    ctx.beginPath();
    ctx.ellipse(hole.x, hole.y, HOLE_RADIUS, HOLE_RADIUS * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (hole.up > 0) drawMole(ctx, hole.x, hole.y);
    ctx.fillStyle = colors.wood;
    ctx.fillRect(hole.x - HOLE_RADIUS - 6, hole.y, HOLE_RADIUS * 2 + 12, 12);

    if (hole.bonk > 0) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 4;
      ctx.globalAlpha = hole.bonk / BONK_TIME;
      ctx.beginPath();
      ctx.arc(hole.x, hole.y - MOLE_RISE, 20 + (BONK_TIME - hole.bonk) * 100, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(state.timeLeft)}s`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const whackAMole: CarnivalGame = {
  id: 'whack-a-mole',
  name: 'Whack-a-Mole',
  description:
    'Whack the moles before they duck back down. They get quicker as the clock runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      const rect = canvas.getBoundingClientRect();
      whack(
        state,
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't skip the round.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(whackAMole.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default whackAMole;
