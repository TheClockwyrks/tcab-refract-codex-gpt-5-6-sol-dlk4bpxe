import type { Game, InitApi, UpdateApi } from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import {
  ACTIONS,
  BACK_LABEL,
  BINDINGS,
  BOARD_CX,
  BOARD_CY,
  CAMPAIGN_LENGTH,
  CELL_PITCH,
  CHANNELS,
  CLEAR_LABEL,
  CUES,
  HUD_SOLVED_LABEL,
  HUD_TIER_LABEL,
  MAX_TIER,
  NODE_HIT_R,
  NODE_R,
  REFRACT_DEBUG_VERSION,
  SET_LABELS,
  SOLVED_ITEMS,
  SOLVED_TITLE_TEXT,
  STAGE_H,
  STAGE_W,
  TAGLINE_TEXT,
  TIER_ADVANCE,
  TITLE_ITEMS,
  TITLE_TEXT,
} from "./constants";
import { CAMPAIGN_BOARDS, generatedBoard, parseBoard } from "./boards";

export type Screen =
  "title" | "howto" | "select" | "playing" | "solved" | "complete";
export type Mode = "campaign" | "cascade";
export type Channel = "triangle" | "square" | "diamond";
export type NodeKind = "emitter" | "lens" | "crystal";
export interface Cell {
  readonly col: number;
  readonly row: number;
}
export interface NodeState {
  readonly col: number;
  readonly row: number;
  readonly kind: NodeKind;
  readonly channel: Channel | null;
  readonly charges: number | null;
}
export interface BoardState {
  readonly cols: number;
  readonly rows: number;
  readonly nodes: readonly NodeState[];
}
export interface BeamState {
  readonly channel: Channel;
  readonly cells: readonly Cell[];
}
export interface TraceState {
  readonly channel: Channel;
}
export type PointerDevice = "mouse" | "pen" | "touch";
export interface PointerState {
  readonly x: number;
  readonly y: number;
  readonly down: boolean;
  readonly device: PointerDevice;
}
export interface RefractState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly board: BoardState;
  readonly beams: readonly BeamState[];
  readonly tracing: TraceState | null;
  readonly boardIndex: number;
  readonly solvedBoards: readonly number[];
  readonly unlockedCount: number;
  readonly selectIndex: number;
  readonly solvedCount: number;
  readonly tier: number;
  readonly pointer: PointerState;
  readonly armedTarget: string | null;
  readonly simTime: number;
  readonly muted: boolean;
}
interface Target {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface RefractDebugApi {
  readonly version: number;
  reset(s: DeepReadonly<RefractState>): RefractState;
  snapshot(s: DeepReadonly<RefractState>): unknown;
  reconcile(s: DeepReadonly<RefractState>): RefractState;
  setMode(s: DeepReadonly<RefractState>, m: Mode): RefractState;
  setScreen(s: DeepReadonly<RefractState>, v: Screen): RefractState;
  setMenuIndex(s: DeepReadonly<RefractState>, v: number): RefractState;
  setSolvedCount(s: DeepReadonly<RefractState>, v: number): RefractState;
  setTier(s: DeepReadonly<RefractState>, v: number): RefractState;
  generateBoard(s: DeepReadonly<RefractState>, v: number): RefractState;
  loadBoard(s: DeepReadonly<RefractState>, v: readonly string[]): RefractState;
  pointerDown(
    s: DeepReadonly<RefractState>,
    x: number,
    y: number,
    d?: PointerDevice,
  ): RefractState;
  pointerMove(
    s: DeepReadonly<RefractState>,
    x: number,
    y: number,
    d?: PointerDevice,
  ): RefractState;
  pointerUp(s: DeepReadonly<RefractState>, d?: PointerDevice): RefractState;
  clear(s: DeepReadonly<RefractState>): RefractState;
}
export const BACKGROUND = "#071018";
const colors: Record<Channel, string> = {
  triangle: "#ff4f9a",
  square: "#45e6ff",
  diamond: "#ffd166",
};
const cx = (c: number, n: number) =>
    BOARD_CX - ((n - 1) * CELL_PITCH) / 2 + c * CELL_PITCH,
  cy = (r: number, n: number) =>
    BOARD_CY - ((n - 1) * CELL_PITCH) / 2 + r * CELL_PITCH,
  same = (a: Cell, b: Cell) => a.col === b.col && a.row === b.row;
function copy(s: DeepReadonly<RefractState>): RefractState {
  return {
    ...s,
    board: { ...s.board, nodes: s.board.nodes.map((n) => ({ ...n })) },
    beams: s.beams.map((b) => ({
      channel: b.channel,
      cells: b.cells.map((c) => ({ ...c })),
    })),
    solvedBoards: [...s.solvedBoards],
    pointer: { ...s.pointer },
    tracing: s.tracing ? { ...s.tracing } : null,
  };
}
function fresh(muted = false): RefractState {
  return {
    screen: "title",
    mode: "campaign",
    menuIndex: 0,
    board: { cols: 1, rows: 1, nodes: [] },
    beams: [],
    tracing: null,
    boardIndex: 0,
    solvedBoards: [],
    unlockedCount: 1,
    selectIndex: 0,
    solvedCount: 0,
    tier: 1,
    pointer: { x: 0, y: 0, down: false, device: "mouse" },
    armedTarget: null,
    simTime: 0,
    muted,
  };
}
const channels = (b: DeepReadonly<BoardState>) =>
  CHANNELS.filter((c) => b.nodes.some((n) => n.channel === c));
const empty = (b: DeepReadonly<BoardState>): BeamState[] =>
  channels(b).map((channel) => ({ channel, cells: [] }));
function degree(cells: readonly DeepReadonly<Cell>[], p: Cell) {
  let n = 0;
  for (let i = 1; i < cells.length; i++)
    if (same(cells[i - 1]!, p) || same(cells[i]!, p)) n++;
  return n;
}
const spent = (s: DeepReadonly<RefractState>, p: Cell) =>
  s.beams.reduce((n, b) => n + b.cells.filter((c) => same(c, p)).length, 0);
function complete(s: DeepReadonly<RefractState>, b: DeepReadonly<BeamState>) {
  if (b.cells.length < 2) return false;
  return s.board.nodes
    .filter((n) => n.channel === b.channel)
    .every((n) => degree(b.cells, n) === (n.kind === "emitter" ? 1 : 2));
}
function isSolved(s: DeepReadonly<RefractState>) {
  return (
    s.beams.length > 0 &&
    s.beams.every((b) => complete(s, b)) &&
    s.board.nodes
      .filter((n) => n.kind === "crystal")
      .every(
        (n) =>
          spent(s, n) === n.charges &&
          s.beams.reduce((v, b) => v + degree(b.cells, n), 0) ===
            (n.charges ?? 0) * 2,
      )
  );
}
function targets(s: DeepReadonly<RefractState>): Target[] {
  if (s.screen === "title")
    return TITLE_ITEMS.map((_, i) => ({
      id: `menu-${i}`,
      x: 480,
      y: 348 + i * 82,
      w: 320,
      h: 72,
    }));
  if (s.screen === "howto")
    return [{ id: "back", x: 48, y: 616, w: 128, h: 72 }];
  if (s.screen === "select")
    return [
      ...Array.from({ length: 24 }, (_, i) => ({
        id: `board-${i + 1}`,
        x: 250 + (i % 6) * 132,
        y: 190 + Math.floor(i / 6) * 98,
        w: 104,
        h: 76,
      })),
      { id: "back", x: 48, y: 616, w: 128, h: 72 },
    ];
  if (s.screen === "playing")
    return [
      { id: "clear", x: 1056, y: 616, w: 176, h: 72 },
      { id: "back", x: 48, y: 616, w: 128, h: 72 },
    ];
  const n =
    s.screen === "complete"
      ? 2
      : s.mode === "cascade"
        ? 2
        : s.boardIndex < 23
          ? 3
          : 2;
  return Array.from({ length: n }, (_, i) => ({
    id: `menu-${i}`,
    x: 470,
    y: 350 + i * 78,
    w: 340,
    h: 72,
  }));
}
const targetAt = (s: DeepReadonly<RefractState>, x: number, y: number) =>
  targets(s).find(
    (t) => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h,
  );
const nodeAt = (s: DeepReadonly<RefractState>, x: number, y: number) =>
  s.board.nodes.find(
    (n) =>
      Math.hypot(x - cx(n.col, s.board.cols), y - cy(n.row, s.board.rows)) <=
      NODE_HIT_R,
  ) as NodeState | undefined;
function boardPose(s: DeepReadonly<RefractState>, b: BoardState): RefractState {
  return {
    ...copy(s),
    screen: "playing",
    menuIndex: 0,
    board: b,
    beams: empty(b),
    tracing: null,
    armedTarget: null,
  };
}
function clear(s: DeepReadonly<RefractState>): RefractState {
  return {
    ...copy(s),
    beams: s.beams.map((b) => ({ channel: b.channel, cells: [] })),
    tracing: null,
  };
}
function legal(
  s: DeepReadonly<RefractState>,
  b: DeepReadonly<BeamState>,
  to: NodeState,
) {
  const from = b.cells[b.cells.length - 1];
  if (
    !from ||
    same(from, to) ||
    Math.abs(from.col - to.col) > 1 ||
    Math.abs(from.row - to.row) > 1 ||
    (to.channel !== null && to.channel !== b.channel)
  )
    return false;
  const fromNode = s.board.nodes.find((n) => same(n, from));
  if (fromNode?.kind === "emitter" && degree(b.cells, fromNode) >= 1)
    return false;
  if (fromNode?.kind === "lens" && degree(b.cells, fromNode) >= 2) return false;
  for (const q of s.beams)
    for (let i = 1; i < q.cells.length; i++) {
      const a = q.cells[i - 1]!,
        z = q.cells[i]!;
      if ((same(a, from) && same(z, to)) || (same(a, to) && same(z, from)))
        return false;
      if (
        Math.abs(a.col - z.col) === 1 &&
        Math.abs(a.row - z.row) === 1 &&
        Math.abs(from.col - to.col) === 1 &&
        Math.abs(from.row - to.row) === 1 &&
        a.col + z.col === from.col + to.col &&
        a.row + z.row === from.row + to.row
      )
        return false;
    }
  if (to.kind === "emitter" && degree(b.cells, to) >= 1) return false;
  if (to.kind === "lens" && degree(b.cells, to) >= 2) return false;
  if (to.kind === "crystal" && spent(s, to) >= (to.charges ?? 0)) return false;
  return true;
}
function finish(s: RefractState) {
  if (!isSolved(s)) return s;
  if (s.mode === "cascade") {
    const v = s.solvedCount + 1;
    return {
      ...s,
      screen: "solved" as const,
      tracing: null,
      menuIndex: 0,
      solvedCount: v,
      tier: Math.min(Math.floor(v / TIER_ADVANCE) + 1, MAX_TIER),
    };
  }
  const list = s.solvedBoards.includes(s.boardIndex)
    ? [...s.solvedBoards]
    : [...s.solvedBoards, s.boardIndex].sort((a, b) => a - b);
  return {
    ...s,
    screen:
      list.length === CAMPAIGN_LENGTH
        ? ("complete" as const)
        : ("solved" as const),
    tracing: null,
    menuIndex: 0,
    solvedBoards: list,
    unlockedCount: Math.min(24, Math.max(s.unlockedCount, s.boardIndex + 2)),
    selectIndex: s.boardIndex,
  };
}
function down(
  s: DeepReadonly<RefractState>,
  x: number,
  y: number,
  d: PointerDevice = "mouse",
) {
  let n = { ...copy(s), pointer: { x, y, down: true, device: d } };
  const t = targetAt(n, x, y);
  if (t) {
    if (t.id.startsWith("menu-")) n = { ...n, menuIndex: +t.id.slice(5) };
    if (t.id.startsWith("board-"))
      n = { ...n, selectIndex: +t.id.slice(6) - 1 };
    return { ...n, armedTarget: t.id };
  }
  if (n.screen !== "playing") return n;
  const node = nodeAt(n, x, y);
  if (!node) return n;
  for (const b of n.beams) {
    let cells: Cell[] | null = null;
    if (
      !b.cells.length &&
      node.kind === "emitter" &&
      node.channel === b.channel
    )
      cells = [{ col: node.col, row: node.row }];
    else if (
      b.cells[b.cells.length - 1] &&
      same(b.cells[b.cells.length - 1]!, node)
    )
      cells = b.cells.map((c) => ({ ...c }));
    else if (b.cells[0] && same(b.cells[0], node))
      cells = [...b.cells].reverse().map((c) => ({ ...c }));
    else {
      const indexes = b.cells
        .map((c, i) => (same(c, node) ? i : -1))
        .filter((i) => i >= 0);
      const i = indexes[indexes.length - 1];
      if (
        i !== undefined &&
        n.beams.filter((q) => q.cells.some((c) => same(c, node))).length === 1
      )
        cells = b.cells.slice(0, i + 1).map((c) => ({ ...c }));
    }
    if (cells)
      return {
        ...n,
        beams: n.beams.map((q) =>
          q.channel === b.channel ? { ...q, cells } : q,
        ),
        tracing: { channel: b.channel },
      };
  }
  return n;
}
function move(
  s: DeepReadonly<RefractState>,
  x: number,
  y: number,
  d: PointerDevice = "mouse",
) {
  let n = { ...copy(s), pointer: { x, y, down: s.pointer.down, device: d } };
  if (!n.pointer.down) {
    const t = targetAt(n, x, y);
    if (t?.id.startsWith("menu-")) n = { ...n, menuIndex: +t.id.slice(5) };
    if (t?.id.startsWith("board-"))
      n = { ...n, selectIndex: +t.id.slice(6) - 1 };
    return n;
  }
  if (!n.tracing) return n;
  const node = nodeAt(n, x, y),
    b = n.beams.find((q) => q.channel === n.tracing?.channel);
  if (!node || !b) return n;
  if (b.cells.length > 1 && same(b.cells[b.cells.length - 2]!, node))
    n = {
      ...n,
      beams: n.beams.map((q) =>
        q.channel === b.channel ? { ...q, cells: q.cells.slice(0, -1) } : q,
      ),
    };
  else if (legal(n, b, node))
    n = {
      ...n,
      beams: n.beams.map((q) =>
        q.channel === b.channel
          ? { ...q, cells: [...q.cells, { col: node.col, row: node.row }] }
          : q,
      ),
    };
  return finish(n);
}
function enter(s: DeepReadonly<RefractState>, i: number) {
  return {
    ...boardPose(s, parseBoard(CAMPAIGN_BOARDS[i]!)),
    mode: "campaign" as const,
    boardIndex: i,
    selectIndex: i,
  };
}
function back(s: DeepReadonly<RefractState>): RefractState {
  if (s.screen === "title") return copy(s);
  if (s.screen === "howto")
    return { ...copy(s), screen: "title", menuIndex: 2 };
  if (s.screen === "select")
    return { ...copy(s), screen: "title", menuIndex: 0 };
  if (s.screen === "playing")
    return s.mode === "campaign"
      ? { ...clear(s), screen: "select", selectIndex: s.boardIndex }
      : { ...clear(s), screen: "title", menuIndex: 1 };
  return s.mode === "campaign"
    ? { ...copy(s), screen: "select", menuIndex: 0 }
    : { ...copy(s), screen: "title", menuIndex: 1 };
}
function confirm(s: DeepReadonly<RefractState>): RefractState {
  if (s.screen === "title") {
    if (s.menuIndex === 0)
      return { ...copy(s), mode: "campaign", screen: "select" };
    if (s.menuIndex === 1)
      return {
        ...boardPose(
          { ...copy(s), mode: "cascade", solvedCount: 0, tier: 1 },
          generatedBoard(1),
        ),
        mode: "cascade",
        solvedCount: 0,
        tier: 1,
      };
    return { ...copy(s), screen: "howto", menuIndex: 0 };
  }
  if (s.screen === "select")
    return s.selectIndex < s.unlockedCount ? enter(s, s.selectIndex) : copy(s);
  if (s.screen === "solved") {
    if (s.mode === "cascade")
      return s.menuIndex === 0
        ? boardPose(s, generatedBoard(s.tier))
        : boardPose({ ...copy(s), solvedCount: 0, tier: 1 }, generatedBoard(1));
    const next = s.boardIndex < 23;
    if (next && s.menuIndex === 0) return enter(s, s.boardIndex + 1);
    if (s.menuIndex === (next ? 1 : 0)) return enter(s, s.boardIndex);
    return { ...copy(s), screen: "select", menuIndex: 0 };
  }
  if (s.screen === "complete")
    return s.menuIndex === 0
      ? { ...copy(s), screen: "select" }
      : { ...copy(s), screen: "title", menuIndex: 0 };
  return copy(s);
}
function activate(s: DeepReadonly<RefractState>, id: string) {
  if (id === "clear") return clear(s);
  if (id === "back") return back(s);
  if (id.startsWith("board-")) {
    const i = +id.slice(6) - 1;
    return i < s.unlockedCount ? enter(s, i) : copy(s);
  }
  return confirm({ ...copy(s), menuIndex: +id.slice(5) });
}
function up(s: DeepReadonly<RefractState>, d: PointerDevice = "mouse") {
  let n = {
    ...copy(s),
    pointer: { ...s.pointer, down: false, device: d },
    tracing: null,
  };
  const t = targetAt(n, n.pointer.x, n.pointer.y),
    take = t?.id === n.armedTarget ? t.id : null;
  n = { ...n, armedTarget: null };
  if (s.tracing)
    n = {
      ...n,
      beams: n.beams.map((b) =>
        b.channel === s.tracing?.channel && b.cells.length === 1
          ? { ...b, cells: [] }
          : b,
      ),
    };
  return take ? activate(n, take) : n;
}
function snapshot(s: DeepReadonly<RefractState>) {
  return {
    version: 2,
    screen: s.screen,
    mode: s.mode,
    menuIndex: s.menuIndex,
    boardIndex: s.boardIndex,
    solvedBoards: [...s.solvedBoards],
    unlockedCount: s.unlockedCount,
    selectIndex: s.selectIndex,
    solvedCount: s.solvedCount,
    tier: s.tier,
    board: {
      cols: s.board.cols,
      rows: s.board.rows,
      nodes: s.board.nodes.map((n) => ({
        ...n,
        x: cx(n.col, s.board.cols),
        y: cy(n.row, s.board.rows),
        spent: n.kind === "crystal" ? spent(s, n) : null,
      })),
    },
    beams: Object.fromEntries(
      s.beams.map((b) => [
        b.channel,
        { cells: b.cells.map((c) => ({ ...c })), complete: complete(s, b) },
      ]),
    ),
    solved: isSolved(s),
    tracing: s.tracing
      ? {
          channel: s.tracing.channel,
          live: {
            ...s.beams.find((b) => b.channel === s.tracing?.channel)!.cells[
              s.beams.find((b) => b.channel === s.tracing?.channel)!.cells
                .length - 1
            ]!,
          },
        }
      : null,
    pointer: { ...s.pointer },
    targets: targets(s),
    muted: s.muted,
    simTime: s.simTime,
  };
}
const debug: RefractDebugApi = {
  version: REFRACT_DEBUG_VERSION,
  reset: (s) => fresh(s.muted),
  snapshot,
  reconcile: copy,
  setMode: (s, mode) => ({ ...copy(s), mode }),
  setScreen: (s, screen) => ({ ...copy(s), screen, armedTarget: null }),
  setMenuIndex: (s, menuIndex) => ({ ...copy(s), menuIndex }),
  setSolvedCount: (s, solvedCount) => ({ ...copy(s), solvedCount }),
  setTier: (s, tier) => ({ ...copy(s), tier }),
  generateBoard: (s, t) => boardPose(s, generatedBoard(t)),
  loadBoard: (s, b) => boardPose(s, parseBoard(b)),
  pointerDown: down,
  pointerMove: move,
  pointerUp: up,
  clear,
};
function menuN(s: DeepReadonly<RefractState>) {
  return s.screen === "title"
    ? 3
    : s.screen === "solved"
      ? s.mode === "cascade"
        ? 2
        : s.boardIndex < 23
          ? 3
          : 2
      : s.screen === "complete"
        ? 2
        : 0;
}
function inputs(state: DeepReadonly<RefractState>, api: UpdateApi) {
  let s = copy(state);
  if (api.input.pressed("mute")) api.audio.setMuted(!api.audio.muted());
  for (const p of api.input.pointerSamples().filter((p) => p.primary)) {
    if (p.type === "down" && p.button === "primary")
      s = down(s, p.x, p.y, p.device);
    else if (p.type === "move") s = move(s, p.x, p.y, p.device);
    else if (p.type === "up" && p.button === "primary") s = up(s, p.device);
  }
  if (api.input.pressed("back")) s = back(s);
  if (api.input.pressed("clear") && s.screen === "playing") s = clear(s);
  const n = menuN(s),
    prev = api.input.pressed("up"),
    next = api.input.pressed("down");
  if (n && prev) s = { ...s, menuIndex: (s.menuIndex + n - 1) % n };
  if (n && next) s = { ...s, menuIndex: (s.menuIndex + 1) % n };
  if (s.screen === "select") {
    if (api.input.pressed("left"))
      s = {
        ...s,
        selectIndex:
          Math.floor(s.selectIndex / 6) * 6 + ((s.selectIndex + 5) % 6),
      };
    if (api.input.pressed("right"))
      s = {
        ...s,
        selectIndex:
          Math.floor(s.selectIndex / 6) * 6 + ((s.selectIndex + 1) % 6),
      };
    if (prev) s = { ...s, selectIndex: (s.selectIndex + 18) % 24 };
    if (next) s = { ...s, selectIndex: (s.selectIndex + 6) % 24 };
  }
  if (api.input.pressed("confirm")) s = confirm(s);
  return s;
}
export const game: Game<RefractState, RefractDebugApi> = {
  initialize(api: InitApi<RefractState>) {
    for (const a of ACTIONS) api.input.register(a, { keys: [...BINDINGS[a]] });
    Object.entries({
      [CUES.connect]: [520, 720, 65],
      [CUES.retract]: [310, 190, 60],
      [CUES.channelComplete]: [640, 980, 150],
      [CUES.solved]: [420, 1100, 260],
      [CUES.clear]: [260, 90, 100],
    }).forEach(([name, v]) =>
      api.audio.define(name, {
        freq: v[0]!,
        freqTo: v[1]!,
        durationMs: v[2]!,
        gain: 0.12,
      }),
    );
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("board", (s) => `${s.board.cols}x${s.board.rows}`);
    CHANNELS.forEach((c) =>
      api.diagnostics.register(c, (s) => {
        const b = s.beams.find((b) => b.channel === c);
        return b
          ? `${b.cells.length - 1}/${complete(s, b) ? "done" : "open"}`
          : "-";
      }),
    );
    api.diagnostics.register(
      "crystals",
      (s) =>
        s.board.nodes
          .filter((n) => n.kind === "crystal")
          .map((n) => `${spent(s, n)}/${n.charges}`)
          .join(" ") || "-",
    );
    api.diagnostics.register("solved", isSolved);
    api.diagnostics.register(
      "pointer",
      (s) =>
        `${s.pointer.x.toFixed(0)},${s.pointer.y.toFixed(0)} ${s.pointer.device}`,
    );
    return [fresh(), debug];
  },
  update(state, api, dt) {
    const old = copy(state);
    let s = inputs(state, api);
    const p = api.input.pointer();
    s = {
      ...s,
      pointer: { x: p.x, y: p.y, down: p.down, device: p.device },
      simTime: state.simTime + dt,
      muted: api.audio.muted(),
    };
    const a = old.beams.reduce((n, b) => n + b.cells.length, 0),
      b = s.beams.reduce((n, q) => n + q.cells.length, 0);
    if (b > a) api.audio.play(CUES.connect);
    if (b < a && s.screen === "playing") api.audio.play(CUES.retract);
    if (
      s.screen !== old.screen &&
      (s.screen === "solved" || s.screen === "complete")
    )
      api.audio.play(CUES.solved);
    else if (
      s.beams.some(
        (q) =>
          complete(s, q) &&
          !old.beams.some((x) => x.channel === q.channel && complete(old, x)),
      )
    )
      api.audio.play(CUES.channelComplete);
    return s;
  },
  render(s, api) {
    render(s, api.ctx);
  },
};
function txt(
  c: CanvasRenderingContext2D,
  v: string,
  x: number,
  y: number,
  z = 24,
  color = "#d9f7ff",
) {
  c.font = `600 ${z}px system-ui`;
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.fillStyle = color;
  c.fillText(v, x, y);
}
function box(c: CanvasRenderingContext2D, t: Target, on = false) {
  c.fillStyle = on ? "#173e51" : "#0c202d";
  c.strokeStyle = on ? "#72edff" : "#315260";
  c.lineWidth = 2;
  c.beginPath();
  c.roundRect(t.x, t.y, t.w, t.h, 12);
  c.fill();
  c.stroke();
}
function boardDraw(c: CanvasRenderingContext2D, s: DeepReadonly<RefractState>) {
  for (const n of s.board.nodes) {
    c.fillStyle = "#102936";
    c.beginPath();
    c.arc(
      cx(n.col, s.board.cols),
      cy(n.row, s.board.rows),
      NODE_R + 9,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  for (const b of s.beams) {
    c.strokeStyle = colors[b.channel];
    c.shadowColor = colors[b.channel];
    c.shadowBlur = 15;
    c.lineWidth = 9;
    c.lineCap = "round";
    c.beginPath();
    b.cells.forEach((p, i) =>
      i
        ? c.lineTo(cx(p.col, s.board.cols), cy(p.row, s.board.rows))
        : c.moveTo(cx(p.col, s.board.cols), cy(p.row, s.board.rows)),
    );
    c.stroke();
    c.shadowBlur = 0;
  }
  for (const n of s.board.nodes) {
    const x = cx(n.col, s.board.cols),
      y = cy(n.row, s.board.rows);
    c.save();
    c.translate(x, y);
    if (n.kind === "crystal") {
      c.rotate(Math.PI / 4);
      c.fillStyle = "#c8f7ff";
      c.fillRect(-22, -22, 44, 44);
      c.fillStyle = "#153240";
      c.fillRect(-15, -15, 30, 30);
      c.restore();
      txt(c, `${spent(s, n)}/${n.charges}`, x, y, 16);
      continue;
    }
    c.strokeStyle = colors[n.channel!];
    c.fillStyle = colors[n.channel!];
    c.lineWidth = 4;
    c.beginPath();
    if (n.channel === "triangle") {
      c.moveTo(0, -27);
      c.lineTo(25, 21);
      c.lineTo(-25, 21);
      c.closePath();
    } else if (n.channel === "square") c.rect(-23, -23, 46, 46);
    else {
      c.moveTo(0, -28);
      c.lineTo(28, 0);
      c.lineTo(0, 28);
      c.lineTo(-28, 0);
      c.closePath();
    }
    if (n.kind === "lens") c.fill();
    else c.stroke();
    c.restore();
  }
}
function render(s: DeepReadonly<RefractState>, c: CanvasRenderingContext2D) {
  c.fillStyle = BACKGROUND;
  c.fillRect(0, 0, STAGE_W, STAGE_H);
  const g = c.createRadialGradient(640, 350, 80, 640, 350, 700);
  g.addColorStop(0, "#112d3b");
  g.addColorStop(1, BACKGROUND);
  c.fillStyle = g;
  c.fillRect(0, 0, STAGE_W, STAGE_H);
  if (["playing", "solved", "complete"].includes(s.screen)) boardDraw(c, s);
  if (s.screen === "title") {
    txt(c, TITLE_TEXT, 640, 155, 80, "#72edff");
    txt(c, TAGLINE_TEXT, 640, 230, 20, "#789eaa");
    TITLE_ITEMS.forEach((v, i) => {
      const t = targets(s)[i]!;
      box(c, t, s.menuIndex === i);
      txt(c, v, t.x + t.w / 2, t.y + t.h / 2);
    });
  } else if (s.screen === "howto") {
    txt(c, "HOW TO PLAY", 640, 65, 38, "#72edff");
    [
      "Trace from one outlined emitter to its twin.",
      "Thread every filled lens of that shape.",
      "Move to any of the 8 neighboring nodes — never across empty space.",
      "Other channels block the beam. Segments cannot overlap or cross.",
      "Crystals welcome any color; spend every charge exactly.",
      "Backtrack while dragging to unwind. Release to keep a partial beam.",
      "R clears every beam. M toggles sound.",
    ].forEach((v, i) => txt(c, v, 640, 150 + i * 58, 22));
    const t = targets(s)[0]!;
    box(c, t);
    txt(c, BACK_LABEL, t.x + t.w / 2, t.y + t.h / 2, 20);
  } else if (s.screen === "select") {
    txt(c, "CAMPAIGN", 640, 70, 42, "#72edff");
    SET_LABELS.forEach((v, i) => txt(c, v, 180, 228 + i * 98, 16));
    targets(s)
      .slice(0, 24)
      .forEach((t, i) => {
        box(c, t, s.selectIndex === i);
        txt(c, String(i + 1), t.x + t.w / 2, t.y + 27, 21);
        txt(
          c,
          s.solvedBoards.includes(i)
            ? "✓"
            : i < s.unlockedCount
              ? "OPEN"
              : "LOCK",
          t.x + t.w / 2,
          t.y + 55,
          12,
        );
      });
    const allTargets = targets(s);
    const t = allTargets[allTargets.length - 1]!;
    box(c, t);
    txt(c, BACK_LABEL, t.x + t.w / 2, t.y + t.h / 2, 20);
  } else if (s.screen === "playing") {
    txt(
      c,
      s.mode === "campaign"
        ? `BOARD ${s.boardIndex + 1}`
        : `${HUD_SOLVED_LABEL} ${s.solvedCount}    ${HUD_TIER_LABEL} ${s.tier}`,
      640,
      62,
      25,
      "#9bc7d3",
    );
    targets(s).forEach((t) => {
      box(c, t);
      txt(
        c,
        t.id === "clear" ? `${CLEAR_LABEL} [R]` : BACK_LABEL,
        t.x + t.w / 2,
        t.y + t.h / 2,
        18,
      );
    });
    s.beams.forEach((b, i) =>
      txt(
        c,
        complete(s, b) ? "●" : "○",
        540 + i * 100,
        110,
        26,
        colors[b.channel],
      ),
    );
  } else {
    c.fillStyle = "rgba(4,10,16,.82)";
    c.fillRect(380, 215, 520, 350);
    txt(
      c,
      s.screen === "complete" ? "CAMPAIGN COMPLETE" : SOLVED_TITLE_TEXT,
      640,
      270,
      36,
      "#72edff",
    );
    const labels =
      s.screen === "complete"
        ? ["BACK TO SELECT", "BACK TO TITLE"]
        : s.mode === "cascade"
          ? [...SOLVED_ITEMS]
          : s.boardIndex < 23
            ? ["NEXT BOARD", "REPLAY", "BACK TO SELECT"]
            : ["REPLAY", "BACK TO SELECT"];
    targets(s).forEach((t, i) => {
      box(c, t, s.menuIndex === i);
      txt(c, labels[i]!, t.x + t.w / 2, t.y + t.h / 2, 20);
    });
  }
  txt(c, s.muted ? "MUTED · M" : "SOUND · M", 1180, 28, 13, "#567783");
}
