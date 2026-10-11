# Refract

Refract is a browser puzzle about drawing light. Trace each colored beam between its two outlined emitters, thread every matching filled lens, and spend every crystal charge without overlapping or crossing segments.

## Run it

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. To create the self-contained static build, run `npm run build`. The finished site is written to `dist/`.

## Controls

- Mouse, pen, or touch: press a node and drag through adjacent nodes; drag backward to retract.
- Arrow keys or WASD: move menu and board-select highlights.
- Enter or Space: confirm.
- Escape: back.
- R: clear all beams on the current board.
- M: toggle sound.

Campaign contains 24 hand-built boards with session-long unlocking. Cascade generates an endless run whose tier rises every five solved boards.

## Quality checks

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test`.
