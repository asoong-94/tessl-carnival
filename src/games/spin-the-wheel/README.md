# Spin the Wheel

Charge up the prize wheel and spin it five times. Watch out for BANKRUPT.

## How to play

- Hold the mouse button or space to charge the spin, and let go to spin. The
  power meter on the left fills while you hold: a longer hold spins harder, up
  to full power after 1.5 seconds. Only the control you started with lets go:
  holding space and clicking doesn't spin. If the game loses focus while you
  hold, the charge is dropped and the spin isn't used.
- The wheel slows down and stops, and the slice under the pointer at the top
  scores.
- You get 5 spins per round. The round ends when the fifth spin stops.
- Click or press space on the game over screen to play another round.

## Scoring

The wheel has 12 slices:

| Slice    | How many | Points                        |
| -------- | -------- | ----------------------------- |
| 5        | 3        | 5                             |
| 10       | 3        | 10                            |
| 20       | 2        | 20                            |
| 50       | 2        | 50                            |
| 100      | 1        | 100                           |
| BANKRUPT | 1        | Resets the round's score to 0 |

Your score after the fifth spin is saved to the carnival's score board.

## Files

- `game.ts`: the game logic (`createState`, `startCharge`, `release`,
  `cancelCharge`, `step`,
  `landingSlice`, `applySlice`) and the `spinTheWheel` entry, the default export
  the midway finds. `landingSlice(startAngle, power)` gives the slice a spin
  stops on.
- `game.test.ts`: tests for the game logic.
