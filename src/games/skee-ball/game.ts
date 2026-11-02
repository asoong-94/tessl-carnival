import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const BALLS_PER_ROUND = 9;
/** Below this power the ball never reaches the board and drops in the gutter. */
export const MIN_POWER = 0.2;
/** Power gained per second while the button is held. */
export const CHARGE_RATE = 0.8;
/** Seconds the ball takes to roll up the ramp. */
export const ROLL_TIME = 0.8;

export const BOARD = { left: 220, right: 580, top: 30, bottom: 320 } as const;
export const RING_CENTER = { x: WIDTH / 2, y: 175 } as const;
/** Innermost first: a landing scores the first ring it falls inside. */
export const RINGS = [
  { radius: 28, points: 50 },
  { radius: 56, points: 40 },
  { radius: 84, points: 30 },
  { radius: 112, points: 20 },
  { radius: 140, points: 10 },
] as const;
export const POCKET_RADIUS = 20;
export const POCKETS = [
  { x: BOARD.left + 22, y: BOARD.top + 22 },
  { x: BOARD.right - 22, y: BOARD.top + 22 },
] as const;
export const POCKET_POINTS = 100;
export const LANE = { x: WIDTH / 2, y: HEIGHT - 40 } as const;

export interface Landing {
  kind: 'gutter' | 'miss' | 'ring' | 'pocket';
  points: number;
  x: number;
  y: number;
}

/**
 * Where a ball lands for an aim (-1 is far left, 1 is far right) and a power
 * (0 to 1). Aim picks the column on the board, and power how far up it goes.
 */
export function landingFor(aim: number, power: number): Landing {
  const a = Math.max(-1, Math.min(1, aim));
  const p = Math.max(0, Math.min(1, power));
  const x = RING_CENTER.x + a * ((BOARD.right - BOARD.left) / 2);
  if (p < MIN_POWER) return { kind: 'gutter', points: 0, x, y: BOARD.bottom + 40 };

  const y = BOARD.bottom - ((p - MIN_POWER) / (1 - MIN_POWER)) * (BOARD.bottom - BOARD.top);
  if (POCKETS.some((pocket) => Math.hypot(x - pocket.x, y - pocket.y) <= POCKET_RADIUS)) {
    return { kind: 'pocket', points: POCKET_POINTS, x, y };
  }
  const distance = Math.hypot(x - RING_CENTER.x, y - RING_CENTER.y);
  const ring = RINGS.find((r) => distance <= r.radius);
  return ring ? { kind: 'ring', points: ring.points, x, y } : { kind: 'miss', points: 0, x, y };
}

export interface Roll {
  landing: Landing;
  /** Seconds since the ball was released. */
  age: number;
}

export interface SkeeBallState {
  /** -1 is far left, 1 is far right. */
  aim: number;
  power: number;
  charging: boolean;
  roll: Roll | null;
  last: Landing | null;
  balls: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): SkeeBallState {
  return {
    aim: 0,
    power: 0,
    charging: false,
    roll: null,
    last: null,
    balls: BALLS_PER_ROUND,
    score: 0,
    phase: 'playing',
  };
}

export function setAim(state: SkeeBallState, aim: number): void {
  state.aim = Math.max(-1, Math.min(1, aim));
}

/** Starts charging power. Returns false if the player can't roll right now. */
export function startCharge(state: SkeeBallState): boolean {
  if (state.phase !== 'playing' || state.roll || state.balls === 0 || state.charging) return false;
  state.charging = true;
  state.power = 0;
  return true;
}

/** Rolls the ball with the power charged so far. Returns false if nothing rolled. */
export function release(state: SkeeBallState): boolean {
  if (!state.charging) return false;
  state.charging = false;
  state.roll = { landing: landingFor(state.aim, state.power), age: 0 };
  state.balls -= 1;
  state.power = 0;
  return true;
}

/** Drops the charge without rolling, so no ball is used. Returns false if nothing was charging. */
export function cancelCharge(state: SkeeBallState): boolean {
  if (!state.charging) return false;
  state.charging = false;
  state.power = 0;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: SkeeBallState, dt: number): void {
  if (state.charging) state.power = Math.min(1, state.power + CHARGE_RATE * dt);

  if (state.roll) {
    state.roll.age += dt;
    if (state.roll.age >= ROLL_TIME) {
      state.score += state.roll.landing.points;
      state.last = state.roll.landing;
      state.roll = null;
    }
  }

  if (state.balls === 0 && !state.roll) state.phase = 'over';
}

