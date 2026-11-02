# Balloon Darts

Pop the balloons on a spinning wheel before your darts run out.

## How to play

- The round board is covered in balloons and spins at a steady speed.
- Move the mouse to aim, and click to throw a dart at the point under the crosshair.
- You have 10 darts. The round ends after the last dart, or early if every balloon pops.
- Click again on the game over screen to play another round.

## Scoring

| Dart lands on                   | Points |
| ------------------------------- | ------ |
| A balloon                       | 10     |
| A gold balloon                  | 50     |
| The board, between the balloons | 0      |

The board has 18 balloons in two rings, and 3 of the outer ring's balloons are
gold. Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `throwDart`, `balloonAt`,
  `scoreForBalloon`) and the `balloonDarts` entry, the default export the
  midway finds. `balloonAt` says which balloon a dart hits, given the board's
  angle and the dart's position.
- `game.test.ts`: tests for the game logic.
