import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Cctv,
  Radar,
  Bell,
  HardDrive,
  MousePointer2,
  Minus,
  Trash2,
  Undo2,
  Download,
  Printer,
  Grid3x3,
  DoorOpen,
  RectangleHorizontal,
  StretchVertical,
  SlidersHorizontal,
  Square,
  Car,
  Bike,
  PersonStanding,
  PawPrint,
  Warehouse,
  ScanEye,
  Orbit,
  Wifi,
  KeyRound,
  RotateCw,
  X,
  ChevronDown,
  ZoomIn,
  ZoomOut,
  Cable,
  Maximize,
  FileText,
  Paperclip,
  Eraser,


} from "lucide-react";
import {
  DEVICE_INFO,
  PX_PER_M,
  cableRoute,
  canaisDVR,
  rolos,
  ROLO_M,
  isArch,
  magnet,
  sectorPath,
  snap,
  uid,
  wallLength,
  type Device,
  type DeviceKind,
  type Wall,
} from "@/lib/planta";
import { findModel, isCam, modelsFor } from "@/lib/intelbras";

type Tool = "select" | "wall" | "rect" | "erase" | DeviceKind;

const TOOLS: { id: Tool; label: string; icon: typeof Camera }[] = [
  { id: "select", label: "Selecionar / mover", icon: MousePointer2 },
  { id: "erase", label: "Borracha", icon: Eraser },
  { id: "wall", label: "Parede", icon: Minus },
  { id: "rect", label: "Terreno / galpão", icon: Square },
  { id: "porta", label: "Porta", icon: DoorOpen },
  { id: "portao", label: "Portão de garagem", icon: Warehouse },
  { id: "janela", label: "Janela", icon: RectangleHorizontal },
  { id: "escada", label: "Escada", icon: StretchVertical },
  { id: "carro", label: "Veículo", icon: Car },
  { id: "moto", label: "Moto", icon: Bike },
  { id: "pessoa", label: "Pessoa", icon: PersonStanding },
  { id: "pet", label: "Pet", icon: PawPrint },
  { id: "bullet", label: "Câmera Bullet", icon: Cctv },
  { id: "dome", label: "Câmera Dome", icon: Camera },
  { id: "speed", label: "Speed Dome", icon: ScanEye },
  { id: "fisheye", label: "Câmera 360°", icon: Orbit },
  { id: "wifi", label: "Câmera Wi-Fi", icon: Wifi },
  { id: "sensor", label: "Sensor IVP", icon: Radar },
  { id: "alarme", label: "Sirene", icon: Bell },
  { id: "teclado", label: "Central / Teclado", icon: KeyRound },
  { id: "dvr", label: "Gravador", icon: HardDrive },
];

const LOJAS = ["Portal 227", "Portal 97", "Portal 646", "Esquina 312", "Time Digital"] as const;

const W = 1400;
const H = 990;

type Drag =
  | { kind: "device"; id: string; mode: "move" | "rotate" | "resize"; ox: number; oy: number }
  | { kind: "wallpt"; id: string; end: 1 | 2 }
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | null;

