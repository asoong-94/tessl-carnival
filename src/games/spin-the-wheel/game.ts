import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const BANKRUPT = 'BANKRUPT';
export type Slice = number | typeof BANKRUPT;
/** The control the player is holding to charge a spin. */
export type Hold = 'pointer' | 'space';

/** The wheel's slices, clockwise from the one under the pointer at angle 0. */
export const SLICES: readonly Slice[] = [100, 5, 20, 10, 50, 5, BANKRUPT, 10, 20, 5, 50, 10];
export const SLICE_ANGLE = (Math.PI * 2) / SLICES.length;
export const SPINS_PER_ROUND = 5;
/** Seconds of holding for a full-power spin. */
export const CHARGE_TIME = 1.5;
/** Radians per second at no power and at full power. */
export const MIN_SPEED = 6;
export const MAX_SPEED = 24;
/** How fast the wheel slows down, in radians per second per second. */
export const FRICTION = 4;

const CENTER = { x: WIDTH / 2, y: HEIGHT / 2 + 20 } as const;
const RADIUS = 190;
/** The pointer sits at the top of the wheel. */
const POINTER = -Math.PI / 2;

export interface SpinTheWheelState {
  /** The wheel's rotation in radians, clockwise. */
  angle: number;
  /** Radians per second while spinning. */
  speed: number;
  /** The angle the current spin stops at. */
  stopAt: number;
  /** Spin power from 0 to 1 while the player is holding. */
  charge: number;
  /** The control that started the current charge. */
  hold: Hold | null;
  spinsLeft: number;
  score: number;
  lastSlice: Slice | null;
  phase: 'ready' | 'charging' | 'spinning' | 'over';
}

export function createState(): SpinTheWheelState {
  return {
    angle: 0,
    speed: 0,
    stopAt: 0,
    charge: 0,
    hold: null,
    spinsLeft: SPINS_PER_ROUND,
    score: 0,
    lastSlice: null,
    phase: 'ready',
  };
}

/** The wheel's starting speed for a spin power from 0 to 1. */
export function spinSpeed(power: number): number {
  const clamped = Math.min(Math.max(power, 0), 1);
  return MIN_SPEED + clamped * (MAX_SPEED - MIN_SPEED);
}

/** Where a wheel at `startAngle` stops after a spin of `power`. */
export function stopAngle(startAngle: number, power: number): number {
  const speed = spinSpeed(power);
  return startAngle + (speed * speed) / (2 * FRICTION);
}

/** The index of the slice under the pointer when the wheel is at `angle`. */
export function sliceIndexAt(angle: number): number {
  const turn = Math.PI * 2;
  const underPointer = (((-angle % turn) + turn) % turn) / SLICE_ANGLE;
  return Math.floor(underPointer) % SLICES.length;
}

/** The slice the wheel stops on, for a given start angle and spin power. */
export function landingSlice(startAngle: number, power: number): Slice {
  return SLICES[sliceIndexAt(stopAngle(startAngle, power))];
}

/** The round's score after landing on `slice`. BANKRUPT resets it to 0. */
export function applySlice(score: number, slice: Slice): number {
  return slice === BANKRUPT ? 0 : score + slice;
}

/** Starts charging a spin. Returns false if the wheel can't be spun now. */
export function startCharge(state: SpinTheWheelState, hold: Hold = 'pointer'): boolean {
  if (state.phase !== 'ready') return false;
  state.phase = 'charging';
  state.charge = 0;
  state.hold = hold;
  return true;
}

/**
 * Lets go of the wheel and spins it with the charged power. Only the control
 * that started the charge can release it.
 */
export function release(state: SpinTheWheelState, hold: Hold = 'pointer'): boolean {
  if (state.phase !== 'charging' || state.hold !== hold) return false;
  state.hold = null;
  state.speed = spinSpeed(state.charge);
  state.stopAt = stopAngle(state.angle, state.charge);
  state.spinsLeft -= 1;
  state.phase = 'spinning';
  return true;
}

/** Drops a charge without spinning, so the spin isn't used. */
export function cancelCharge(state: SpinTheWheelState): boolean {
  if (state.phase !== 'charging') return false;
  state.phase = 'ready';
  state.charge = 0;
  state.hold = null;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: SpinTheWheelState, dt: number): void {
  if (state.phase === 'charging') {
    state.charge = Math.min(state.charge + dt / CHARGE_TIME, 1);
    return;
  }
  if (state.phase !== 'spinning') return;

  state.angle += state.speed * dt;
  state.speed -= FRICTION * dt;
  if (state.speed > 0 && state.angle < state.stopAt) return;

  // Land exactly where the spin was always going to stop.
  state.angle = state.stopAt;
  state.speed = 0;
  state.charge = 0;
  const slice = SLICES[sliceIndexAt(state.angle)];
  state.lastSlice = slice;
  state.score = applySlice(state.score, slice);
  state.phase = state.spinsLeft === 0 ? 'over' : 'ready';
}

