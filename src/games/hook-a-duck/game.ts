import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const CASTS = 8;
/** The stream is an oval loop the ducks float round. */
export const STREAM = { x: WIDTH / 2, y: 290, rx: 300, ry: 120 } as const;
/** Where the rod holds the hook between casts. */
export const HOOK_REST_Y = 60;
export const HOOK_SPEED = 500;
export const CATCH_RADIUS = 24;
/** Radians per second round the stream. */
export const DUCK_SPEED = 0.6;
/** The numbers on the ducks' bases, one duck each. */
export const DUCK_POINTS = [10, 20, 10, 50, 10, 20, 10, 100, 10, 20] as const;
const DUCK_RADIUS = 20;

export interface Duck {
  /** Position round the stream, in radians. */
  angle: number;
  points: number;
}

export interface Hook {
  x: number;
  y: number;
  /** How deep this cast goes. */
  targetY: number;
  phase: 'idle' | 'lowering' | 'raising';
  /** The duck on the hook, if this cast caught one. */
  caught: Duck | null;
}

export interface HookADuckState {
  ducks: Duck[];
  hook: Hook;
  casts: number;
  score: number;
  /** The last catch's points, shown above the rod for a moment. */
  lastCatch: { points: number; age: number } | null;
  phase: 'playing' | 'over';
}

export function createState(): HookADuckState {
  const ducks = DUCK_POINTS.map((points, i) => ({
    angle: (i / DUCK_POINTS.length) * Math.PI * 2,
    points,
  }));
  return {
    ducks,
    hook: { x: WIDTH / 2, y: HOOK_REST_Y, targetY: HOOK_REST_Y, phase: 'idle', caught: null },
    casts: CASTS,
    score: 0,
    lastCatch: null,
    phase: 'playing',
  };
}

export function duckPosition(duck: Duck): { x: number; y: number } {
  return {
    x: STREAM.x + Math.cos(duck.angle) * STREAM.rx,
    y: STREAM.y + Math.sin(duck.angle) * STREAM.ry,
  };
}

/** The duck nearest the hook's tip, if one is close enough to catch. */
export function duckUnderHook(state: HookADuckState): Duck | undefined {
  let nearest: Duck | undefined;
  let nearestDistance = CATCH_RADIUS;
  for (const duck of state.ducks) {
    const { x, y } = duckPosition(duck);
    const distance = Math.hypot(x - state.hook.x, y - state.hook.y);
    if (distance <= nearestDistance) {
      nearest = duck;
      nearestDistance = distance;
    }
  }
  return nearest;
}

/** Lowers the hook at `x` down to `y`. Returns false if no cast was made. */
export function cast(state: HookADuckState, x: number, y: number): boolean {
  if (state.phase !== 'playing' || state.casts === 0 || state.hook.phase !== 'idle') return false;
  state.hook.x = Math.min(Math.max(x, 0), WIDTH);
  state.hook.targetY = Math.min(Math.max(y, HOOK_REST_Y), HEIGHT);
  state.hook.phase = 'lowering';
  state.casts -= 1;
  return true;
}

/** Advances the game by `dt` seconds. */
export function step(state: HookADuckState, dt: number): void {
  for (const duck of state.ducks) {
    duck.angle = (duck.angle + DUCK_SPEED * dt) % (Math.PI * 2);
  }

  const { hook } = state;
  if (hook.phase === 'lowering') {
    hook.y = Math.min(hook.y + HOOK_SPEED * dt, hook.targetY);
    if (hook.y === hook.targetY) {
      const duck = duckUnderHook(state);
      if (duck) {
        state.ducks = state.ducks.filter((d) => d !== duck);
        hook.caught = duck;
        state.score += duck.points;
        state.lastCatch = { points: duck.points, age: 0 };
      }
      hook.phase = 'raising';
    }
  } else if (hook.phase === 'raising') {
    hook.y = Math.max(hook.y - HOOK_SPEED * dt, HOOK_REST_Y);
    if (hook.y === HOOK_REST_Y) {
      // Put the caught duck back in the stream, on the far side.
      if (hook.caught) {
        state.ducks.push({ angle: (3 * Math.PI) / 2, points: hook.caught.points });
        hook.caught = null;
      }
      hook.phase = 'idle';
    }
  }

  if (state.lastCatch) {
    state.lastCatch.age += dt;
    if (state.lastCatch.age > 1.2) state.lastCatch = null;
  }

  if (state.casts === 0 && hook.phase === 'idle') state.phase = 'over';
}

