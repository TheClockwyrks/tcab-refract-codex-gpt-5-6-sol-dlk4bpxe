import type { BoardState, Channel, NodeState } from "./game";

export const CAMPAIGN_BOARDS: readonly (readonly string[])[] = [
  [".Tt", "ttT", ".tt"],
  [".tt", "TtT", "tt."],
  ["tTtt", "ttTt", "ttt."],
  ["Tt.t", "tTtt", ".ttt"],
  [".tTt", ".ttt", "ttTt", "tttt"],
  ["tttT", "ttt.", "t.tt", "ttTt"],
  ["STtt", "sstt", "ssTt", "Sss."],
  ["Sst..", "stTtt", "ssttt", "SsstT"],
  ["tSss", "2tss", "Ttss", "tTS."],
  ["Tt.T.", "ttt..", "t2sSs", "tSsss"],
  ["..t.s", "ttT2s", "ttS2S", "t.Tss"],
  ["Tttt.", "ttsSt", ".22t.", "ssST."],
  [".Ddd", "tTdD", "t22.", "tsSs", "T.S."],
  ["..tT.", "t2dD.", "T2t.s", "d2sss", "DSssS"],
  [".T.2t", "sDttt", "sS2Td", "ss22D", ".S.d."],
  ["..ttt", ".S2tt", "DsTsT", "d22d.", "SddD."],
  ["...ttd", "S2Ttdd", "t32Ddd", "Tss2d.", "sS.dD."],
  ["T.....", "ttDsss", "dd3222", ".dt3Ss", "DddTSs"],
  [".Dttt", ".dd3t", ".d2TT", "S2s2D", ".sSss"],
  [".S.tT.", "s2ttDd", "s2T2.d", "s22d3.", "ssSddD"],
  ["S2D..T", "d2ssts", ".D3S3s", ".dT32t", ".d2tt."],
  [".tt2d.", ".t2t2d", "t1DdSd", "2.S3dD", "TT2sd.", ".ssss."],
  ["s2SST..", "2232.t.", "stTsttt", "..t.t.t", "d22ttdD", "dD2dddd"],
  ["ssdd.d.", "2S.dd2d", "ssD..d.", "t2ttTdd", ".t323Dd", "ttT2sS."],
];
const chars: Record<string, { kind: "emitter" | "lens"; channel: Channel }> = {
  T: { kind: "emitter", channel: "triangle" },
  t: { kind: "lens", channel: "triangle" },
  S: { kind: "emitter", channel: "square" },
  s: { kind: "lens", channel: "square" },
  D: { kind: "emitter", channel: "diamond" },
  d: { kind: "lens", channel: "diamond" },
};
export function parseBoard(lines: readonly string[]): BoardState {
  if (!lines.length || lines.length > 6)
    throw new Error("Refract: invalid board height");
  const cols = lines[0]?.length ?? 0;
  if (!cols || cols > 7 || lines.some((l) => l.length !== cols))
    throw new Error("Refract: invalid board width");
  const nodes: NodeState[] = [];
  lines.forEach((line, row) =>
    [...line].forEach((char, col) => {
      if (char === ".") return;
      if (/^[1-3]$/.test(char))
        nodes.push({
          col,
          row,
          kind: "crystal",
          channel: null,
          charges: Number(char),
        });
      else if (chars[char])
        nodes.push({ col, row, ...chars[char], charges: null });
      else throw new Error(`Refract: invalid board notation '${char}'`);
    }),
  );
  return { cols, rows: lines.length, nodes };
}
const CASCADE: readonly (readonly string[])[] = [
  ["Ttt", "ttt", "ttT"],
  ["TSss", "ttss", "ttss", "TtS."],
  ["TSss", "t2ss", "t2ss", "TtS."],
  ["TSDdd", "t2sdd", "t223d", "Tt.SD"],
  ["TSDddd", "t2.3dd", "t.33sd", "t2..sd", "Tt.S.D"],
];
export function generatedBoard(tier: number): BoardState {
  const t = CASCADE[Math.max(1, Math.min(5, tier)) - 1];
  if (!t) throw new Error("Refract: invalid tier");
  return parseBoard(t);
}
