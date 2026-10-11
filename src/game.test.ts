import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { describe, expect, it } from "vitest";
import { BOARD_CX, BOARD_CY, CELL_PITCH } from "./constants";
import { game } from "./game";
async function setup() {
  const canvas = createCanvas(1280, 720);
  const events = new EventTarget();
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: 1280,
    height: 720,
    game,
    clock: new ConstantClock(1000 / 60),
    surface: {
      cssWidth: () => 1280,
      cssHeight: () => 720,
      dpr: () => 1,
      events: () => events,
    },
  });
  await engine.initialize();
  return engine;
}
describe("Refract simulation", () => {
  it("initializes state and advances time", async () => {
    const e = await setup();
    expect(e.debug.snapshot(e.state)).toMatchObject({
      version: 2,
      screen: "title",
      mode: "campaign",
      unlockedCount: 1,
    });
    await e.advance(6);
    expect(e.state.simTime).toBeCloseTo(0.1);
    await e.destroy();
  });
  it("traces a legal beam to solve", async () => {
    const e = await setup();
    e.apply((s) => e.debug.loadBoard(s, ["TtT"]));
    const x = (col: number) => BOARD_CX - CELL_PITCH + col * CELL_PITCH;
    let s = e.debug.pointerDown(e.state, x(0), BOARD_CY);
    s = e.debug.pointerMove(s, x(1), BOARD_CY);
    s = e.debug.pointerMove(s, x(2), BOARD_CY);
    const snap = e.debug.snapshot(s) as {
      solved: boolean;
      screen: string;
      beams: { triangle: { cells: unknown[]; complete: boolean } };
    };
    expect(snap.solved).toBe(true);
    expect(snap.screen).toBe("solved");
    expect(snap.beams.triangle.complete).toBe(true);
    expect(snap.beams.triangle.cells).toHaveLength(3);
    await e.destroy();
  });
  it("refuses a foreign channel and retracts", async () => {
    const e = await setup();
    e.apply((s) => e.debug.loadBoard(s, ["TS", "tT"]));
    const x0 = BOARD_CX - CELL_PITCH / 2,
      x1 = BOARD_CX + CELL_PITCH / 2,
      y0 = BOARD_CY - CELL_PITCH / 2,
      y1 = BOARD_CY + CELL_PITCH / 2;
    let s = e.debug.pointerDown(e.state, x0, y0);
    s = e.debug.pointerMove(s, x1, y0);
    let snap = e.debug.snapshot(s) as {
      beams: { triangle: { cells: unknown[] } };
    };
    expect(snap.beams.triangle.cells).toHaveLength(1);
    s = e.debug.pointerMove(s, x0, y1);
    s = e.debug.pointerMove(s, x0, y0);
    snap = e.debug.snapshot(s) as typeof snap;
    expect(snap.beams.triangle.cells).toHaveLength(1);
    await e.destroy();
  });
  it("validates notation and target sizes", async () => {
    const e = await setup();
    expect(() => e.debug.loadBoard(e.state, ["X"])).toThrow(
      "invalid board notation",
    );
    const snap = e.debug.snapshot(e.state) as {
      targets: { id: string; w: number; h: number }[];
    };
    expect(snap.targets.map((t) => t.id)).toEqual([
      "menu-0",
      "menu-1",
      "menu-2",
    ]);
    expect(snap.targets.every((t) => t.w >= 96 && t.h >= 72)).toBe(true);
    await e.destroy();
  });
});