function drawDuck(ctx: CanvasRenderingContext2D, x: number, y: number, points?: number) {
  const { colors } = theme;
  ctx.fillStyle = colors.accent;
  ctx.beginPath();
  ctx.ellipse(x, y, DUCK_RADIUS, DUCK_RADIUS * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + DUCK_RADIUS * 0.6, y - DUCK_RADIUS * 0.7, DUCK_RADIUS * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.danger;
  ctx.beginPath();
  ctx.moveTo(x + DUCK_RADIUS, y - DUCK_RADIUS * 0.8);
  ctx.lineTo(x + DUCK_RADIUS * 1.4, y - DUCK_RADIUS * 0.6);
  ctx.lineTo(x + DUCK_RADIUS, y - DUCK_RADIUS * 0.5);
  ctx.fill();
  ctx.fillStyle = colors.background;
  ctx.beginPath();
  ctx.arc(x + DUCK_RADIUS * 0.7, y - DUCK_RADIUS * 0.8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  if (points !== undefined) {
    ctx.fillStyle = colors.background;
    ctx.font = canvasFont('small', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(String(points), x, y + 5);
  }
}

function draw(ctx: CanvasRenderingContext2D, state: HookADuckState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The stream: a wooden trough round a ring of water.
  ctx.fillStyle = colors.wood;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx + 40, STREAM.ry + 40, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.water;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx + 30, STREAM.ry + 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.ellipse(STREAM.x, STREAM.y, STREAM.rx - 30, STREAM.ry - 30, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ducks further back draw first.
  const ducks = [...state.ducks].sort((a, b) => duckPosition(a).y - duckPosition(b).y);
  for (const duck of ducks) {
    const { x, y } = duckPosition(duck);
    drawDuck(ctx, x, y);
  }

  // Where the next cast will land.
  const { hook } = state;
  if (hook.phase === 'idle' && state.phase === 'playing') {
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(aim.x, aim.y, CATCH_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The rod, the line and the hook.
  const hookX = hook.phase === 'idle' ? aim.x : hook.x;
  ctx.strokeStyle = colors.wood;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(hookX - 120, 30);
  ctx.lineTo(hookX, HOOK_REST_Y - 20);
  ctx.stroke();
  ctx.strokeStyle = colors.text;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(hookX, HOOK_REST_Y - 20);
  ctx.lineTo(hookX, hook.y);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(hookX, hook.y + 6, 6, 0, Math.PI);
  ctx.stroke();
  if (hook.caught) drawDuck(ctx, hookX, hook.y + DUCK_RADIUS + 10, hook.caught.points);

  if (state.lastCatch) {
    ctx.globalAlpha = Math.max(0, 1 - state.lastCatch.age / 1.2);
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.textAlign = 'center';
    ctx.fillText(`+${state.lastCatch.points}`, WIDTH / 2, 80);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Casts ${state.casts}/${CASTS}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of casts! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const hookADuck: CarnivalGame = {
  id: 'hook-a-duck',
  name: 'Hook a Duck',
  description:
    'Hook the ducks as they float round the stream. The number underneath is your score.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: WIDTH / 2, y: STREAM.y + STREAM.ry };

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
        cast(state, aim.x, aim.y);
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
        recordScore(hookADuck.id, state.score);
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

export default hookADuck;