export default function PlantaEditor() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sceneRef = useRef<SVGGElement | null>(null);
  const [tool, setTool] = useState<Tool>("wall");
  const [walls, setWalls] = useState<Wall[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [draft, setDraft] = useState<Wall | null>(null);
  const [rect, setRect] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [gridOn, setGridOn] = useState(true);
  const [cabosOn, setCabosOn] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [anexos, setAnexos] = useState<{ name: string; type: string; url: string }[]>([]);
  const [ghost, setGhost] = useState<{ kind: DeviceKind; x: number; y: number } | null>(null);

  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<Drag>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{ dist: number; cx: number; cy: number; k: number; vx: number; vy: number } | null>(null);
  const longRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [meta, setMeta] = useState({
    titulo: "PROJETO DE SISTEMA CFTV",
    empresa: "",
    cliente: "",
    telefone: "",
    pedido: "",
    loja: "",
    endereco: "",
  });

  /** Coordenada no espaço do desenho (já considerando zoom/pan). */
  const point = useCallback((e: { clientX: number; clientY: number }) => {
    const g = sceneRef.current!;
    const ctm = g.getScreenCTM()!;
    const p = svgRef.current!.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }, []);

  /** Coordenada em px do SVG sem zoom (para calcular o pan). */
  const rawPoint = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current!;
    const ctm = svg.getScreenCTM()!;
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    const r = p.matrixTransform(ctm.inverse());
    return { x: r.x, y: r.y };
  }, []);

  const zoomAt = useCallback((factor: number, px: number, py: number) => {
    setView((v) => {
      const k = Math.min(6, Math.max(0.35, v.k * factor));
      const s = k / v.k;
      return { k, x: px - (px - v.x) * s, y: py - (py - v.y) * s };
    });
  }, []);

  // zoom por roda / trackpad (listener nativo, não passivo)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
      const p = rawPoint(e);
      zoomAt(Math.exp(-dy * 0.0015), p.x, p.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [rawPoint, zoomAt]);

  const selectedDevice = devices.find((d) => d.id === selected) ?? null;
  const selectedWall = walls.find((w) => w.id === selected) ?? null;

  const capture = (e: React.PointerEvent) => {
    try {
      svgRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const erasingRef = useRef(false);

  /** Apaga paredes e itens sob o ponto (borracha). */
  function eraseAt(x: number, y: number) {
    const R = 14;
    setDevices((s) =>
      s.filter((d) => {
        const half = Math.max(14, (d.size * PX_PER_M) / 2);
        return Math.hypot(d.x - x, d.y - y) > half;
      }),
    );
    setWalls((s) =>
      s.filter((w) => {
        const dx = w.x2 - w.x1;
        const dy = w.y2 - w.y1;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((x - w.x1) * dx + (y - w.y1) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(w.x1 + t * dx - x, w.y1 + t * dy - y) > R;
      }),
    );
    setSelected(null);
  }

  const cancelLong = () => {
    if (longRef.current) clearTimeout(longRef.current);
    longRef.current = null;
  };

  /** Duplo-clique numa ponta de parede: emenda com a ponta de outra parede mais próxima, se estiver dentro do raio de imã. */
  function weldEndpoint(wallId: string, end: 1 | 2) {
    setWalls((s) => {
      const w = s.find((x) => x.id === wallId);
      if (!w) return s;
      const px = end === 1 ? w.x1 : w.x2;
      const py = end === 1 ? w.y1 : w.y2;
      const j = magnet(px, py, s, wallId);
      if (!j) return s;
      return s.map((x) =>
        x.id === wallId ? (end === 1 ? { ...x, x1: j.x, y1: j.y } : { ...x, x2: j.x, y2: j.y }) : x,
      );
    });
  }

  /** Cria um item na posição indicada e já o deixa selecionado. */
  function dropDevice(kind: DeviceKind, x: number, y: number) {
    const info = DEVICE_INFO[kind];
    const d: Device = {
      id: uid(),
      kind,
      x: snap(x, gridOn),
      y: snap(y, gridOn),
      rot: 0,
      fov: info.fov,
      range: info.range,
      size: info.size,
      label: info.label,
    };
    setDevices((s) => [...s, d]);
    setSelected(d.id);
    setTool("select");
    setPanelOpen(true);
    return d;
  }

  /** Arrastar o ícone da barra de ferramentas direto para a prancha. */
  function startToolDrag(e: React.PointerEvent, id: Tool) {
    if (id === "select" || id === "wall" || id === "rect" || id === "erase") return;
    const kind = id as DeviceKind;
    setGhost({ kind, x: e.clientX, y: e.clientY });
    const move = (ev: PointerEvent) => setGhost({ kind, x: ev.clientX, y: ev.clientY });
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setGhost(null);
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const inside =
        ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      if (!inside) return;
      const p = point(ev);
      dropDevice(kind, p.x, p.y);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }


  function startDeviceDrag(e: React.PointerEvent, id: string, mode: "move" | "rotate" | "resize") {
    // com uma ferramenta ativa o toque deve SOLTAR um item novo, não pegar o existente —
    // mas sempre paramos a propagação pra não soltar um item novo empilhado por cima do
    // que o usuário estava tentando tocar.
    e.stopPropagation();
    if (mode === "move" && tool !== "select") return;
    if (pointersRef.current.size > 1) return;
    const d = devices.find((x) => x.id === id);
    const p = point(e);
    dragRef.current = {
      kind: "device",
      id,
      mode,
      ox: mode === "move" && d ? d.x - p.x : 0,
      oy: mode === "move" && d ? d.y - p.y : 0,
    };
    setSelected(id);
    setPanelOpen(true);
    capture(e);
  }


  function onDownCapture(e: React.PointerEvent) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      const pts = [...pointersRef.current.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      const mid = rawPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      pinchRef.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        cx: mid.x,
        cy: mid.y,
        k: view.k,
        vx: view.x,
        vy: view.y,
      };
      dragRef.current = null;
      cancelLong();
      setDraft(null);
      setRect(null);
    }
  }

  function onDown(e: React.PointerEvent) {
    if (pointersRef.current.size > 1) return;
    const { x, y } = point(e);

    if (tool === "wall") {
      const j = magnet(x, y, walls);
      const sx = j ? j.x : snap(x, gridOn);
      const sy = j ? j.y : snap(y, gridOn);
      setDraft({ id: uid(), x1: sx, y1: sy, x2: sx, y2: sy });
      capture(e);
      return;
    }

    if (tool === "rect") {
      const sx = snap(x, gridOn);
      const sy = snap(y, gridOn);
      setRect({ x: sx, y: sy, x2: sx, y2: sy });
      capture(e);
      return;
    }

    if (tool === "erase") {
      eraseAt(x, y);
      dragRef.current = null;
      erasingRef.current = true;
      capture(e);
      return;
    }

    if (tool !== "select") {
      const d = dropDevice(tool, x, y);
      dragRef.current = { kind: "device", id: d.id, mode: "move", ox: 0, oy: 0 };
      capture(e);
      return;
    }


    // modo selecionar em área vazia: arrasta a prancha (pan)
    const rp = rawPoint(e);
    dragRef.current = { kind: "pan", sx: rp.x, sy: rp.y, vx: view.x, vy: view.y, moved: false };
    capture(e);
    setSelected(null);
  }

  function onMove(e: React.PointerEvent) {
    if (pointersRef.current.has(e.pointerId))
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // pinça: zoom + arrasto com dois dedos
    const pin = pinchRef.current;
    if (pin && pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()];
      const a = pts[0]!;
      const b = pts[1]!;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = rawPoint({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      const k = Math.min(6, Math.max(0.35, (pin.k * dist) / (pin.dist || 1)));
      const s = k / pin.k;
      setView({
        k,
        x: mid.x - (pin.cx - pin.vx) * s,
        y: mid.y - (pin.cy - pin.vy) * s,
      });
      return;
    }

    const { x, y } = point(e);

    if (erasingRef.current) {
      eraseAt(x, y);
      return;
    }

    if (draft) {
      const j = magnet(x, y, walls, draft.id);
      let nx = j ? j.x : snap(x, gridOn);
      let ny = j ? j.y : snap(y, gridOn);
      if (!j && (e.shiftKey || Math.abs(nx - draft.x1) < 10 || Math.abs(ny - draft.y1) < 10)) {
        if (Math.abs(nx - draft.x1) > Math.abs(ny - draft.y1)) ny = draft.y1;
        else nx = draft.x1;
      }
      setDraft({ ...draft, x2: nx, y2: ny });
      return;
    }

    if (rect) {
      setRect({ ...rect, x2: snap(x, gridOn), y2: snap(y, gridOn) });
      return;
    }

    const dg = dragRef.current;
    if (!dg) return;

    if (dg.kind === "pan") {
      const rp = rawPoint(e);
      if (Math.hypot(rp.x - dg.sx, rp.y - dg.sy) > 2) dg.moved = true;
      setView((v) => ({ ...v, x: dg.vx + (rp.x - dg.sx), y: dg.vy + (rp.y - dg.sy) }));
      return;
    }

    if (dg.kind === "wallpt") {
      const j = magnet(x, y, walls, dg.id);
      const nx = j ? j.x : snap(x, gridOn);
      const ny = j ? j.y : snap(y, gridOn);
      setWalls((s) =>
        s.map((w) => (w.id === dg.id ? (dg.end === 1 ? { ...w, x1: nx, y1: ny } : { ...w, x2: nx, y2: ny }) : w)),
      );
      return;
    }

    setDevices((s) =>
      s.map((d) => {
        if (d.id !== dg.id) return d;
        if (dg.mode === "move") {
          if (Math.hypot(x + dg.ox - d.x, y + dg.oy - d.y) > 1) cancelLong();
          return { ...d, x: snap(x + dg.ox, gridOn), y: snap(y + dg.oy, gridOn) };
        }
        cancelLong();
        if (dg.mode === "rotate") {
          const ang = (Math.atan2(y - d.y, x - d.x) * 180) / Math.PI;
          return { ...d, rot: Math.round(ang) };
        }
        const dist = Math.hypot(x - d.x, y - d.y);
        // câmeras/sensores: a alça estica o alcance; símbolos: muda o tamanho
        if (DEVICE_INFO[d.kind].range > 0)
          return { ...d, range: Math.max(2, Math.min(120, Math.round(dist / PX_PER_M))) };
        return { ...d, size: Math.max(0.4, Math.round(((dist * 2) / PX_PER_M) * 10) / 10) };
      }),
    );
  }

  function onUp(e?: React.PointerEvent) {
    cancelLong();
    if (e) pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    if (draft) {
      if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 6) setWalls((s) => [...s, draft]);
      setDraft(null);
    }
    if (rect) {
      const x1 = Math.min(rect.x, rect.x2);
      const x2 = Math.max(rect.x, rect.x2);
      const y1 = Math.min(rect.y, rect.y2);
      const y2 = Math.max(rect.y, rect.y2);
      if (x2 - x1 > 10 && y2 - y1 > 10) {
        setWalls((s) => [
          ...s,
          { id: uid(), x1, y1, x2, y2: y1 },
          { id: uid(), x1: x2, y1, x2, y2 },
          { id: uid(), x1: x2, y1: y2, x2: x1, y2 },
          { id: uid(), x1, y1: y2, x2: x1, y2: y1 },
        ]);
      }
      setRect(null);
    }
    erasingRef.current = false;
    dragRef.current = null;
  }

  const remove = useCallback((id: string) => {
    setDevices((s) => s.filter((d) => d.id !== id));
    setWalls((s) => s.filter((w) => w.id !== id));
    setSelected(null);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if ((e.key === "Delete" || e.key === "Backspace") && selected) remove(selected);
      if (e.key === "Escape") setSelected(null);
      if (e.key === "v") setTool("select");
      if (e.key === "p") setTool("wall");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [selected, remove]);

  const equipamentos = useMemo(() => devices.filter((d) => !isArch(d.kind)), [devices]);

  const numbered = useMemo(() => {
    let n = 0;
    return devices.map((d) => ({ ...d, n: isArch(d.kind) ? 0 : ++n }));
  }, [devices]);

  const resumo = useMemo(() => {
    const map = new Map<DeviceKind, number>();
    devices.forEach((d) => map.set(d.kind, (map.get(d.kind) ?? 0) + 1));
    return [...map.entries()];
  }, [devices]);

  const metrosParede = walls.reduce((a, w) => a + wallLength(w), 0);

  /** Caminhos de cabo: cada equipamento conectado ao gravador mais próximo. */
  const cabos = useMemo(() => {
    const dvrs = devices.filter((d) => d.kind === "dvr");
    if (!dvrs.length) return [] as { id: string; d: string; meters: number }[];
    return devices
      .filter((d) => !isArch(d.kind) && d.kind !== "dvr" && d.kind !== "alarme")
      .map((d) => {
        const dvr = dvrs.reduce((best, c) =>
          Math.hypot(c.x - d.x, c.y - d.y) < Math.hypot(best.x - d.x, best.y - d.y) ? c : best,
        );
        const r = cableRoute(d, dvr);
        return { id: d.id, d: r.d, meters: r.meters };
      });
  }, [devices]);

  const metrosCabo = cabos.reduce((a, c) => a + c.meters, 0);
  const metrosCaboFolga = Math.round(metrosCabo * 1.15);
  const cameras = useMemo(() => devices.filter((d) => isCam(d.kind)).length, [devices]);
  const canais = canaisDVR(cameras);

  const bom: string[] = useMemo(() => {
    const linhas: string[] = [];
    const count = (k: DeviceKind) => devices.filter((d) => d.kind === k).length;
    if (cameras) linhas.push(`${cameras} câmera(s) · gravador sugerido: DVR/NVR ${canais} canais`);
    const extras: string[] = [];
    if (count("sensor")) extras.push(`${count("sensor")} sensor(es) IVP`);
    if (count("alarme")) extras.push(`${count("alarme")} sirene(s)`);
    if (count("teclado")) extras.push(`${count("teclado")} central/teclado`);
    if (extras.length) linhas.push(extras.join(" · "));
    linhas.push(`Perímetro/paredes: ${metrosParede.toFixed(1)} m`);
    if (metrosCabo > 0)
      linhas.push(
        `Cabo até o gravador: ${metrosCaboFolga} m (c/ 15% folga) · ${rolos(metrosCaboFolga)} caixa(s) de ${ROLO_M} m`,
      );
    else if (cameras) linhas.push("Adicione um Gravador para calcular o cabo");
    return linhas;
  }, [devices, cameras, canais, metrosParede, metrosCabo, metrosCaboFolga]);

  const fileName = () => meta.titulo.replace(/\s+/g, "-").toLowerCase() || "projeto";

  /** Rasteriza a prancha INTEIRA (independente do zoom/pan atual). */
  async function renderCanvas(): Promise<HTMLCanvasElement> {
    setSelected(null);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    // Área total: prancha + tudo que foi desenhado fora dela
    let minX = 0,
      minY = 0,
      maxX = W,
      maxY = H;
    try {
      const b = sceneRef.current!.getBBox();
      if (b.width > 0 && b.height > 0) {
        minX = Math.min(minX, b.x - 24);
        minY = Math.min(minY, b.y - 24);
        maxX = Math.max(maxX, b.x + b.width + 24);
        maxY = Math.max(maxY, b.y + b.height + 24);
      }
    } catch {
      /* ignore */
    }
    const vw = maxX - minX;
    const vh = maxY - minY;
    return new Promise((resolve, reject) => {
      const svg = svgRef.current!;
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.querySelectorAll(".ui-only").forEach((n) => n.remove());
      // Neutraliza zoom/pan e enquadra tudo
      const cloneScene = clone.querySelector("[data-scene]");
      if (cloneScene) cloneScene.setAttribute("transform", "translate(0 0) scale(1)");

      clone.setAttribute("viewBox", `${minX} ${minY} ${vw} ${vh}`);
      clone.setAttribute("width", String(vw));
      clone.setAttribute("height", String(vh));
      const bg = clone.querySelector("rect");
      if (bg) {
        bg.setAttribute("x", String(minX));
        bg.setAttribute("y", String(minY));
        bg.setAttribute("width", String(vw));
        bg.setAttribute("height", String(vh));
      }
      const data = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });

      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = Math.round(vw * 2);
        c.height = Math.round(vh * 2);
        const ctx = c.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("falha ao renderizar"));
      };
      img.src = url;
    });
  }

  async function exportPNG() {
    const c = await renderCanvas();
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `${fileName()}.png`;
    a.click();
  }


  async function exportPDF() {
    setPdfBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const c = await renderCanvas();
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const m = 8;

      // Página 1 — cabeçalho / dados / resumo
      let y = 18;
      pdf.setFontSize(18);
      pdf.text(meta.titulo || "Projeto CFTV", m + 4, y);
      y += 9;
      pdf.setFontSize(10);
      pdf.text(`Empresa: ${meta.empresa || "—"}   ·   Loja: ${meta.loja || "—"}`, m + 4, y);
      y += 6;
      pdf.text(`Pedido / proposta nº: ${meta.pedido || "—"}`, m + 4, y);
      y += 6;
      pdf.text(`Cliente: ${meta.cliente || "—"}   ·   Tel: ${meta.telefone || "—"}`, m + 4, y);
      y += 6;
      pdf.text(`Endereço: ${meta.endereco || "—"}`, m + 4, y);
      y += 6;
      pdf.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, m + 4, y);
      y += 10;
      pdf.setFontSize(12);
      pdf.text("RESUMO DE MATERIAIS (estimativa)", m + 4, y);
      y += 7;
      pdf.setFontSize(10);
      bom.forEach((l) => {
        pdf.text(`• ${l}`, m + 6, y);
        y += 6;
      });
      y += 4;
      pdf.setFontSize(12);
      pdf.text("ITENS DO PROJETO", m + 4, y);
      y += 7;
      pdf.setFontSize(10);
      resumo.forEach(([k, n]) => {
        pdf.text(`${n}x  ${DEVICE_INFO[k].label}`, m + 6, y);
        y += 6;
      });
      if (anexos.length) {
        y += 4;
        pdf.setFontSize(12);
        pdf.text("PEDIDO / ANEXOS", m + 4, y);
        y += 7;
        pdf.setFontSize(10);
        anexos.forEach((a) => {
          pdf.text(`• ${a.name}`, m + 6, y);
          y += 6;
        });
      }

      // Página 2 — a prancha inteira, reduzida para caber
      pdf.addPage();
      const iw = c.width / 2;
      const ih = c.height / 2;
      const scale = Math.min((pw - m * 2) / iw, (ph - m * 2) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      pdf.addImage(
        c.toDataURL("image/jpeg", 0.92),
        "JPEG",
        (pw - dw) / 2,
        (ph - dh) / 2,
        dw,
        dh,
      );

      for (const a of anexos.filter((x) => x.type.startsWith("image/"))) {
        pdf.addPage();
        pdf.setFontSize(11);
        pdf.text(a.name, m + 4, 12);
        pdf.addImage(a.url, m, 18, pw - m * 2, ph - 26, undefined, "FAST");
      }

      pdf.save(`${fileName()}.pdf`);
    } finally {
      setPdfBusy(false);
    }
  }

  function addAnexos(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((f) => {
      const r = new FileReader();
      r.onload = () =>
        setAnexos((s) => [...s, { name: f.name, type: f.type, url: String(r.result) }]);
      r.readAsDataURL(f);
    });
  }


  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="shrink-0 border-b border-border bg-card print:hidden">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="rounded-sm bg-accent px-2 py-1 font-mono text-[10px] font-bold tracking-widest text-accent-foreground">
            CFTV
          </span>
          <h1 className="font-display text-base font-bold tracking-tight">Prancha Rápida</h1>
          <button
            onClick={() => setMetaOpen((v) => !v)}
            className="ml-auto flex items-center gap-1 rounded-sm border border-border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
          >
            Dados <ChevronDown className={`size-3.5 transition-transform ${metaOpen ? "rotate-180" : ""}`} />
          </button>
          <div className="flex w-full items-center gap-1 overflow-x-auto sm:w-auto">

            <button onClick={() => setGridOn(!gridOn)} className={btn(gridOn)} title="Malha / encaixe">
              <Grid3x3 className="size-4" />
            </button>
            <button onClick={() => setCabosOn(!cabosOn)} className={btn(cabosOn)} title="Simular cabeamento">
              <Cable className="size-4" />
            </button>
            <button onClick={() => zoomAt(1.25, W / 2, H / 2)} className={btn(false)} title="Aproximar">
              <ZoomIn className="size-4" />
            </button>
            <button onClick={() => zoomAt(0.8, W / 2, H / 2)} className={btn(false)} title="Afastar">
              <ZoomOut className="size-4" />
            </button>
            <button
              onClick={() => setView({ x: 0, y: 0, k: 1 })}
              className={btn(false)}
              title="Enquadrar (100%)"
            >
              <Maximize className="size-4" />
            </button>
            <button
              onClick={() => {
                if (devices.length) setDevices((s) => s.slice(0, -1));
                else setWalls((s) => s.slice(0, -1));
              }}
              className={btn(false)}
              title="Desfazer último item"
            >
              <Undo2 className="size-4" />
            </button>
            <button onClick={exportPNG} className={btn(false)} title="Baixar PNG">
              <Download className="size-4" />
            </button>
            <button
              onClick={exportPDF}
              disabled={pdfBusy}
              className="flex h-9 items-center gap-1 rounded-sm border border-accent bg-accent px-2 text-xs font-semibold text-accent-foreground disabled:opacity-60"
              title="Gerar PDF do projeto"
            >
              <FileText className="size-4" /> {pdfBusy ? "..." : "PDF"}
            </button>
            <button onClick={() => window.print()} className={`${btn(false)} hidden sm:flex`} title="Imprimir">
              <Printer className="size-4" />
            </button>

          </div>
        </div>
        {metaOpen && (
          <div className="flex flex-wrap gap-2 border-t border-border px-3 py-2">
            <input
              value={meta.titulo}
              onChange={(e) => setMeta({ ...meta, titulo: e.target.value })}
              className="min-w-40 flex-1 rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
            />
            <input
              placeholder="Empresa (quem executa)"
              value={meta.empresa}
              onChange={(e) => setMeta({ ...meta, empresa: e.target.value })}
              className="w-44 rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
            />
            <input
              placeholder="Cliente"
              value={meta.cliente}
              onChange={(e) => setMeta({ ...meta, cliente: e.target.value })}
              className="w-36 rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
            />
            <input
              placeholder="Telefone do cliente"
              inputMode="tel"
              value={meta.telefone}
              onChange={(e) => setMeta({ ...meta, telefone: e.target.value })}
              className="w-40 rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
            />
            <input
              placeholder="Nº do pedido / proposta"
              value={meta.pedido}
              onChange={(e) => setMeta({ ...meta, pedido: e.target.value })}
              className="w-44 rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
            />
            <select
              value={meta.loja}
              onChange={(e) => setMeta({ ...meta, loja: e.target.value })}
              className="w-40 rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
            >
              <option value="">Selecione a loja</option>
              {LOJAS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
            <input
              placeholder="Endereço"
              value={meta.endereco}
              onChange={(e) => setMeta({ ...meta, endereco: e.target.value })}
              className="w-48 rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
            />

          </div>
        )}
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Ferramentas */}
        <aside className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-border bg-card px-2 py-1.5 print:hidden lg:w-28 lg:flex-col lg:items-stretch lg:overflow-y-auto lg:border-b-0 lg:border-r lg:py-3">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              onPointerDown={(e) => startToolDrag(e, t.id)}
              title={t.label}
              style={{ touchAction: "pan-x" }}
              className={`flex w-16 shrink-0 flex-col items-center justify-start gap-0.5 rounded-sm border px-1 py-1.5 transition-colors lg:w-full lg:flex-row lg:gap-2 lg:px-2 ${
                tool === t.id
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-transparent text-muted-foreground hover:bg-muted"
              }`}
            >
              <t.icon className="size-5 shrink-0" />
              <span className="w-full text-center text-[9px] leading-tight lg:text-left lg:text-[11px]">
                {t.label}
              </span>
            </button>
          ))}
        </aside>

        {ghost && (
          <div
            className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-accent bg-card/95 px-2 py-1 text-[11px] shadow-lg"
            style={{ left: ghost.x, top: ghost.y }}
          >
            {DEVICE_INFO[ghost.kind].label}
          </div>
        )}



        {/* Prancha */}
        <main className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-muted/40 p-2 lg:p-4">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width={W}
            height={H}
            xmlns="http://www.w3.org/2000/svg"
            className="mx-auto block h-auto w-full max-w-full touch-none rounded-sm bg-white shadow-[0_10px_40px_-18px_rgba(15,23,42,.5)]"
            style={{ cursor: tool === "select" ? "default" : "crosshair" }}
            onPointerDownCapture={onDownCapture}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
            <g ref={sceneRef} data-scene="1" transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
            {gridOn && (
              <g>
                {Array.from({ length: Math.ceil(W / PX_PER_M) }, (_, i) => (
                  <line
                    key={`v${i}`}
                    x1={i * PX_PER_M}
                    y1={0}
                    x2={i * PX_PER_M}
                    y2={H}
                    stroke={i % 5 === 0 ? "#cbd5e1" : "#eef2f7"}
                    strokeWidth={1}
                  />
                ))}
                {Array.from({ length: Math.ceil(H / PX_PER_M) }, (_, i) => (
                  <line
                    key={`h${i}`}
                    x1={0}
                    y1={i * PX_PER_M}
                    x2={W}
                    y2={i * PX_PER_M}
                    stroke={i % 5 === 0 ? "#cbd5e1" : "#eef2f7"}
                    strokeWidth={1}
                  />
                ))}
              </g>
            )}

            {/* Cobertura */}
            {numbered.map((d) =>
              d.range > 0 ? (
                <path
                  key={`c${d.id}`}
                  d={sectorPath(d)}
                  fill={DEVICE_INFO[d.kind].color}
                  fillOpacity={selected === d.id ? 0.26 : 0.15}
                  stroke={DEVICE_INFO[d.kind].color}
                  strokeOpacity={0.35}
                  style={{ pointerEvents: "none" }}
                />
              ) : null,
            )}

            {/* Paredes */}
            {walls.map((w) => (
              <g key={w.id}>
                <line
                  x1={w.x1}
                  y1={w.y1}
                  x2={w.x2}
                  y2={w.y2}
                  stroke="transparent"
                  strokeWidth={22}
                  strokeLinecap="round"
                  onPointerDown={(e) => {
                    if (tool !== "select") return;
                    e.stopPropagation();
                    setSelected(w.id);
                    setPanelOpen(true);
                  }}
                />
                <line
                  x1={w.x1}
                  y1={w.y1}
                  x2={w.x2}
                  y2={w.y2}
                  stroke={selected === w.id ? "#c0392b" : "#0f172a"}
                  strokeWidth={9}
                  strokeLinecap="round"
                  style={{ pointerEvents: "none" }}
                />
                <text
                  x={(w.x1 + w.x2) / 2}
                  y={(w.y1 + w.y2) / 2 - 9}
                  textAnchor="middle"
                  fontSize="11"
                  fill="#64748b"
                  fontFamily="ui-monospace, monospace"
                  style={{ pointerEvents: "none" }}
                >
                  {wallLength(w).toFixed(2)} m
                </text>
                {selected === w.id &&
                  ([1, 2] as const).map((end) => (
                    <g key={end}>
                      <circle
                        cx={end === 1 ? w.x1 : w.x2}
                        cy={end === 1 ? w.y1 : w.y2}
                        r={18}
                        fill="transparent"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          dragRef.current = { kind: "wallpt", id: w.id, end };
                          capture(e);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          weldEndpoint(w.id, end);
                        }}
                      />
                      <circle
                        cx={end === 1 ? w.x1 : w.x2}
                        cy={end === 1 ? w.y1 : w.y2}
                        r={9}
                        fill="#ffffff"
                        stroke="#c0392b"
                        strokeWidth={3}
                        style={{ pointerEvents: "none" }}
                      />
                    </g>
                  ))}
              </g>
            ))}

            {/* Nós de união */}
            {walls.map((w) => (
              <g key={`n${w.id}`} style={{ pointerEvents: "none" }}>
                <circle cx={w.x1} cy={w.y1} r={4.5} fill={selected === w.id ? "#c0392b" : "#0f172a"} />
                <circle cx={w.x2} cy={w.y2} r={4.5} fill={selected === w.id ? "#c0392b" : "#0f172a"} />
              </g>
            ))}

            {draft && (
              <g style={{ pointerEvents: "none" }}>
                <line
                  x1={draft.x1}
                  y1={draft.y1}
                  x2={draft.x2}
                  y2={draft.y2}
                  stroke="#c0392b"
                  strokeWidth={9}
                  strokeLinecap="round"
                  strokeOpacity={0.6}
                />
                <text
                  x={(draft.x1 + draft.x2) / 2}
                  y={(draft.y1 + draft.y2) / 2 - 12}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#c0392b"
                  fontFamily="ui-monospace, monospace"
                >
                  {wallLength(draft).toFixed(2)} m
                </text>
              </g>
            )}

            {rect && (
              <rect
                x={Math.min(rect.x, rect.x2)}
                y={Math.min(rect.y, rect.y2)}
                width={Math.abs(rect.x2 - rect.x)}
                height={Math.abs(rect.y2 - rect.y)}
                fill="#c0392b"
                fillOpacity={0.06}
                stroke="#c0392b"
                strokeWidth={9}
                strokeOpacity={0.6}
                style={{ pointerEvents: "none" }}
              />
            )}

            {/* Símbolos de arquitetura */}
            {numbered
              .filter((d) => isArch(d.kind))
              .map((d) => (
                <g key={d.id} transform={`translate(${d.x} ${d.y}) rotate(${d.rot})`}>
                  <g
                    onPointerDown={(e) => startDeviceDrag(e, d.id, "move")}
                    style={{ cursor: "move" }}
                  >
                    <circle
                      cx={0}
                      cy={0}
                      r={Math.max(24, (d.size * PX_PER_M) / 2 + 10)}
                      fill="transparent"
                    />
                    <ArchSymbol kind={d.kind} size={d.size} active={selected === d.id} />
                  </g>
                  {selected === d.id && (
                    <Handles
                      rDist={(d.size * PX_PER_M) / 2 + 16}
                      onRotate={(e) => startDeviceDrag(e, d.id, "rotate")}
                      onResize={(e) => startDeviceDrag(e, d.id, "resize")}
                      onDelete={() => remove(d.id)}
                    />
                  )}
                </g>
              ))}

            {/* Equipamentos */}
            {numbered
              .filter((d) => !isArch(d.kind))
              .map((d) => {
                const color = DEVICE_INFO[d.kind].color;
                const sel = selected === d.id;
                return (
                  <g key={d.id}>
                    <g
                      onPointerDown={(e) => startDeviceDrag(e, d.id, "move")}
                      style={{ cursor: "move" }}
                    >
                      <circle cx={d.x} cy={d.y} r={22} fill="transparent" />
                      <circle
                        cx={d.x}
                        cy={d.y}
                        r={13}
                        fill={color}
                        stroke={sel ? "#0f172a" : "#ffffff"}
                        strokeWidth={sel ? 3 : 2}
                      />
                      <text
                        x={d.x}
                        y={d.y + 4.5}
                        textAnchor="middle"
                        fontSize="12"
                        fontWeight="700"
                        fill="#ffffff"
                        fontFamily="ui-sans-serif, system-ui"
                        style={{ pointerEvents: "none" }}
                      >
                        {d.n}
                      </text>
                    </g>
                    {sel && (
                      <g transform={`translate(${d.x} ${d.y}) rotate(${d.rot})`}>
                        <Handles
                          rDist={38}
                          showResize={DEVICE_INFO[d.kind].range > 0}
                          onRotate={(e) => startDeviceDrag(e, d.id, "rotate")}
                          onResize={(e) => startDeviceDrag(e, d.id, "resize")}
                          onDelete={() => remove(d.id)}
                        />
                      </g>
                    )}
                  </g>
                );
              })}

            {/* Cabeamento simulado até o gravador */}
            {cabosOn &&
              cabos.map((c) => (
                <g key={`cab${c.id}`} style={{ pointerEvents: "none" }}>
                  <path d={c.d} fill="none" stroke="#0284c7" strokeWidth={2} strokeDasharray="7 5" opacity={0.85} />
                </g>
              ))}
            </g>

            {/* Selo / carimbo */}
            <g style={{ pointerEvents: "none" }}>
              <rect x={W - 400} y={H - 210} width={380} height={190} fill="#ffffff" stroke="#0f172a" strokeWidth={2} />
              <line x1={W - 400} y1={H - 178} x2={W - 20} y2={H - 178} stroke="#0f172a" />
              <line x1={W - 400} y1={H - 120} x2={W - 20} y2={H - 120} stroke="#0f172a" />
              <text
                x={W - 210}
                y={H - 188}
                textAnchor="middle"
                fontSize="15"
                fontWeight="700"
                fill="#0f172a"
                fontFamily="ui-sans-serif, system-ui"
              >
                {meta.titulo}
              </text>
              <text x={W - 390} y={H - 161} fontSize="12" fill="#0f172a" fontFamily="ui-sans-serif, system-ui">
                Empresa: {meta.empresa || "—"} · Loja: {meta.loja || "—"} · Pedido nº {meta.pedido || "—"}
              </text>
              <text x={W - 390} y={H - 144} fontSize="12" fill="#0f172a" fontFamily="ui-sans-serif, system-ui">
                Cliente: {meta.cliente || "—"} · Tel: {meta.telefone || "—"}
              </text>
              <text x={W - 390} y={H - 127} fontSize="12" fill="#0f172a" fontFamily="ui-sans-serif, system-ui">
                Endereço: {meta.endereco || "—"}
              </text>

              <text
                x={W - 390}
                y={H - 100}
                fontSize="12"
                fontWeight="700"
                fill="#0f172a"
                fontFamily="ui-sans-serif, system-ui"
              >
                RESUMO DE MATERIAIS (estimativa)
              </text>
              {bom.map((linha, i) => (
                <text
                  key={linha}
                  x={W - 390}
                  y={H - 80 + i * 17}
                  fontSize="11.5"
                  fill="#0f172a"
                  fontFamily="ui-sans-serif, system-ui"
                >
                  {linha}
                </text>
              ))}
            </g>
          </svg>

          {!panelOpen && (
            <button
              onClick={() => setPanelOpen(true)}
              className="fixed bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-medium text-accent-foreground shadow-lg print:hidden lg:hidden"
            >
              <SlidersHorizontal className="size-4" /> Painel
            </button>
          )}
        </main>

        {/* Painel */}
        <aside
          className={`${
            panelOpen ? "block" : "hidden"
          } fixed inset-x-0 bottom-0 z-30 max-h-[60vh] overflow-auto border-t border-border bg-card p-4 shadow-[0_-10px_30px_-20px_rgba(15,23,42,.6)] print:hidden lg:static lg:block lg:max-h-none lg:w-72 lg:shrink-0 lg:border-l lg:border-t-0 lg:shadow-none`}
        >
          <button
            onClick={() => setPanelOpen(false)}
            className="mb-3 flex w-full items-center justify-end gap-1 text-xs text-muted-foreground lg:hidden"
          >
            Fechar <X className="size-4" />
          </button>

          {selectedDevice ? (
            <div className="space-y-4">
              <div>
                <p className="font-display text-sm font-bold">
                  {isArch(selectedDevice.kind)
                    ? selectedDevice.label
                    : `#${numbered.find((n) => n.id === selectedDevice.id)?.n} · ${selectedDevice.label}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Arraste o símbolo para mover · alça <RotateCw className="inline size-3" /> gira · alça branca
                  redimensiona
                </p>
              </div>
              <Field label="Nome / etiqueta">
                <input
                  value={selectedDevice.label}
                  onChange={(e) => patch(setDevices, selectedDevice.id, { label: e.target.value })}
                  className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                />
              </Field>
              {isCam(selectedDevice.kind) && (
                <Field label="Modelo Intelbras">
                  <select
                    value={selectedDevice.model ?? ""}
                    onChange={(e) => {
                      const m = findModel(e.target.value);
                      if (!m) {
                        patch(setDevices, selectedDevice.id, { model: "" });
                        return;
                      }
                      patch(setDevices, selectedDevice.id, {
                        model: m.modelo,
                        fov: m.fov,
                        range: m.ir,
                        label: `${m.modelo} · ${m.resolucao}`,
                      });
                    }}
                    className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                  >
                    <option value="">Genérica (sem modelo)</option>
                    {modelsFor(selectedDevice.kind).map((m) => (
                      <option key={m.modelo} value={m.modelo}>
                        {m.modelo} — {m.resolucao} · {m.fov}° · IR {m.ir} m
                      </option>
                    ))}
                  </select>
                  {selectedDevice.model && (
                    <p className="pt-1 text-xs text-muted-foreground">
                      {findModel(selectedDevice.model)?.tecnologia} · lente {findModel(selectedDevice.model)?.lente} ·
                      abertura máx. {findModel(selectedDevice.model)?.fov}° · infra máx.{" "}
                      {findModel(selectedDevice.model)?.ir} m
                    </p>
                  )}
                </Field>
              )}
              <Field label={`Direção · ${selectedDevice.rot}°`}>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selectedDevice.rot}
                  onChange={(e) => patch(setDevices, selectedDevice.id, { rot: +e.target.value })}
                  className="w-full accent-[var(--accent)]"
                />
              </Field>
              {isArch(selectedDevice.kind) && (
                <Field label={`Tamanho · ${selectedDevice.size.toFixed(1)} m`}>
                  <input
                    type="range"
                    min={0.4}
                    max={8}
                    step={0.1}
                    value={selectedDevice.size}
                    onChange={(e) => patch(setDevices, selectedDevice.id, { size: +e.target.value })}
                    className="w-full accent-[var(--accent)]"
                  />
                </Field>
              )}
              {DEVICE_INFO[selectedDevice.kind].range > 0 && (
                <>
                  <Field label={`Alcance · ${selectedDevice.range} m`}>
                    <input
                      type="range"
                      min={2}
                      max={100}
                      value={selectedDevice.range}
                      onChange={(e) => patch(setDevices, selectedDevice.id, { range: +e.target.value })}
                      className="w-full accent-[var(--accent)]"
                    />
                  </Field>
                  <Field label={`Ângulo · ${selectedDevice.fov}°`}>
                    <input
                      type="range"
                      min={20}
                      max={360}
                      value={selectedDevice.fov}
                      onChange={(e) => patch(setDevices, selectedDevice.id, { fov: +e.target.value })}
                      className="w-full accent-[var(--accent)]"
                    />
                  </Field>
                </>
              )}
              <button
                onClick={() => remove(selectedDevice.id)}
                className="flex w-full items-center justify-center gap-2 rounded-sm border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" /> Remover
              </button>
            </div>
          ) : selectedWall ? (
            <div className="space-y-4">
              <div>
                <p className="font-display text-sm font-bold">Parede · {wallLength(selectedWall).toFixed(2)} m</p>
                <p className="text-xs text-muted-foreground">
                  Arraste as bolinhas vermelhas nas pontas. Elas grudam nas outras paredes.
                </p>
              </div>
              <Field label="Metragem exata (m)">
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={wallLength(selectedWall).toFixed(2)}
                  onChange={(e) => {
                    const m = Math.max(0.1, +e.target.value || 0.1);
                    const w = selectedWall;
                    const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1) || 1;
                    const ux = (w.x2 - w.x1) / len;
                    const uy = (w.y2 - w.y1) / len;
                    const npx = m * PX_PER_M;
                    setWalls((s2) =>
                      s2.map((x) => (x.id === w.id ? { ...x, x2: w.x1 + ux * npx, y2: w.y1 + uy * npx } : x)),
                    );
                  }}
                  className="w-full rounded-sm border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
                />
              </Field>
              <button
                onClick={() => remove(selectedWall.id)}
                className="flex w-full items-center justify-center gap-2 rounded-sm border border-destructive/40 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" /> Remover parede
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="font-display text-sm font-bold text-foreground">Como usar</p>
              <p>
                1. <b>Parede</b>: arraste. A próxima parede gruda na ponta da anterior.
              </p>
              <p>
                2. <b>Terreno</b>: arraste para criar um retângulo fechado.
              </p>
              <p>3. Toque num ícone da barra e toque na planta: solta 1 item e volta para o modo mover.</p>
              <p>4. Item selecionado: arraste para mover, alça escura gira, alça branca aumenta (alcance/tamanho).</p>
              <p>5. Dois dedos ampliam/afastam · para apagar use a bolinha vermelha (X) ou o botão Remover.</p>
              <p>6. Solte um Gravador (DVR) para simular o caminho e a metragem do cabo.</p>
            </div>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <p className="font-display text-sm font-bold">Resumo do projeto</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {bom.map((l) => (
                <li key={l}>• {l}</li>
              ))}
            </ul>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <p className="font-display text-sm font-bold">Pedido / anexos</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Anexe o pedido, orçamento ou foto do local. Vai junto no PDF.
            </p>
            <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-sm border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted">
              <Paperclip className="size-4" /> Anexar arquivo
              <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  addAnexos(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            <ul className="mt-2 space-y-1 text-sm">
              {anexos.map((a, i) => (
                <li key={`${a.name}${i}`} className="flex items-center gap-2">
                  <span className="flex-1 truncate">{a.name}</span>
                  <button
                    onClick={() => setAnexos((s) => s.filter((_, j) => j !== i))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <button
              onClick={exportPDF}
              disabled={pdfBusy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-sm bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground disabled:opacity-60"
            >
              <FileText className="size-4" /> {pdfBusy ? "Gerando..." : "Gerar PDF do projeto"}
            </button>
          </div>


          <div className="mt-6 border-t border-border pt-4">
            <p className="font-display text-sm font-bold">Legenda</p>
            <ul className="mt-2 space-y-1.5 text-sm">
              {resumo.length === 0 && <li className="text-muted-foreground">Nenhum item ainda.</li>}
              {resumo.map(([k, n]) => (
                <li key={k} className="flex items-center gap-2">
                  <span className="inline-block size-3 rounded-full" style={{ backgroundColor: DEVICE_INFO[k].color }} />
                  <span className="flex-1">{DEVICE_INFO[k].label}</span>
                  <span className="font-mono text-xs text-muted-foreground">{n}x</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => {
              setWalls([]);
              setDevices([]);
              setSelected(null);
            }}
            className="mt-6 w-full rounded-sm border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            Nova prancha
          </button>
        </aside>
      </div>
    </div>
  );
}

function Handles({
  rDist,
  showResize = true,
  onRotate,
  onResize,
  onDelete,
}: {
  rDist: number;
  showResize?: boolean;
  onRotate: (e: React.PointerEvent) => void;
  onResize?: (e: React.PointerEvent) => void;
  onDelete: () => void;
}) {
  return (
    <g className="ui-only">

      {/* girar */}
      <g onPointerDown={onRotate} style={{ cursor: "grab" }}>
        <line x1={0} y1={0} x2={rDist} y2={0} stroke="#0f172a" strokeWidth={1.5} strokeDasharray="4 3" />
        <circle cx={rDist} cy={0} r={11} fill="#0f172a" />
        <path
          d="M -4 -3 A 5 5 0 1 1 -4 3"
          transform={`translate(${rDist} 0)`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={1.8}
        />
      </g>
      {/* redimensionar */}
      {showResize && onResize && (
        <g onPointerDown={onResize} style={{ cursor: "ew-resize" }}>
          <circle cx={0} cy={-rDist} r={11} fill="#ffffff" stroke="#0f172a" strokeWidth={2.5} />
          <path d={`M -5 ${-rDist} L 5 ${-rDist} M -5 ${-rDist} l 3 -3 M -5 ${-rDist} l 3 3 M 5 ${-rDist} l -3 -3 M 5 ${-rDist} l -3 3`} stroke="#0f172a" strokeWidth={1.8} fill="none" />
        </g>
      )}
      {/* excluir */}
      <g
        onPointerDown={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{ cursor: "pointer" }}
      >
        <circle cx={-rDist} cy={0} r={11} fill="#c0392b" />
        <path d={`M ${-rDist - 4} -4 L ${-rDist + 4} 4 M ${-rDist + 4} -4 L ${-rDist - 4} 4`} stroke="#ffffff" strokeWidth={2.2} />
      </g>
    </g>
  );
}

function ArchSymbol({ kind, size, active }: { kind: DeviceKind; size: number; active: boolean }) {
  const stroke = active ? "#c0392b" : "#0f172a";
  const w = Math.max(0.4, size) * PX_PER_M;

  if (kind === "porta") {
    return (
      <g stroke={stroke} fill="none" strokeWidth={2.5}>
        <rect x={-w / 2} y={-5} width={w} height={10} fill="#ffffff" stroke="none" />
        <line x1={-w / 2} y1={0} x2={w / 2} y2={0} strokeWidth={2} />
        <line x1={-w / 2} y1={0} x2={-w / 2} y2={-w} />
        <path d={`M ${-w / 2} ${-w} A ${w} ${w} 0 0 1 ${w / 2} 0`} strokeDasharray="4 3" />
      </g>
    );
  }

  if (kind === "portao") {
    const n = Math.max(3, Math.round(w / 14));
    return (
      <g stroke={stroke} strokeWidth={2}>
        <rect x={-w / 2} y={-7} width={w} height={14} fill="#ffffff" />
        {Array.from({ length: n - 1 }, (_, i) => (
          <line key={i} x1={-w / 2 + ((i + 1) * w) / n} y1={-7} x2={-w / 2 + ((i + 1) * w) / n} y2={7} strokeWidth={1.3} />
        ))}
      </g>
    );
  }

  if (kind === "janela") {
    return (
      <g stroke={stroke} strokeWidth={2}>
        <rect x={-w / 2} y={-5} width={w} height={10} fill="#ffffff" />
        <line x1={-w / 2} y1={0} x2={w / 2} y2={0} />
      </g>
    );
  }

  if (kind === "carro") {
    const h = w * 2.2;
    return (
      <g stroke={stroke} strokeWidth={2} fill="none">
        <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={w * 0.28} fill="#ffffff" />
        <path d={`M ${-w / 2 + 3} ${-h / 2 + h * 0.28} L ${w / 2 - 3} ${-h / 2 + h * 0.28}`} />
        <path d={`M ${-w / 2 + 3} ${h / 2 - h * 0.24} L ${w / 2 - 3} ${h / 2 - h * 0.24}`} />
        <rect x={-w * 0.3} y={-h / 2 + h * 0.08} width={w * 0.6} height={h * 0.18} rx={3} />
      </g>
    );
  }

  if (kind === "moto") {
    const h = w * 2.4;
    const r = w * 0.34;
    return (
      <g stroke={stroke} strokeWidth={2} fill="none">
        <circle cx={0} cy={-h / 2 + r} r={r} fill="#ffffff" />
        <circle cx={0} cy={h / 2 - r} r={r} fill="#ffffff" />
        <line x1={0} y1={-h / 2 + r} x2={0} y2={h / 2 - r} />
        <line x1={-w * 0.45} y1={-h * 0.12} x2={w * 0.45} y2={-h * 0.12} />
      </g>
    );
  }

  if (kind === "pessoa") {
    const r = w / 2;
    return (
      <g stroke={stroke} strokeWidth={2} fill="none">
        <circle cx={0} cy={0} r={r} fill="#ffffff" />
        <circle cx={0} cy={0} r={r * 0.45} fill={stroke} stroke="none" />
        <path d={`M ${-r * 0.75} ${r * 0.7} A ${r} ${r} 0 0 1 ${r * 0.75} ${r * 0.7}`} />
      </g>
    );
  }

  if (kind === "pet") {
    const r = w / 2;
    return (
      <g stroke={stroke} strokeWidth={1.8} fill="none">
        <circle cx={0} cy={r * 0.25} r={r * 0.72} fill="#ffffff" />
        <circle cx={-r * 0.55} cy={-r * 0.6} r={r * 0.3} fill="#ffffff" />
        <circle cx={r * 0.55} cy={-r * 0.6} r={r * 0.3} fill="#ffffff" />
        <circle cx={-r * 0.2} cy={r * 0.15} r={r * 0.1} fill={stroke} stroke="none" />
        <circle cx={r * 0.2} cy={r * 0.15} r={r * 0.1} fill={stroke} stroke="none" />
      </g>
    );
  }



  // escada
  const h = w * 2;
  const steps = Math.max(4, Math.round(h / 12));
  return (
    <g stroke={stroke} strokeWidth={1.8} fill="none">
      <rect x={-w / 2} y={-h / 2} width={w} height={h} fill="#ffffff" />
      {Array.from({ length: steps - 1 }, (_, i) => (
        <line key={i} x1={-w / 2} y1={-h / 2 + ((i + 1) * h) / steps} x2={w / 2} y2={-h / 2 + ((i + 1) * h) / steps} />
      ))}
      <path d={`M 0 ${h / 2 - 4} L 0 ${-h / 2 + 6} M -4 ${-h / 2 + 11} L 0 ${-h / 2 + 6} L 4 ${-h / 2 + 11}`} />
    </g>
  );
}

function patch(
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>,
  id: string,
  data: Partial<Device>,
) {
  setDevices((s) => s.map((d) => (d.id === id ? { ...d, ...data } : d)));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function btn(active: boolean) {
  return `flex size-9 items-center justify-center rounded-sm border transition-colors ${
    active
      ? "border-accent bg-accent text-accent-foreground"
      : "border-border text-muted-foreground hover:bg-muted"
  }`;
}
