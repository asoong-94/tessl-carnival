# Skee-Ball

Roll nine balls up the ramp and into the rings on the board.

## How to play

- Move the mouse left or right to aim, or use the left and right arrow keys (or A and D).
- Hold the mouse button or space to charge power, and let go to roll the ball.
- Power decides how far up the board the ball goes, and aim decides how far left or right.
  The power meter on the right has a mark: below it, the ball drops in the gutter.
- You have 9 balls. The round ends when the last ball lands.
- If you switch away from the game while charging, the charge is dropped and you keep the ball.
- Click or press space on the game over screen to play another round.

## Scoring

| Where the ball lands          | Points         |
| ----------------------------- | -------------- |
| Centre ring                   | 50             |
| Next rings outwards           | 40, 30, 20, 10 |
| Either small corner pocket    | 100            |
| The board outside every ring  | 0              |
| The gutter (too little power) | 0              |

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `landingFor`, `setAim`, `startCharge`,
  `release`, `cancelCharge`, `step`) and the `skeeBall` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
