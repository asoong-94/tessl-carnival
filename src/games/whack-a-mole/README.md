# Whack-a-Mole

Moles pop up from a grid of nine holes. Whack them before they duck back down.

## How to play

- Click a mole while it's up to whack it.
- Each mole stays up for a short time, then drops back down.
- Moles pop up faster, and stay up for less time, as the round goes on: one
  every 1 second at the start, down to one every 0.35 seconds at the end.
- A round lasts 30 seconds. Click again on the game over screen to play another
  round.

## Scoring

Every mole you whack scores 10 points. Clicking an empty hole costs nothing.

Your final score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `step`, `popUp`, `whack`,
  `spawnGap`, `upTime`) and the `whackAMole` entry, the default export the
  midway finds.
- `game.test.ts`: tests for the game logic.
