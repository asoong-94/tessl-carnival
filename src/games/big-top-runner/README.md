# Big Top Runner

Run the acrobat through the carnival backlot to the exit tent, grabbing tickets
on the way.

## How to play

- Left and right arrows, or A and D, run. Space, up or W jumps.
- Hold jump longer to jump higher. Let go early for a short hop.
- Jump over the gaps in the ground, and up onto crates, brick platforms and
  floating rows of bricks. Bricks stop you from the side and from below.
- Falling into a gap ends the run. Reaching the exit tent at the end of the
  level ends the round.
- Press space or click on the game over screen to run a new level.

Every round builds a new level from a random seed. Every gap and every step up
is within reach of a full jump, so a level can always be finished.

## Scoring

| What                       | Points |
| -------------------------- | ------ |
| Each ticket                | 10     |
| Each tile run to the right | 1      |
| Reaching the exit tent     | 200    |

Distance counts the furthest you got, so running back doesn't lose points. Your
score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic and the `bigTopRunner` entry, the default export the
  midway finds. `createRng` and `generateLevel` build a level from a seed;
  `applyRun`, `applyJump`, `applyGravity` and `moveAndCollide` move the acrobat
  and stop it at tiles; `step` runs a round and `scoreFor` adds up the score.
- `game.test.ts`: tests for the game logic.
