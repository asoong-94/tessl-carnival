# Ring Toss

Land rings on the necks of the bottles at the back of the booth before you run out.

## How to play

- Move the mouse to aim. The red cross shows where the next ring will land, and it
  sways from side to side with your hand, up to 24 px either way. A ring
  always lands ahead of your hand, so aiming below it lands the ring just in front.
- Click to throw a ring. You have 8 rings, thrown one at a time.
- A ring scores when it lands within 10 px of the centre of a bottle's neck.
- The round ends when you are out of rings and the last ring has landed.
- Click again on the game over screen to play another round.

## Scoring

The bottles stand in three rows of five. Bottles further back score more:

| Row    | Points |
| ------ | ------ |
| Back   | 30     |
| Middle | 20     |
| Front  | 10     |

A bottle can hold more than one ring, and every ring on it scores. Your final
score is saved to the carnival's score board when the round ends.

## Files

- `game.ts`: the game logic (`createState`, `landingPoint`, `toss`, `step`, `bottleAt`, `wobble`,
  `ringPosition`) and the `ringToss` entry, the default export the midway finds.
- `game.test.ts`: tests for the game logic.