function ballPosition(roll: Roll) {
  const t = Math.min(roll.age / ROLL_TIME, 1);
  return {
    x: LANE.x + (roll.landing.x - LANE.x) * t,
    y: LANE.y + (roll.landing.y - LANE.y) * t,
  };
}

function draw(ctx: CanvasRenderingContext2D, state: SkeeBallState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Ramp, narrowing up to the board.
  ctx.fillStyle = colors.wood;
  ctx.beginPath();
  ctx.moveTo(BOARD.left, BOARD.bottom);
  ctx.lineTo(BOARD.right, BOARD.bottom);
  ctx.lineTo(WIDTH - 120, HEIGHT);
  ctx.lineTo(120, HEIGHT);
  ctx.closePath();
  ctx.fill();

  // Gutter at the foot of the board.
  ctx.fillStyle = colors.background;
  ctx.fillRect(BOARD.left, BOARD.bottom, BOARD.right - BOARD.left, 14);

  // Board.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(BOARD.left, BOARD.top, BOARD.right - BOARD.left, BOARD.bottom - BOARD.top);

  for (let i = RINGS.length - 1; i >= 0; i--) {
    const ring = RINGS[i];
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.beginPath();
    ctx.arc(RING_CENTER.x, RING_CENTER.y, ring.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'center';
  RINGS.forEach((ring, i) => {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeB : colors.stripeA;
    const y = i === 0 ? RING_CENTER.y + 5 : RING_CENTER.y - ring.radius + 19;
    ctx.fillText(String(ring.points), RING_CENTER.x, y);
  });

  for (const pocket of POCKETS) {
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(pocket.x, pocket.y, POCKET_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.background;
    ctx.fillText(String(POCKET_POINTS), pocket.x, pocket.y + 5);
  }

  // Aim guide up the ramp.
  if (state.phase === 'playing' && !state.roll) {
    const target = landingFor(state.aim, 1);
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(LANE.x, LANE.y);
    ctx.lineTo(target.x, BOARD.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Ball.
  const ball = state.roll ? ballPosition(state.roll) : state.balls > 0 ? LANE : null;
  if (ball) {
    const t = state.roll ? Math.min(state.roll.age / ROLL_TIME, 1) : 0;
    ctx.fillStyle = colors.text;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, 14 - t * 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Power meter.
  const meter = { x: WIDTH - 60, y: 120, w: 24, h: 260 };
  ctx.fillStyle = colors.surface;
  ctx.fillRect(meter.x, meter.y, meter.w, meter.h);
  ctx.fillStyle = state.power < MIN_POWER ? colors.danger : colors.accent;
  ctx.fillRect(meter.x, meter.y + meter.h * (1 - state.power), meter.w, meter.h * state.power);
  ctx.fillStyle = colors.muted;
  ctx.fillRect(meter.x - 4, meter.y + meter.h * (1 - MIN_POWER), meter.w + 8, 2);
  ctx.font = canvasFont('small');
  ctx.fillText('Power', meter.x + meter.w / 2, meter.y - 10);

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  if (state.last) {
    ctx.font = canvasFont('body');
    const label = state.last.kind === 'gutter' ? 'Gutter!' : `+${state.last.points}`;
    ctx.fillText(label, 16, HEIGHT - 50);
  }
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'right';
  ctx.fillText(`Balls ${state.balls}/${BALLS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of balls! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const skeeBall: CarnivalGame = {
  id: 'skee-ball',
  name: 'Skee-Ball',
  description: 'Aim, charge and roll nine balls up the ramp. The corner pockets are worth 100.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const keys = { left: false, right: false };

    const aimFromPointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      setAim(state, (x - RING_CENTER.x) / ((BOARD.right - BOARD.left) / 2));
    };
    const press = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        startCharge(state);
      }
    };
    const onMove = (event: PointerEvent) => aimFromPointer(event);
    const onDown = (event: PointerEvent) => {
      aimFromPointer(event);
      press();
    };
    const onUp = () => release(state);
    // A release that happens elsewhere never arrives, so drop held input instead.
    const onInterrupt = () => {
      keys.left = false;
      keys.right = false;
      cancelCharge(state);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) press();
      } else if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        keys.left = true;
      } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        keys.right = true;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') release(state);
      else if (event.code === 'ArrowLeft' || event.code === 'KeyA') keys.left = false;
      else if (event.code === 'ArrowRight' || event.code === 'KeyD') keys.right = false;
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onInterrupt);
    window.addEventListener('blur', onInterrupt);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      if (keys.left !== keys.right) setAim(state, state.aim + (keys.left ? -1 : 1) * dt);
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(skeeBall.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onInterrupt);
      window.removeEventListener('blur', onInterrupt);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  },
};

export default skeeBall;