function sliceColors(slice: Slice, index: number): { fill: string; text: string } {
  const { colors } = theme;
  if (slice === BANKRUPT) return { fill: colors.background, text: colors.danger };
  if (slice === 100) return { fill: colors.accent, text: colors.background };
  const fills = [colors.stripeA, colors.stripeB, colors.surface];
  const fill = fills[index % fills.length];
  return { fill, text: fill === colors.stripeB ? colors.background : colors.text };
}

function draw(ctx: CanvasRenderingContext2D, state: SpinTheWheelState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Wheel stand.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(CENTER.x - 12, CENTER.y, 24, HEIGHT - CENTER.y);

  ctx.save();
  ctx.translate(CENTER.x, CENTER.y);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  SLICES.forEach((slice, i) => {
    const from = POINTER + state.angle + i * SLICE_ANGLE;
    const { fill, text } = sliceColors(slice, i);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, RADIUS, from, from + SLICE_ANGLE);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = colors.wood;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.rotate(from + SLICE_ANGLE / 2);
    ctx.fillStyle = text;
    ctx.font = canvasFont(slice === BANKRUPT ? 'small' : 'body', 'bold');
    ctx.fillText(String(slice), RADIUS - 14, 0);
    ctx.restore();
  });
  ctx.restore();

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.arc(CENTER.x, CENTER.y, 16, 0, Math.PI * 2);
  ctx.fill();

  // Pointer at the top of the wheel.
  const tip = CENTER.y - RADIUS + 18;
  ctx.fillStyle = colors.text;
  ctx.beginPath();
  ctx.moveTo(CENTER.x, tip);
  ctx.lineTo(CENTER.x - 14, tip - 30);
  ctx.lineTo(CENTER.x + 14, tip - 30);
  ctx.closePath();
  ctx.fill();

  // Power meter.
  const meter = { x: 40, y: 80, width: 24, height: HEIGHT - 160 };
  ctx.fillStyle = colors.surface;
  ctx.fillRect(meter.x, meter.y, meter.width, meter.height);
  const filled = meter.height * state.charge;
  ctx.fillStyle = colors.accent;
  ctx.fillRect(meter.x, meter.y + meter.height - filled, meter.width, filled);
  ctx.fillStyle = colors.muted;
  ctx.font = canvasFont('small');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Power', meter.x + meter.width / 2, meter.y + meter.height + 20);

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Spins ${state.spinsLeft}/${SPINS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.lastSlice !== null && state.phase !== 'over') {
    ctx.fillStyle = state.lastSlice === BANKRUPT ? colors.danger : colors.accent;
    ctx.fillText(
      state.lastSlice === BANKRUPT ? 'BANKRUPT!' : `+${state.lastSlice}`,
      WIDTH - 16,
      80,
    );
  }
  if (state.phase === 'ready') {
    ctx.fillStyle = colors.muted;
    ctx.font = canvasFont('small');
    ctx.textAlign = 'right';
    ctx.fillText('Hold the mouse or space, then let go', WIDTH - 16, HEIGHT - 50);
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of spins! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const spinTheWheel: CarnivalGame = {
  id: 'spin-the-wheel',
  name: 'Spin the Wheel',
  description: 'Hold to charge, let go to spin. Five spins, and watch out for BANKRUPT.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const press = (hold: Hold) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        startCharge(state, hold);
      }
    };
    const onDown = () => press('pointer');
    const onUp = () => release(state, 'pointer');
    // A release can happen in another window, so drop the charge on losing focus.
    const onBlur = () => cancelCharge(state);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      if (!event.repeat) press('space');
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      event.preventDefault();
      release(state, 'space');
    };
    canvas.addEventListener('pointerdown', onDown);
    // Listen on the window so letting go off the canvas still spins.
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointercancel', onBlur);
    window.addEventListener('blur', onBlur);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(spinTheWheel.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('pointercancel', onBlur);
      window.removeEventListener('blur', onBlur);
    };
  },
};

export default spinTheWheel;
