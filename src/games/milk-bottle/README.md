# Milk Bottle Knockdown

Knock down a pyramid of six milk bottles with three balls.

## How to play

- Six bottles stand on the table: three on the bottom, two in the middle and one on top.
- Aim left or right by moving the mouse, or with the arrow keys (or A and D).
- Hold the mouse button or space to charge the power meter, and release to throw.
  The meter climbs to full, then falls back, for as long as you hold.
- Power picks the row the ball reaches: a soft throw hits the bottom row, a
  medium one the middle row and a hard one the top bottle. Too soft falls short
  of the table and too hard sails over it; the meter turns red for those.
- A ball knocks over the bottles it hits. Aim between two bottles to hit both.
- A bottle with nothing standing under it falls too. A bottle still resting on
  one bottle stays up.
- The round ends after the third ball. Click or press space to play again.

## Scoring

- Each bottle knocked over scores 10.
- Clearing all six with your three balls adds a 50 point bonus, for 110 in all.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `throwBall`, `step`, `bottlesKnockedDown`,
  `scoreFor`, `powerFor`, `rowFor`) and the `milkBottle` entry, the default export
  the midway finds.
- `game.test.ts`: tests for the game logic.
