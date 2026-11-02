import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const BALLS = 3;
export const POINTS_PER_BOTTLE = 10;
export const CLEAR_BONUS = 50;
/** How far left or right of centre the ball can be aimed, in pixels. */
export const AIM_RANGE = 200;
/** Seconds of holding for the power to climb from empty to full. */
export const CHARGE_TIME = 1;
export const FLIGHT_TIME = 0.5;
export const BALL_RADIUS = 14;
export const BOTTLE = { width: 36, height: 70 } as const;
export const TABLE_Y = 320;
export const THROWER = { x: WIDTH / 2, y: HEIGHT - 40 } as const;
/** Power below this falls short of the table; above the top band sails over. */
export const POWER_BANDS = [0.2, 0.5, 0.75, 0.95] as const;

export interface Bottle {
  /** 0 is the bottom row, 2 the top. */
  row: number;
  /** Position in its row, counted from the left. */
  index: number;
  x: number;
  /** The bottom of the bottle. */
  y: number;
  standing: boolean;
}

export interface Ball {
  fromX: number;
  toX: number;
  toY: number;
  /** The row the ball reaches, or undefined when it falls short or sails over. */
  row: number | undefined;
  aim: number;
  power: number;
  age: number;
}

export interface MilkBottleState {
  bottles: Bottle[];
  ball: Ball | undefined;
  ballsLeft: number;
  score: number;
  phase: 'playing' | 'over';
}

const ROWS = [3, 2, 1];
const SPACING = 60;

export function createBottles(): Bottle[] {
  return ROWS.flatMap((count, row) =>
    Array.from({ length: count }, (_, index) => ({
      row,
      index,
      x: WIDTH / 2 + (index - (count - 1) / 2) * SPACING,
      y: TABLE_Y - row * BOTTLE.height,
      standing: true,
    })),
  );
}

export function createState(): MilkBottleState {
  return {
    bottles: createBottles(),
    ball: undefined,
    ballsLeft: BALLS,
    score: 0,
    phase: 'playing',
  };
}

/** Power for a charge held `seconds` long: climbs to full, then back down, and repeats. */
export function powerFor(seconds: number): number {
  const t = (Math.max(seconds, 0) / CHARGE_TIME) % 2;
  return t <= 1 ? t : 2 - t;
}

/** The row a throw of this power reaches, or undefined when it falls short or sails over. */
export function rowFor(power: number): number | undefined {
  const [short, middle, top, over] = POWER_BANDS;
  if (power < short || power > over) return undefined;
  if (power < middle) return 0;
  if (power < top) return 1;
  return 2;
}

/** Where on the table a throw aimed at `aim` (-1 left to 1 right) crosses. */
export function aimX(aim: number): number {
  return WIDTH / 2 + Math.max(-1, Math.min(1, aim)) * AIM_RANGE;
}

/** Bottle `bottle` rests on the two bottles below it in the next row down. */
function supports(bottles: readonly Bottle[], bottle: Bottle): Bottle[] {
  return bottles.filter(
    (b) => b.row === bottle.row - 1 && (b.index === bottle.index || b.index === bottle.index + 1),
  );
}

/**
 * Which standing bottles fall for a throw with this aim (-1 to 1) and power
 * (0 to 1). The ball knocks over every standing bottle it touches in the row it
 * reaches, then any bottle with nothing standing under it falls too.
 */
export function bottlesKnockedDown(
  bottles: readonly Bottle[],
  aim: number,
  power: number,
): Bottle[] {
  const row = rowFor(power);
  if (row === undefined) return [];
  const x = aimX(aim);
  const fallen = new Set(
    bottles.filter(
      (b) => b.standing && b.row === row && Math.abs(b.x - x) <= BALL_RADIUS + BOTTLE.width / 2,
    ),
  );
  if (fallen.size === 0) return [];

  const isUp = (b: Bottle) => b.standing && !fallen.has(b);
  for (const bottle of [...bottles].sort((a, b) => a.row - b.row)) {
    if (!isUp(bottle) || bottle.row === 0) continue;
    if (!supports(bottles, bottle).some(isUp)) fallen.add(bottle);
  }
  return bottles.filter((b) => fallen.has(b));
}

/** 10 for each bottle down, plus the bonus when all six are down. */
export function scoreFor(bottles: readonly Bottle[]): number {
  const down = bottles.filter((b) => !b.standing).length;
  return down * POINTS_PER_BOTTLE + (down === bottles.length ? CLEAR_BONUS : 0);
}

/** Throws a ball. Returns false if nothing was thrown. */
export function throwBall(state: MilkBottleState, aim: number, power: number): boolean {
  if (state.phase !== 'playing' || state.ball || state.ballsLeft === 0) return false;
  const row = rowFor(power);
  const short = power < POWER_BANDS[0];
  state.ball = {
    fromX: THROWER.x,
    toX: aimX(aim),
    toY:
      row !== undefined
        ? TABLE_Y - row * BOTTLE.height - BOTTLE.height / 2
        : short
          ? TABLE_Y + 60
          : -BALL_RADIUS * 2,
    row,
    aim,
    power,
    age: 0,
  };
  state.ballsLeft -= 1;
  return true;
}

