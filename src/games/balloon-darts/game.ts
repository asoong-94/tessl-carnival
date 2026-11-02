import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const DARTS_PER_ROUND = 10;
export const BOARD = { x: WIDTH / 2, y: HEIGHT / 2 + 20, radius: 200 } as const;
/** Radians per second; the board turns clockwise on screen. */
export const SPIN_SPEED = 0.8;
export const BALLOON_RADIUS = 22;
export const BALLOON_POINTS = 10;
export const GOLD_POINTS = 50;
const RINGS = [
  { distance: 75, count: 6, gold: [] as number[] },
  { distance: 150, count: 12, gold: [0, 4, 8] },
];

export interface Balloon {
  /** Where the balloon sits on the board, in radians, before the board turns. */
  angle: number;
  /** Pixels from the board's centre. */
  distance: number;
  gold: boolean;
  popped: boolean;
}

/** A dart stuck in the board, in the board's own coordinates so it turns with it. */
export interface Dart {
  angle: number;
  distance: number;
}

export interface BalloonDartsState {
  balloons: Balloon[];
  darts: Dart[];
  /** How far the board has turned, in radians. */
  boardAngle: number;
  dartsLeft: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): BalloonDartsState {
  const balloons = RINGS.flatMap((ring) =>
    Array.from({ length: ring.count }, (_, i) => ({
      angle: (i / ring.count) * Math.PI * 2,
      distance: ring.distance,
      gold: ring.gold.includes(i),
      popped: false,
    })),
  );
  return {
    balloons,
    darts: [],
    boardAngle: 0,
    dartsLeft: DARTS_PER_ROUND,
    score: 0,
    phase: 'playing',
  };
}

export function scoreForBalloon(balloon: Balloon): number {
  return balloon.gold ? GOLD_POINTS : BALLOON_POINTS;
}

/** Where a point on the board is on screen, once the board has turned by `boardAngle`. */
export function toScreen(boardAngle: number, angle: number, distance: number) {
  return {
    x: BOARD.x + Math.cos(angle + boardAngle) * distance,
    y: BOARD.y + Math.sin(angle + boardAngle) * distance,
  };
}

/**
 * The index of the unpopped balloon a dart at (`x`, `y`) on screen hits, with the
 * board turned by `boardAngle`, or -1 when it hits nothing.
 */
export function balloonAt(
  balloons: readonly Balloon[],
  boardAngle: number,
  x: number,
  y: number,
): number {
  return balloons.findIndex((balloon) => {
    if (balloon.popped) return false;
    const centre = toScreen(boardAngle, balloon.angle, balloon.distance);
    return Math.hypot(x - centre.x, y - centre.y) <= BALLOON_RADIUS;
  });
}

/** Throws one dart at (`x`, `y`). Returns the points it scored, or null if nothing was thrown. */
export function throwDart(state: BalloonDartsState, x: number, y: number): number | null {
  if (state.phase !== 'playing' || state.dartsLeft === 0) return null;
  state.dartsLeft -= 1;

  const dx = x - BOARD.x;
  const dy = y - BOARD.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= BOARD.radius) {
    state.darts.push({ angle: Math.atan2(dy, dx) - state.boardAngle, distance });
  }

  let points = 0;
  const index = balloonAt(state.balloons, state.boardAngle, x, y);
  if (index !== -1) {
    const balloon = state.balloons[index];
    balloon.popped = true;
    points = scoreForBalloon(balloon);
    state.score += points;
  }

  if (state.dartsLeft === 0 || state.balloons.every((b) => b.popped)) state.phase = 'over';
  return points;
}

/** Whether the round has ended. */
export function isOver(state: BalloonDartsState): boolean {
  return state.phase === 'over';
}

/** Advances the game by `dt` seconds. */
export function step(state: BalloonDartsState, dt: number): void {
  if (state.phase !== 'playing') return;
  state.boardAngle = (state.boardAngle + SPIN_SPEED * dt) % (Math.PI * 2);
}

function draw(
  ctx: CanvasRenderingContext2D,
  state: BalloonDartsState,
  aim: { x: number; y: number },
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

  // The board, with spokes so you can see it turn.
  ctx.fillStyle = colors.wood;
  ctx.beginPath();
  ctx.arc(BOARD.x, BOARD.y, BOARD.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.surface;
  ctx.lineWidth = 4;
  for (let i = 0; i < 6; i++) {
    const end = toScreen(state.boardAngle, (i / 6) * Math.PI * 2 + Math.PI / 6, BOARD.radius);
    ctx.beginPath();
    ctx.moveTo(BOARD.x, BOARD.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  let regular = 0;
  for (const balloon of state.balloons) {
    if (!balloon.gold) regular += 1;
    if (balloon.popped) continue;
    const { x, y } = toScreen(state.boardAngle, balloon.angle, balloon.distance);
    ctx.fillStyle = balloon.gold
      ? colors.accent
      : regular % 2 === 0
        ? colors.water
        : colors.stripeA;
    ctx.beginPath();
    ctx.arc(x, y, BALLOON_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.stripeB;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(x - 7, y - 7, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = colors.text;
  for (const dart of state.darts) {
    const { x, y } = toScreen(state.boardAngle, dart.angle, dart.distance);
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Crosshair at the aim.
  if (state.phase === 'playing') {
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, 10, 0, Math.PI * 2);
    ctx.moveTo(aim.x - 16, aim.y);
    ctx.lineTo(aim.x + 16, aim.y);
    ctx.moveTo(aim.x, aim.y - 16);
    ctx.lineTo(aim.x, aim.y + 16);
    ctx.stroke();
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Darts ${state.dartsLeft}/${DARTS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    const headline = state.balloons.every((b) => b.popped)
      ? 'Every balloon popped!'
      : 'Out of darts!';
    ctx.fillText(`${headline} You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const balloonDarts: CarnivalGame = {
  id: 'balloon-darts',
  name: 'Balloon Darts',
  description: 'Pop balloons on a spinning wheel with 10 darts. Gold balloons score 50.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    const aim = { x: BOARD.x, y: BOARD.y };

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
      if (isOver(state)) {
        state = createState();
        return;
      }
      throwDart(state, aim.x, aim.y);
      // Record the moment the round ends, so a restart or leaving can't lose it.
      if (isOver(state)) recordScore(balloonDarts.id, state.score);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't spin the board wildly.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
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

export default balloonDarts;
