import type { MonthlyAverage, OperatorData, RankingRow } from "../types";

export const TARGET_PRODUCTIVITY = 0.95;
export type ProductivityStatus = "Acima da Meta" | "Abaixo da Meta" | "Crítico";

export const MONTH_ORDER: Record<string, number> = {
  Janeiro: 1,
  Fevereiro: 2,
  Março: 3,
  Abril: 4,
  Maio: 5,
  Junho: 6,
  Julho: 7,
  Agosto: 8,
  Setembro: 9,
  Outubro: 10,
  Novembro: 11,
  Dezembro: 12,
};

export function sortMonths(a: string, b: string) {
  const difference = (MONTH_ORDER[a] ?? 99) - (MONTH_ORDER[b] ?? 99);
  return difference || a.localeCompare(b, "pt-BR");
}

export function normalizeProductivity(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return value > 3 ? value / 100 : value;
  }

  const textValue = String(value).trim();
  const hasPercentSymbol = textValue.includes("%");
  const cleanedText = textValue.replace("%", "").trim();
  const normalizedText = cleanedText.includes(",") && cleanedText.includes(".")
    ? cleanedText.replace(/\./g, "").replace(",", ".")
    : cleanedText.replace(",", ".");
  const numericValue = Number.parseFloat(normalizedText);

  if (!Number.isFinite(numericValue)) return 0;
  if (hasPercentSymbol) return numericValue / 100;
  return numericValue > 3 ? numericValue / 100 : numericValue;
}

export function getProductivityStatus(percentual: number): ProductivityStatus {
  if (percentual < 0.8) return "Crítico";
  if (percentual < TARGET_PRODUCTIVITY) return "Abaixo da Meta";
  return "Acima da Meta";
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

export function formatPercent(value: number, digits = 2): string {
  return `${(value * 100).toFixed(digits).replace(".", ",")}%`;
}

export function formatChange(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1).replace(".", ",")}%`;
}

export function getMonthlyAverages(records: OperatorData[]): MonthlyAverage[] {
  const monthMap = new Map<string, { total: number; count: number }>();
  records.forEach((item) => {
    const current = monthMap.get(item.mes) ?? { total: 0, count: 0 };
    monthMap.set(item.mes, {
      total: current.total + item.percentual,
      count: current.count + 1,
    });
  });

  return Array.from(monthMap.entries())
    .map(([mes, value]) => ({
      mes,
      avg: value.count ? value.total / value.count : 0,
      count: value.count,
    }))
    .sort((a, b) => sortMonths(a.mes, b.mes));
}

export function getPeriodAverage(records: OperatorData[]): number {
  return mean(getMonthlyAverages(records).map((row) => row.avg));
}

export function buildRanking(data: OperatorData[]): RankingRow[] {
  const operatorMap = new Map<string, OperatorData[]>();
  data.forEach((item) => {
    const list = operatorMap.get(item.nome) ?? [];
    list.push(item);
    operatorMap.set(item.nome, list);
  });

  return Array.from(operatorMap.entries())
    .map(([nome, records]) => {
      const months = getMonthlyAverages(records);
      const avg = getPeriodAverage(records);
      const bestMonth = months.reduce<MonthlyAverage | null>(
        (current, item) => (!current || item.avg > current.avg ? item : current),
        null,
      );
      const worstMonth = months.reduce<MonthlyAverage | null>(
        (current, item) => (!current || item.avg < current.avg ? item : current),
        null,
      );
      const evolution = months.length > 1 ? months.at(-1)!.avg - months[0].avg : 0;
      const tendency = Math.abs(evolution) <= 0.02
        ? "Estável"
        : evolution > 0
          ? "Subindo"
          : "Caindo";

      return {
        position: 0,
        nome,
        avg,
        status: getProductivityStatus(avg),
        months,
        records: records.length,
        bestMonth,
        worstMonth,
        evolution,
        tendency,
        setores: Array.from(new Set(records.map((item) => item.setor))).sort(),
        turnos: Array.from(new Set(records.map((item) => item.turno))).sort(),
      } satisfies RankingRow;
    })
    .sort((a, b) => b.avg - a.avg || a.nome.localeCompare(b.nome, "pt-BR"))
    .map((row, index) => ({ ...row, position: index + 1 }));
}

function normalizeText(value: unknown, fallback = "-"): string {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

function getValue(row: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) if (row[key] !== undefined) return row[key];
  const normalizedKeys = keys.map(normalizeKey);
  const matchingKey = Object.keys(row).find((key) => normalizedKeys.includes(normalizeKey(key)));
  return matchingKey ? row[matchingKey] : undefined;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + value * 86400000);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const text = value.trim();
  const brDate = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (brDate) {
    const yearValue = Number(brDate[3]);
    const parsed = new Date(yearValue < 100 ? 2000 + yearValue : yearValue, Number(brDate[2]) - 1, Number(brDate[1]));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function loadProductivityJson(): Promise<OperatorData[]> {
  const response = await fetch("/data/produtividade.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Não foi possível carregar o arquivo JSON (${response.status}).`);

  const json = await response.json();
  const rows: Record<string, unknown>[] = Array.isArray(json) ? json : json?.dados;
  if (!Array.isArray(rows)) throw new Error('O JSON deve ser uma lista ou conter a propriedade "dados".');

  const processed = rows.map((row, index) => {
    const parsedDate = parseDate(getValue(row, ["data", "DATA"]));
    if (!parsedDate) throw new Error(`Data inválida no registro ${index + 1}.`);
    const percentual = normalizeProductivity(getValue(row, ["percentual", "PERCENTUAL"]));
    const nome = normalizeText(getValue(row, ["nome", "NOME"]), "Desconhecido");
    const monthFromJson = normalizeText(getValue(row, ["mes", "MÊS", "MES"]), "");
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    return {
      id: `${parsedDate.toISOString()}-${index}-${nome}`,
      data: parsedDate,
      mes: monthFromJson || monthNames[parsedDate.getMonth()],
      nome,
      percentual,
      setor: normalizeText(getValue(row, ["setor", "SETOR"])),
      turno: normalizeText(getValue(row, ["turno", "TURNO"])),
      status: getProductivityStatus(percentual),
      diferencaMeta: percentual - TARGET_PRODUCTIVITY,
    } satisfies OperatorData;
  });

  if (!processed.length) throw new Error("Nenhum registro válido encontrado no JSON.");
  return processed;
}