/** The ball's position on its way to the bottles. */
export function ballPosition(ball: Ball): { x: number; y: number } {
  const t = Math.min(ball.age / FLIGHT_TIME, 1);
  return {
    x: ball.fromX + (ball.toX - ball.fromX) * t,
    y: THROWER.y + (ball.toY - THROWER.y) * t,
  };
}

/** Advances the game by `dt` seconds. */
export function step(state: MilkBottleState, dt: number): void {
  const ball = state.ball;
  if (ball) {
    ball.age += dt;
    if (ball.age >= FLIGHT_TIME) {
      for (const bottle of bottlesKnockedDown(state.bottles, ball.aim, ball.power)) {
        bottle.standing = false;
      }
      state.score = scoreFor(state.bottles);
      state.ball = undefined;
    }
  }
  if (state.ballsLeft === 0 && !state.ball) state.phase = 'over';
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: MilkBottleState,
  aim: number,
  power: number | undefined,
) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Table.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(WIDTH / 2 - 160, TABLE_Y, 320, 14);
  ctx.fillRect(WIDTH / 2 - 140, TABLE_Y + 14, 12, 80);
  ctx.fillRect(WIDTH / 2 + 128, TABLE_Y + 14, 12, 80);

  for (const bottle of state.bottles) {
    if (!bottle.standing) continue;
    const left = bottle.x - BOTTLE.width / 2;
    const top = bottle.y - BOTTLE.height;
    ctx.fillStyle = colors.stripeB;
    ctx.fillRect(left, top + 22, BOTTLE.width, BOTTLE.height - 24);
    ctx.fillRect(bottle.x - 8, top + 4, 16, 20);
    ctx.fillStyle = colors.stripeA;
    ctx.fillRect(left, top + 36, BOTTLE.width, 12);
  }

  // Aim marker on the table.
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(THROWER.x, THROWER.y);
  ctx.lineTo(aimX(aim), TABLE_Y - BOTTLE.height);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  const resting = state.ball ? ballPosition(state.ball) : THROWER;
  if (state.ball || state.ballsLeft > 0) {
    ctx.arc(resting.x, resting.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // Power meter.
  const meterX = WIDTH - 50;
  const meterTop = 80;
  const meterHeight = 300;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(meterX, meterTop, 24, meterHeight);
  if (power !== undefined) {
    ctx.fillStyle = rowFor(power) === undefined ? colors.danger : colors.accent;
    ctx.fillRect(meterX, meterTop + meterHeight * (1 - power), 24, meterHeight * power);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Balls ${state.ballsLeft}/${BALLS}`, WIDTH - 16, HEIGHT - 20);

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

export const milkBottle: CarnivalGame = {
  id: 'milk-bottle',
  name: 'Milk Bottle Knockdown',
  description: 'Knock down the pyramid of six milk bottles with three balls.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    let aim = 0;
    let steer = 0;
    /** Seconds the throw has been charging, or undefined when not charging. */
    let charge: number | undefined;
    /** The input that started the charge: only its release throws. */
    let charger: 'pointer' | 'space' | undefined;

    const begin = (source: 'pointer' | 'space') => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else if (charge === undefined && !state.ball && state.ballsLeft > 0) {
        charge = 0;
        charger = source;
      }
    };
    const release = (source: 'pointer' | 'space') => {
      if (charge === undefined || charger !== source) return;
      throwBall(state, aim, powerFor(charge));
      charge = undefined;
      charger = undefined;
    };
    // A release that happens in another window never reaches this one, so
    // losing focus drops the steer and the charge without throwing.
    const onBlur = () => {
      steer = 0;
      charge = undefined;
      charger = undefined;
    };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
      aim = Math.max(-1, Math.min(1, (x - WIDTH / 2) / AIM_RANGE));
    };
    const onDown = (event: PointerEvent) => {
      onMove(event);
      begin('pointer');
    };
    const onUp = () => release('pointer');
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ') {
        event.preventDefault();
        if (!event.repeat) begin('space');
      } else if (event.key === 'ArrowLeft' || event.key === 'a') {
        steer = -1;
      } else if (event.key === 'ArrowRight' || event.key === 'd') {
        steer = 1;
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === ' ') release('space');
      else if (['ArrowLeft', 'a', 'ArrowRight', 'd'].includes(event.key)) steer = 0;
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      aim = Math.max(-1, Math.min(1, aim + steer * dt));
      if (charge !== undefined) charge += dt;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(milkBottle.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, aim, charge === undefined ? undefined : powerFor(charge));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  },
};

export default milkBottle;
