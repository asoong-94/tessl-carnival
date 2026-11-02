# Hook a Duck

Rubber ducks float round a stream. Lower the hook to catch one as it passes.

## How to play

- Move the mouse to aim the hook: the ring shows where it will land.
- Click to cast. The hook drops to that spot, and catches the nearest duck within
  24 px of it when it gets there, then comes back up.
- You can't cast again until the hook is back up.
- You have 8 casts. The round ends when the last cast is back up.
- Click again on the game over screen to play another round.

## Scoring

Each duck has a number on its base, and catching it scores that number. The
stream has ten ducks:

| Points | Ducks |
| ------ | ----- |
| 10     | 5     |
| 20     | 3     |
| 50     | 1     |
| 100    | 1     |

A caught duck goes back into the stream when the hook is back up, so every duck
can be caught again. A miss scores nothing but still uses the cast.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `cast`, `step`, `duckPosition`,
  `duckUnderHook`) and the `hookADuck` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
