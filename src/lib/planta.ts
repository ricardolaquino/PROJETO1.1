export const PX_PER_M = 26;
export const SNAP = PX_PER_M / 4; // 0.25 m
export const JOIN_RADIUS = 18; // px: imã para unir paredes

export type DeviceKind =
  | "bullet"
  | "dome"
  | "speed"
  | "fisheye"
  | "wifi"
  | "sensor"
  | "alarme"
  | "teclado"
  | "dvr"
  | "porta"
  | "portao"
  | "janela"
  | "escada"
  | "carro"
  | "moto"
  | "pessoa"
  | "pet";

export type Wall = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type Device = {
  id: string;
  kind: DeviceKind;
  x: number;
  y: number;
  rot: number;
  fov: number;
  range: number; // metros
  size: number; // metros (largura do símbolo de arquitetura)
  model?: string; // modelo Intelbras selecionado
  label: string;
};

export const DEVICE_INFO: Record<
  DeviceKind,
  { label: string; fov: number; range: number; size: number; color: string }
> = {
  bullet: { label: "Câmera Bullet", fov: 90, range: 12, size: 1, color: "#c0392b" },
  dome: { label: "Câmera Dome", fov: 130, range: 8, size: 1, color: "#c0392b" },
  speed: { label: "Speed Dome", fov: 60, range: 25, size: 1, color: "#9d174d" },
  fisheye: { label: "Câmera 360°", fov: 360, range: 7, size: 1, color: "#7c3aed" },
  wifi: { label: "Câmera Wi-Fi", fov: 90, range: 10, size: 1, color: "#0284c7" },
  sensor: { label: "Sensor IVP", fov: 110, range: 8, size: 1, color: "#1d4ed8" },
  alarme: { label: "Sirene / Alarme", fov: 360, range: 0, size: 1, color: "#ea580c" },
  teclado: { label: "Central / Teclado", fov: 360, range: 0, size: 1, color: "#0f766e" },
  dvr: { label: "Gravador (DVR/NVR)", fov: 360, range: 0, size: 1, color: "#334155" },
  porta: { label: "Porta", fov: 0, range: 0, size: 0.9, color: "#0f172a" },
  portao: { label: "Portão de garagem", fov: 0, range: 0, size: 3, color: "#0f172a" },
  janela: { label: "Janela", fov: 0, range: 0, size: 1.2, color: "#0f172a" },
  escada: { label: "Escada", fov: 0, range: 0, size: 1.1, color: "#0f172a" },
  carro: { label: "Veículo", fov: 0, range: 0, size: 1.8, color: "#64748b" },
  moto: { label: "Moto", fov: 0, range: 0, size: 0.8, color: "#64748b" },
  pessoa: { label: "Pessoa", fov: 0, range: 0, size: 0.6, color: "#0f766e" },
  pet: { label: "Pet", fov: 0, range: 0, size: 0.5, color: "#a16207" },
};

/** Itens de arquitetura desenhados como símbolos, não como equipamento. */
export const ARCH_KINDS: DeviceKind[] = [
  "porta",
  "portao",
  "janela",
  "escada",
  "carro",
  "moto",
  "pessoa",
  "pet",
];
export const isArch = (k: DeviceKind) => ARCH_KINDS.includes(k);

export const uid = () => Math.random().toString(36).slice(2, 9);

export const snap = (v: number, on: boolean) => (on ? Math.round(v / SNAP) * SNAP : Math.round(v));

export const wallLength = (w: Wall) => Math.hypot(w.x2 - w.x1, w.y2 - w.y1) / PX_PER_M;

/** Encontra o ponto de parede mais próximo (extremidades) para unir traços. */
export function magnet(
  x: number,
  y: number,
  walls: Wall[],
  ignoreId?: string,
): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestD = JOIN_RADIUS;
  for (const w of walls) {
    if (w.id === ignoreId) continue;
    for (const p of [
      { x: w.x1, y: w.y1 },
      { x: w.x2, y: w.y2 },
    ]) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
  }
  return best;
}

/** Setor de cobertura em coordenadas de tela. */
export function sectorPath(d: Device) {
  const r = d.range * PX_PER_M;
  if (r <= 0) return "";
  if (d.fov >= 359) return `M ${d.x - r} ${d.y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  const a0 = ((d.rot - d.fov / 2) * Math.PI) / 180;
  const a1 = ((d.rot + d.fov / 2) * Math.PI) / 180;
  const p0 = [d.x + r * Math.cos(a0), d.y + r * Math.sin(a0)];
  const p1 = [d.x + r * Math.cos(a1), d.y + r * Math.sin(a1)];
  const large = d.fov > 180 ? 1 : 0;
  return `M ${d.x} ${d.y} L ${p0[0]} ${p0[1]} A ${r} ${r} 0 ${large} 1 ${p1[0]} ${p1[1]} Z`;
}

/** Caminho de cabo em L (ortogonal) do equipamento até o gravador. */
export function cableRoute(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { d: string; meters: number } {
  const mid = { x: to.x, y: from.y };
  const px = Math.abs(mid.x - from.x) + Math.abs(to.y - mid.y);
  return { d: `M ${from.x} ${from.y} L ${mid.x} ${mid.y} L ${to.x} ${to.y}`, meters: px / PX_PER_M };
}

/** Canais de DVR/NVR comerciais. */
export function canaisDVR(n: number) {
  return [4, 8, 16, 32].find((c) => c >= n) ?? 64;
}

/** Rolos de cabo (caixa de 305 m) considerando folga. */
export const ROLO_M = 305;
export function rolos(metros: number) {
  return Math.max(metros > 0 ? 1 : 0, Math.ceil(metros / ROLO_M));
}
