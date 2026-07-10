import type { ProductivityStatus } from "./lib/productivity";

export interface OperatorData {
  id: string;
  data: Date;
  mes: string;
  nome: string;
  percentual: number;
  setor: string;
  turno: string;
  status: ProductivityStatus;
  diferencaMeta: number;
}

export interface FilterState {
  mes: string;
  nome: string;
  setor: string;
  turno: string;
  status: string;
}

export interface MonthlyAverage {
  mes: string;
  avg: number;
  count: number;
}

export interface RankingRow {
  position: number;
  nome: string;
  avg: number;
  status: ProductivityStatus;
  months: MonthlyAverage[];
  records: number;
  bestMonth: MonthlyAverage | null;
  worstMonth: MonthlyAverage | null;
  evolution: number;
  tendency: "Subindo" | "Caindo" | "Estável";
  setores: string[];
  turnos: string[];
}
