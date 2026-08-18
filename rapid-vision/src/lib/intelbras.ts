import type { DeviceKind } from "./planta";

export type CamModel = {
  modelo: string;
  tipo: Extract<DeviceKind, "bullet" | "dome" | "speed" | "fisheye" | "wifi">;
  tecnologia: string;
  resolucao: string;
  lente: string;
  fov: number; // abertura horizontal máxima (graus)
  ir: number; // alcance máximo do infravermelho (m)
};

/** Catálogo Intelbras — abertura horizontal máxima e alcance do IR por modelo. */
export const INTELBRAS: CamModel[] = [
  { modelo: "VHD 1120 B G7", tipo: "bullet", tecnologia: "HDCVI", resolucao: "720p", lente: "2.8 mm", fov: 109, ir: 20 },
  { modelo: "VHD 1120 D G7", tipo: "dome", tecnologia: "HDCVI", resolucao: "720p", lente: "2.8 mm", fov: 109, ir: 20 },
  { modelo: "VHD 1220 B G7", tipo: "bullet", tecnologia: "HDCVI", resolucao: "1080p", lente: "2.8 mm", fov: 103, ir: 20 },
  { modelo: "VHD 1220 D G7", tipo: "dome", tecnologia: "HDCVI", resolucao: "1080p", lente: "2.8 mm", fov: 103, ir: 20 },
  { modelo: "VHD 3130 B G6", tipo: "bullet", tecnologia: "HDCVI", resolucao: "720p", lente: "3.6 mm", fov: 85, ir: 30 },
  { modelo: "VHD 3131 B G6", tipo: "bullet", tecnologia: "HDCVI", resolucao: "1080p", lente: "3.6 mm", fov: 85, ir: 30 },
  { modelo: "VHD 3230 D G6", tipo: "dome", tecnologia: "HDCVI", resolucao: "1080p", lente: "2.8 mm", fov: 103, ir: 30 },
  { modelo: "VHD 3230 VF G6", tipo: "bullet", tecnologia: "HDCVI", resolucao: "1080p", lente: "2.7–13.5 mm", fov: 104, ir: 40 },
  { modelo: "VHL 1120 B", tipo: "bullet", tecnologia: "HDCVI", resolucao: "720p", lente: "2.8 mm", fov: 109, ir: 20 },
  { modelo: "VHL 1220 B", tipo: "bullet", tecnologia: "HDCVI", resolucao: "1080p", lente: "2.8 mm", fov: 103, ir: 20 },
  { modelo: "VHL 1220 D", tipo: "dome", tecnologia: "HDCVI", resolucao: "1080p", lente: "2.8 mm", fov: 103, ir: 20 },
  { modelo: "VIP 1130 B G4", tipo: "bullet", tecnologia: "IP", resolucao: "1 MP", lente: "2.8 mm", fov: 95, ir: 30 },
  { modelo: "VIP 1230 B G4", tipo: "bullet", tecnologia: "IP", resolucao: "2 MP", lente: "2.8 mm", fov: 103, ir: 30 },
  { modelo: "VIP 1230 D G4", tipo: "dome", tecnologia: "IP", resolucao: "2 MP", lente: "2.8 mm", fov: 103, ir: 30 },
  { modelo: "VIP 1430 B", tipo: "bullet", tecnologia: "IP", resolucao: "4 MP", lente: "2.8 mm", fov: 100, ir: 30 },
  { modelo: "VIP 1430 D", tipo: "dome", tecnologia: "IP", resolucao: "4 MP", lente: "2.8 mm", fov: 100, ir: 30 },
  { modelo: "VIP 1220 B SD", tipo: "bullet", tecnologia: "IP", resolucao: "2 MP", lente: "2.8 mm", fov: 103, ir: 30 },
  { modelo: "VIP 1220 D SD", tipo: "dome", tecnologia: "IP", resolucao: "2 MP", lente: "2.8 mm", fov: 103, ir: 30 },
  { modelo: "VIP 3230 B G2", tipo: "bullet", tecnologia: "IP", resolucao: "2 MP", lente: "2.8 mm", fov: 103, ir: 30 },
  { modelo: "VIP 3230 D G2", tipo: "dome", tecnologia: "IP", resolucao: "2 MP", lente: "2.8 mm", fov: 103, ir: 30 },
  { modelo: "VIP 3430 B G2", tipo: "bullet", tecnologia: "IP", resolucao: "4 MP", lente: "2.8 mm", fov: 100, ir: 30 },
  { modelo: "VIP 3430 D G2", tipo: "dome", tecnologia: "IP", resolucao: "4 MP", lente: "2.8 mm", fov: 100, ir: 30 },
  { modelo: "VIP 3430 Z G2", tipo: "bullet", tecnologia: "IP", resolucao: "4 MP", lente: "2.7–13.5 mm", fov: 110, ir: 40 },
  { modelo: "VIP 3260 Z", tipo: "bullet", tecnologia: "IP", resolucao: "2 MP", lente: "2.7–13.5 mm", fov: 112, ir: 60 },
  { modelo: "VIP 5450 Z", tipo: "bullet", tecnologia: "IP", resolucao: "4 MP", lente: "2.7–13.5 mm", fov: 110, ir: 50 },
  { modelo: "VIP 5216 SD IR", tipo: "speed", tecnologia: "IP", resolucao: "2 MP", lente: "4.8–76.8 mm", fov: 63, ir: 100 },
  { modelo: "VIP 5232 SD IR", tipo: "speed", tecnologia: "IP", resolucao: "2 MP", lente: "4.8–153.6 mm", fov: 63, ir: 150 },
  { modelo: "VIP 5232 SD IA G2", tipo: "speed", tecnologia: "IP", resolucao: "1080p", lente: "4.8–153.6 mm", fov: 63, ir: 150 },
  { modelo: "VIP S3020 FE", tipo: "fisheye", tecnologia: "IP", resolucao: "3 MP", lente: "1.6 mm", fov: 360, ir: 10 },
  { modelo: "VIP S4020 FE", tipo: "fisheye", tecnologia: "IP", resolucao: "4 MP", lente: "1.6 mm", fov: 360, ir: 10 },
  { modelo: "iM3", tipo: "bullet", tecnologia: "IP", resolucao: "3 MP", lente: "2.8 mm", fov: 100, ir: 30 },
  { modelo: "iM5 S", tipo: "bullet", tecnologia: "IP", resolucao: "5 MP", lente: "2.8 mm", fov: 100, ir: 30 },
  { modelo: "iM7", tipo: "bullet", tecnologia: "IP", resolucao: "4 MP", lente: "2.8 mm", fov: 100, ir: 30 },
  { modelo: "Mibo IM4", tipo: "wifi", tecnologia: "Wi-Fi", resolucao: "4 MP", lente: "4.0 mm", fov: 86, ir: 10 },
  { modelo: "Mibo IM4 C", tipo: "wifi", tecnologia: "Wi-Fi", resolucao: "4 MP", lente: "4.0 mm", fov: 86, ir: 10 },
  { modelo: "Mibo IM5 SC", tipo: "wifi", tecnologia: "Wi-Fi", resolucao: "5 MP", lente: "4.0 mm", fov: 90, ir: 10 },
  { modelo: "Mibo IM7", tipo: "wifi", tecnologia: "Wi-Fi", resolucao: "7 MP", lente: "4.0 mm", fov: 106, ir: 10 },
];

export const CAM_KINDS: DeviceKind[] = ["bullet", "dome", "speed", "fisheye", "wifi"];
export const isCam = (k: DeviceKind) => CAM_KINDS.includes(k);

export const modelsFor = (k: DeviceKind) => INTELBRAS.filter((m) => m.tipo === k);
export const findModel = (nome: string) => INTELBRAS.find((m) => m.modelo === nome);
