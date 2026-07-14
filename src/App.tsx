"use client";

import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  CircleGauge,
  Clock3,
  Crown,
  FilterX,
  Gauge,
  LoaderCircle,
  Medal,
  RefreshCcw,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TARGET_PRODUCTIVITY,
  buildRanking,
  formatChange,
  formatPercent,
  getMonthlyAverages,
  getPeriodAverage,
  getProductivityStatus,
  loadProductivityJson,
  mean,
  sortMonths,
} from "./lib/productivity";
import type { FilterState, MonthlyAverage, OperatorData, RankingRow } from "./types";

const EMPTY_FILTERS: FilterState = { mes: "", nome: "", setor: "", turno: "", status: "" };

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function applyFilters(data: OperatorData[], filters: FilterState, ignoreName = false) {
  const nameFilter = normalize(filters.nome);
  return data.filter((item) => {
    if (filters.mes && item.mes !== filters.mes) return false;
    if (filters.setor && item.setor !== filters.setor) return false;
    if (filters.turno && item.turno !== filters.turno) return false;
    if (filters.status && item.status !== filters.status) return false;
    if (!ignoreName && nameFilter && !normalize(item.nome).includes(nameFilter)) return false;
    return true;
  });
}

function statusTone(status: string): "success" | "warning" | "critical" {
  if (status === "Acima da Meta") return "success";
  if (status === "Abaixo da Meta") return "warning";
  return "critical";
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

function truncateList(items: string[], suffix = "") {
  if (!items.length) return "—";
  if (items.length === 1) return `${items[0]}${suffix}`;
  if (items.length === 2) return items.map((item) => `${item}${suffix}`).join(" • ");
  return `${items.slice(0, 2).map((item) => `${item}${suffix}`).join(" • ")} +${items.length - 2}`;
}

function SpinnerScreen() {
  return (
    <main className="state-screen">
      <div className="state-card">
        <LoaderCircle className="state-icon spin" />
        <p className="eyebrow">Preparando análise</p>
        <h1>Carregando produtividade</h1>
        <span>Lendo os registros do arquivo JSON.</span>
      </div>
    </main>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <main className="state-screen">
      <div className="state-card error-card">
        <AlertTriangle className="state-icon critical-text" />
        <p className="eyebrow">Falha no carregamento</p>
        <h1>Não foi possível abrir o dashboard</h1>
        <span>{message}</span>
        <button className="primary-button" onClick={onRetry}><RefreshCcw size={16} /> Tentar novamente</button>
      </div>
    </main>
  );
}

function Header({ onReload, loading }: { onReload: () => void; loading: boolean }) {
  const timestamp = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true"><Activity size={21} /></span>
          <div>
            <p className="eyebrow">Inteligência operacional</p>
            <h1>Produtividade Operacional</h1>
            <p className="topbar-subtitle">Desempenho individual dos operadores em uma visão única.</p>
          </div>
        </div>
        <div className="updated-block">
          <div><span>Atualizado em</span><strong>{timestamp}</strong></div>
          <button className="icon-button" onClick={onReload} title="Recarregar dados" aria-label="Recarregar dados">
            <RefreshCcw size={17} className={loading ? "spin" : ""} />
          </button>
        </div>
      </div>
    </header>
  );
}

interface FilterOptions {
  meses: string[];
  setores: string[];
  turnos: string[];
  statuses: string[];
  nomes: string[];
}

function FilterBar({
  filters,
  setFilters,
  options,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  options: FilterOptions;
}) {
  const activeCount = [filters.mes, filters.setor, filters.turno, filters.status, filters.nome].filter(Boolean).length;
  const selectFields = [
    { name: "mes", label: "Mês", icon: CalendarDays, values: options.meses },
    { name: "setor", label: "Setor", icon: Building2, values: options.setores },
    { name: "turno", label: "Turno", icon: Clock3, values: options.turnos },
    { name: "status", label: "Status", icon: Target, values: options.statuses },
  ] as const;

  return (
    <section className="filter-bar" aria-label="Filtros do dashboard">
      <div className="filter-inner">
        <div className="filter-heading">
          <span>Filtros da análise</span>
          {activeCount > 0 && <b>{activeCount} ativo{activeCount > 1 ? "s" : ""}</b>}
        </div>
        <div className="filter-grid">
          {selectFields.map(({ name, label, icon: Icon, values }) => (
            <label className="filter-control" key={name}>
              <span>{label}</span>
              <div className="control-shell">
                <Icon size={16} />
                <select
                  value={filters[name]}
                  onChange={(event) => setFilters((current) => ({ ...current, [name]: event.target.value }))}
                  aria-label={label}
                >
                  <option value="">Todos</option>
                  {values.map((value) => <option value={value} key={value}>{value}</option>)}
                </select>
                <ChevronDown size={15} />
              </div>
            </label>
          ))}
          <label className="filter-control collaborator-control">
            <span>Colaborador</span>
            <div className="control-shell">
              <Search size={16} />
              <input
                value={filters.nome}
                list="operator-options"
                onChange={(event) => setFilters((current) => ({ ...current, nome: event.target.value }))}
                placeholder="Buscar ou selecionar operador"
                aria-label="Buscar colaborador"
              />
              <datalist id="operator-options">
                {options.nomes.map((nome) => <option value={nome} key={nome} />)}
              </datalist>
            </div>
          </label>
          <button
            type="button"
            className="clear-button"
            disabled={!activeCount}
            onClick={() => setFilters(EMPTY_FILTERS)}
            title="Limpar filtros"
          >
            <FilterX size={17} /><span>Limpar</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="empty-panel">
      <Search size={28} />
      <h2>Nenhum operador encontrado</h2>
      <p>Revise os filtros aplicados para voltar a visualizar os resultados.</p>
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone,
  icon: Icon,
  onClick,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone: "success" | "warning" | "critical";
  icon: typeof Target;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "article";
  return (
    <Tag className={`metric-card ${tone}`} onClick={onClick}>
      <div className="metric-icon"><Icon size={19} /></div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{helper}</small>
      </div>
      {onClick && <ChevronRight className="metric-arrow" size={16} />}
    </Tag>
  );
}

function MainGauge({ average, operators, records }: { average: number; operators: number; records: number }) {
  const progress = Math.min(average / 1.2, 1) * 100;
  const gap = average - TARGET_PRODUCTIVITY;
  return (
    <article className="hero-card">
      <div className="hero-copy">
        <div className="section-kicker"><CircleGauge size={16} /> Visão consolidada</div>
        <span className="hero-label">Média geral</span>
        <strong className="hero-value">{formatPercent(average)}</strong>
        <div className={`target-gap ${gap >= 0 ? "success-text" : "critical-text"}`}>
          {gap >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
          <b>{formatChange(gap)}</b> em relação à meta de 95%
        </div>
        <p>{operators} operadores • {records} registros no período filtrado</p>
      </div>
      <div className="gauge-wrap" aria-label={`Média geral ${formatPercent(average)}`}>
        <svg viewBox="0 0 220 126" role="img">
          <defs>
            <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0fa968" />
              <stop offset="100%" stopColor="#62e6b3" />
            </linearGradient>
          </defs>
          <path className="gauge-track" pathLength="100" d="M 20 108 A 90 90 0 0 1 200 108" />
          <path className="gauge-progress" pathLength="100" strokeDasharray={`${progress} 100`} d="M 20 108 A 90 90 0 0 1 200 108" />
        </svg>
        <div><span>Escala</span><b>0–120%</b></div>
      </div>
    </article>
  );
}

function TopFive({ ranking, onSelect }: { ranking: RankingRow[]; onSelect: (name: string) => void }) {
  return (
    <article className="panel top-five-panel">
      <div className="panel-heading">
        <div><span className="section-kicker"><Trophy size={16} /> Destaques</span><h2>Top 5 operadores</h2></div>
        <span className="subtle-label">Média do período</span>
      </div>
      <div className="top-five-list">
        {ranking.slice(0, 5).map((row, index) => {
          const MedalIcon = index === 0 ? Crown : index < 3 ? Medal : null;
          return (
            <button className={`podium-row podium-${index + 1}`} key={row.nome} onClick={() => onSelect(row.nome)}>
              <span className="podium-position">
                {MedalIcon ? <MedalIcon size={16} /> : <i aria-hidden="true" />}
                <em>{index + 1}</em>
              </span>
              <span className="avatar">{initials(row.nome)}</span>
              <span className="podium-person"><b>{row.nome}</b><small>{truncateList(row.setores)} • {truncateList(row.turnos, "º turno")}</small></span>
              <strong>{formatPercent(row.avg)}</strong>
              <ChevronRight size={17} />
            </button>
          );
        })}
      </div>
    </article>
  );
}

function StatusDistribution({ ranking, setFilters }: { ranking: RankingRow[]; setFilters: React.Dispatch<React.SetStateAction<FilterState>> }) {
  const groups = [
    { status: "Acima da Meta", label: "Acima da meta", tone: "success" },
    { status: "Abaixo da Meta", label: "Abaixo da meta", tone: "warning" },
    { status: "Crítico", label: "Críticos", tone: "critical" },
  ];
  const total = ranking.length || 1;

  return (
    <article className="panel distribution-panel">
      <div className="panel-heading">
        <div><span className="section-kicker"><Gauge size={16} /> Distribuição</span><h2>Faixas de desempenho</h2></div>
        <span className="subtle-label">Clique para filtrar</span>
      </div>
      <div className="distribution-list">
        {groups.map((group) => {
          const count = ranking.filter((row) => row.status === group.status).length;
          const width = (count / total) * 100;
          return (
            <button key={group.status} className={`distribution-row ${group.tone}`} onClick={() => setFilters((current) => ({ ...current, status: group.status }))}>
              <span className="status-dot" />
              <span className="distribution-label"><b>{group.label}</b><small>{width.toFixed(1).replace(".", ",")}% da equipe</small></span>
              <div className="distribution-track"><i style={{ width: `${width}%` }} /></div>
              <strong>{count}</strong>
            </button>
          );
        })}
      </div>
      <div className="distribution-total"><UsersRound size={15} /> {ranking.length} operadores analisados</div>
    </article>
  );
}

type SortKey = "position" | "nome" | "avg" | "evolution";

function RankingTable({ ranking, onSelect }: { ranking: RankingRow[]; onSelect: (name: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "position", direction: "asc" });
  const [visible, setVisible] = useState(12);

  const sorted = useMemo(() => [...ranking].sort((a, b) => {
    let result = 0;
    if (sort.key === "nome") result = a.nome.localeCompare(b.nome, "pt-BR");
    else result = a[sort.key] - b[sort.key];
    return sort.direction === "asc" ? result : -result;
  }), [ranking, sort]);

  const changeSort = (key: SortKey) => setSort((current) => ({
    key,
    direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
  }));

  const ariaSort = (key: SortKey) => sort.key === key
    ? sort.direction === "asc" ? "ascending" : "descending"
    : "none";

  return (
    <article className="panel ranking-panel">
      <div className="panel-heading ranking-heading">
        <div><span className="section-kicker"><UsersRound size={16} /> Ranking completo</span><h2>Desempenho dos operadores</h2></div>
        <span className="results-badge">{ranking.length} resultados</span>
      </div>
      <div className="table-scroll">
        <table className="ranking-table">
          <thead><tr>
            <th aria-sort={ariaSort("position")}><button onClick={() => changeSort("position")}>Posição <ChevronDown size={13} /></button></th>
            <th aria-sort={ariaSort("nome")}><button onClick={() => changeSort("nome")}>Operador <ChevronDown size={13} /></button></th>
            <th aria-sort={ariaSort("avg")}><button onClick={() => changeSort("avg")}>Média <ChevronDown size={13} /></button></th>
            <th>Status</th><th>Melhor mês</th><th>Pior mês</th>
            <th aria-sort={ariaSort("evolution")}><button onClick={() => changeSort("evolution")}>Evolução <ChevronDown size={13} /></button></th>
            <th>Tendência</th>
          </tr></thead>
          <tbody>
            {sorted.slice(0, visible).map((row) => (
              <tr
                key={row.nome}
                onClick={() => onSelect(row.nome)}
              >
                <td><span className={`rank-number ${row.position <= 3 ? "rank-top" : ""}`}>{row.position}º</span></td>
                <td>
                  <button
                    type="button"
                    className="operator-link"
                    aria-label={`Abrir painel de ${row.nome}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(row.nome);
                    }}
                  >
                    <span className="operator-cell"><span className="avatar small">{initials(row.nome)}</span><span><b>{row.nome}</b><small>{truncateList(row.setores)} • {truncateList(row.turnos, "º")}</small></span></span>
                  </button>
                </td>
                <td><b className={`${statusTone(row.status)}-text`}>{formatPercent(row.avg)}</b></td>
                <td><span className={`status-badge ${statusTone(row.status)}`}><i />{row.status}</span></td>
                <td>{row.bestMonth ? <span>{row.bestMonth.mes}<small>{formatPercent(row.bestMonth.avg, 1)}</small></span> : "—"}</td>
                <td>{row.worstMonth ? <span>{row.worstMonth.mes}<small>{formatPercent(row.worstMonth.avg, 1)}</small></span> : "—"}</td>
                <td><b className={row.evolution >= 0 ? "success-text" : "critical-text"}>{formatChange(row.evolution)}</b></td>
                <td><span className={`trend-pill ${row.tendency.toLowerCase().replace("á", "a")}`}>{row.tendency === "Subindo" ? <TrendingUp size={14} /> : row.tendency === "Caindo" ? <TrendingDown size={14} /> : <Activity size={14} />}{row.tendency}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visible < ranking.length && <button className="show-more" onClick={() => setVisible((current) => current + 12)}>Mostrar mais operadores <ChevronDown size={15} /></button>}
    </article>
  );
}

function Overview({
  data,
  ranking,
  setFilters,
  onSelect,
}: {
  data: OperatorData[];
  ranking: RankingRow[];
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onSelect: (name: string) => void;
}) {
  if (!ranking.length) return <EmptyState />;
  const average = mean(ranking.map((row) => row.avg));
  const above = ranking.filter((row) => row.status === "Acima da Meta").length;
  const warning = ranking.filter((row) => row.status === "Abaixo da Meta").length;
  const critical = ranking.filter((row) => row.status === "Crítico").length;

  return (
    <div className="overview-content content-enter">
      <section className="overview-grid">
        <MainGauge average={average} operators={ranking.length} records={data.length} />
        <MetricCard label="Na meta" value={above} helper="Média igual ou acima de 95%" tone="success" icon={Target} onClick={() => setFilters((current) => ({ ...current, status: "Acima da Meta" }))} />
        <MetricCard label="Abaixo da meta" value={warning} helper="Média entre 80% e 94,99%" tone="warning" icon={ArrowDownRight} onClick={() => setFilters((current) => ({ ...current, status: "Abaixo da Meta" }))} />
        <MetricCard label="Críticos" value={critical} helper="Média inferior a 80%" tone="critical" icon={AlertTriangle} onClick={() => setFilters((current) => ({ ...current, status: "Crítico" }))} />
      </section>
      <section className="insight-grid">
        <TopFive ranking={ranking} onSelect={onSelect} />
        <StatusDistribution ranking={ranking} setFilters={setFilters} />
      </section>
      <RankingTable ranking={ranking} onSelect={onSelect} />
      <section className="rule-note">
        <ShieldCheck size={17} />
        <div><b>Regra de classificação preservada</b><span>Crítico: abaixo de 80% • Abaixo da meta: de 80% até menos de 95% • Acima da meta: 95% ou mais.</span></div>
      </section>
    </div>
  );
}

function MiniMetric({ label, value, helper, tone = "neutral", icon: Icon }: { label: string; value: string; helper: string; tone?: "success" | "warning" | "critical" | "neutral" | "primary"; icon: typeof Target }) {
  return (
    <article className={`individual-metric ${tone}`}>
      <div className="metric-icon"><Icon size={18} /></div>
      <span>{label}</span><strong>{value}</strong><small>{helper}</small>
    </article>
  );
}

function ComparisonChart({ operatorRows, teamRows }: { operatorRows: MonthlyAverage[]; teamRows: MonthlyAverage[] }) {
  const teamMap = new Map(teamRows.map((row) => [row.mes, row.avg]));
  const months = Array.from(new Set([...operatorRows.map((row) => row.mes), ...teamRows.map((row) => row.mes)])).sort(sortMonths);
  return (
    <article className="panel comparison-panel">
      <div className="panel-heading"><div><span className="section-kicker"><BarChart3 size={16} /> Comparativo</span><h2>Colaborador x equipe</h2></div><div className="legend"><span><i className="operator" />Colaborador</span><span><i className="team" />Equipe</span></div></div>
      <div className="comparison-list">
        {months.map((month) => {
          const operator = operatorRows.find((row) => row.mes === month)?.avg ?? 0;
          const team = teamMap.get(month) ?? 0;
          return (
            <div className="comparison-row" key={month}>
              <div><b>{month}</b><span>Colab. <strong>{formatPercent(operator)}</strong> • Equipe <em>{formatPercent(team)}</em></span></div>
              <div className="double-track"><i className={`operator ${operator < TARGET_PRODUCTIVITY ? "below-target" : "on-target"}`} style={{ width: `${Math.min(operator / 1.2, 1) * 100}%` }} /><i className="team" style={{ width: `${Math.min(team / 1.2, 1) * 100}%` }} /></div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const controlOffset = (point.x - previous.x) * 0.42;
    return `${path} C ${previous.x + controlOffset} ${previous.y}, ${point.x - controlOffset} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

function EvolutionChart({ rows }: { rows: MonthlyAverage[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const values = rows.map((row) => row.avg * 100);
  const min = Math.max(0, Math.floor((Math.min(...values, 95) - 8) / 10) * 10);
  const max = Math.ceil((Math.max(...values, 95) + 8) / 10) * 10;
  const range = Math.max(max - min, 20);
  const points = rows.map((row, index) => ({
    ...row,
    x: rows.length === 1 ? 50 : 7 + (index / (rows.length - 1)) * 86,
    y: 80 - ((row.avg * 100 - min) / range) * 62,
  }));
  const linePath = buildSmoothPath(points);
  const areaPath = points.length > 1
    ? `${linePath} L ${points.at(-1)!.x} 82 L ${points[0].x} 82 Z`
    : "";
  const targetY = 80 - ((95 - min) / range) * 62;
  const variation = rows.length > 1 ? rows.at(-1)!.avg - rows[0].avg : 0;
  const lowestIndex = values.indexOf(Math.min(...values));
  const highestIndex = values.indexOf(Math.max(...values));
  const activePoint = activeIndex === null ? null : points[activeIndex] ?? null;

  const labelPlacement = (index: number) => {
    const point = points[index];
    const previous = points[index - 1];
    const next = points[index + 1];
    const closeToNeighbor = (previous && Math.abs(previous.y - point.y) < 9)
      || (next && Math.abs(next.y - point.y) < 9);
    return point.y < 29 || (closeToNeighbor && index % 2 === 1) ? "below" : "above";
  };

  return (
    <article className="panel evolution-panel">
      <div className="panel-heading"><div><span className="section-kicker"><TrendingUp size={16} /> Trajetória</span><h2>Evolução mensal</h2></div><span className={`variation-badge ${variation >= 0 ? "success" : "critical"}`}>{formatChange(variation)} no período</span></div>
      <div className="line-chart">
        <div className="chart-plot">
          <svg viewBox="0 0 100 92" preserveAspectRatio="none" role="img" aria-label="Evolução mensal do colaborador">
            <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16c784" stopOpacity=".24" /><stop offset="72%" stopColor="#16c784" stopOpacity=".04" /><stop offset="100%" stopColor="#16c784" stopOpacity="0" /></linearGradient></defs>
            {[18, 49, 80].map((y) => <line key={y} x1="5" x2="95" y1={y} y2={y} className="chart-grid-line" />)}
            <line x1="5" x2="95" y1={targetY} y2={targetY} className="target-line" />
            {points.length > 1 && <path d={areaPath} fill="url(#areaGradient)" />}
            <path d={linePath} className="evolution-line" />
            {points.map((point, index) => {
              const hasDistinctExtremes = lowestIndex !== highestIndex;
              const isLowest = hasDistinctExtremes && index === lowestIndex;
              const isHighest = hasDistinctExtremes && index === highestIndex;
              const tone = isLowest ? "lowest" : isHighest ? "highest" : "neutral";
              return (
                <g key={point.mes} className={`evolution-point ${tone}`}>
                  {(isLowest || isHighest) && <circle cx={point.x} cy={point.y} r="1.8" className="evolution-halo" />}
                  <circle cx={point.x} cy={point.y} r={isLowest || isHighest ? "1.15" : ".8"} className="evolution-dot" />
                </g>
              );
            })}
          </svg>
          {points.map((point, index) => {
            const hasDistinctExtremes = lowestIndex !== highestIndex;
            const isLowest = hasDistinctExtremes && index === lowestIndex;
            const isHighest = hasDistinctExtremes && index === highestIndex;
            const tone = isLowest ? "lowest" : isHighest ? "highest" : "neutral";
            return (
              <button
                type="button"
                className={`chart-hit-target ${tone}`}
                key={point.mes}
                style={{ left: `${point.x}%`, top: `${(point.y / 92) * 100}%` }}
                onPointerEnter={(event) => event.pointerType === "mouse" && setActiveIndex(index)}
                onPointerLeave={(event) => event.pointerType === "mouse" && setActiveIndex(null)}
                onPointerDown={(event) => {
                  if (event.pointerType !== "mouse") setActiveIndex((current) => current === index ? null : index);
                }}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                onClick={(event) => {
                  if (event.detail === 0) setActiveIndex(index);
                }}
                aria-label={`${point.mes}: produtividade ${formatPercent(point.avg)}, meta 95%, diferença ${formatChange(point.avg - TARGET_PRODUCTIVITY)}`}
              >
                <span className={`point-label ${labelPlacement(index)}`}>{formatPercent(point.avg, 1)}</span>
              </button>
            );
          })}
          {activePoint && (
            <div
              className={`chart-tooltip ${activePoint.y < 38 ? "below" : "above"} ${activePoint.x < 20 ? "align-start" : activePoint.x > 80 ? "align-end" : ""}`}
              style={{ left: `${activePoint.x}%`, top: `${(activePoint.y / 92) * 100}%` }}
              role="status"
            >
              <div className="tooltip-heading"><span>{activePoint.mes}</span><small>Visão mensal</small></div>
              <div className="tooltip-metric"><span>Produtividade</span><strong>{formatPercent(activePoint.avg)}</strong></div>
              <div className="tooltip-row"><span>Meta</span><b>{formatPercent(TARGET_PRODUCTIVITY, 0)}</b></div>
              <div className="tooltip-row"><span>Diferença</span><b className={activePoint.avg >= TARGET_PRODUCTIVITY ? "success-text" : "critical-text"}>{formatChange(activePoint.avg - TARGET_PRODUCTIVITY)}</b></div>
            </div>
          )}
          <span className="target-label" style={{ top: `${(targetY / 92) * 100}%` }}>Meta 95%</span>
          <div className="month-axis">{points.map((point) => <span key={point.mes} style={{ left: `${point.x}%` }}>{point.mes.slice(0, 3)}</span>)}</div>
        </div>
      </div>
    </article>
  );
}

function MonthlyTable({ rows }: { rows: MonthlyAverage[] }) {
  return (
    <article className="panel monthly-panel">
      <div className="panel-heading"><div><span className="section-kicker"><CalendarDays size={16} /> Histórico</span><h2>Resumo mensal</h2></div><span className="subtle-label">{rows.length} meses</span></div>
      <div className="table-scroll"><table className="monthly-table"><thead><tr><th>Mês</th><th>Média</th><th>Variação mensal</th><th>Status</th></tr></thead><tbody>
        {rows.map((row, index) => {
          const status = getProductivityStatus(row.avg);
          const previousAverage = rows[index - 1]?.avg;
          const change = index === 0 || !previousAverage ? 0 : (row.avg - previousAverage) / previousAverage;
          const changeTone = change > 0 ? "success" : change < 0 ? "critical" : "neutral";
          return <tr key={row.mes}><td><b>{row.mes}</b></td><td><strong className={`${statusTone(status)}-text`}>{formatPercent(row.avg)}</strong></td><td><span className={`monthly-change ${changeTone}`}>{change > 0 ? <ArrowUpRight size={13} /> : change < 0 ? <ArrowDownRight size={13} /> : null}{formatPercent(change)}</span></td><td><span className={`status-badge ${statusTone(status)}`}><i />{status}</span></td></tr>;
        })}
      </tbody></table></div>
    </article>
  );
}

function QuickStats({ rows, records, average, teamAverage }: { rows: MonthlyAverage[]; records: OperatorData[]; average: number; teamAverage: number }) {
  const above = records.filter((row) => row.percentual >= TARGET_PRODUCTIVITY).length;
  const warning = records.filter((row) => row.percentual >= 0.8 && row.percentual < TARGET_PRODUCTIVITY).length;
  const critical = records.filter((row) => row.percentual < 0.8).length;
  const status = getProductivityStatus(average);
  const scale = Math.max(average, teamAverage, 1.2);

  return (
    <article className="panel quick-stats-panel">
      <div className="panel-heading"><div><span className="section-kicker"><CircleGauge size={16} /> Estatísticas rápidas</span><h2>Resumo do período</h2></div></div>
      <div className="quick-stats-list">
        <div><span>Registros analisados</span><b>{records.length}</b></div>
        <div><span>Na meta</span><b className="success-text">{above}</b></div>
        <div><span>Abaixo da meta</span><b className="warning-text">{warning}</b></div>
        <div><span>Críticos</span><b className="critical-text">{critical}</b></div>
        <div><span>Meses analisados</span><b>{rows.length}</b></div>
        <div><span>Status médio</span><b className={`${statusTone(status)}-text`}>{status}</b></div>
      </div>
      <div className="quick-comparison">
        <div className="quick-comparison-title"><UsersRound size={16} /><span>Comparação com a equipe</span></div>
        <div className="quick-bar-row"><div><span>Equipe</span><b>{formatPercent(teamAverage)}</b></div><i><span className="team" style={{ width: `${(teamAverage / scale) * 100}%` }} /></i></div>
        <div className="quick-bar-row"><div><span>Colaborador</span><b>{formatPercent(average)}</b></div><i><span className="operator" style={{ width: `${(average / scale) * 100}%` }} /></i></div>
      </div>
    </article>
  );
}

function IndividualView({ name, records, teamData, onBack }: { name: string; records: OperatorData[]; teamData: OperatorData[]; onBack: () => void }) {
  const stats = useMemo(() => {
    const monthlyRows = getMonthlyAverages(records);
    const teamRows = getMonthlyAverages(teamData);
    const avg = getPeriodAverage(records);
    const teamAvg = getPeriodAverage(teamData);
    const best = monthlyRows.reduce<MonthlyAverage | null>((current, row) => (!current || row.avg > current.avg ? row : current), null);
    const worst = monthlyRows.reduce<MonthlyAverage | null>((current, row) => (!current || row.avg < current.avg ? row : current), null);
    const above = records.filter((row) => row.percentual >= TARGET_PRODUCTIVITY).length;
    const rank = buildRanking(teamData).find((row) => row.nome === name)?.position ?? 0;
    return { monthlyRows, teamRows, avg, teamAvg, best, worst, above, rank, total: buildRanking(teamData).length };
  }, [name, records, teamData]);

  const sectors = Array.from(new Set(records.map((row) => row.setor))).sort();
  const shifts = Array.from(new Set(records.map((row) => row.turno))).sort();
  const difference = stats.avg - stats.teamAvg;

  return (
    <div className="individual-content content-enter">
      <section className="individual-hero">
        <button className="back-button" onClick={onBack}><ArrowLeft size={16} /> Voltar para visão geral</button>
        <div className="individual-profile">
          <span className="profile-avatar">{initials(name)}</span>
          <div><p className="eyebrow">Painel individual</p><h2>{name}</h2><span>{truncateList(sectors)} • {truncateList(shifts, "º turno")}</span></div>
        </div>
        <div className="profile-context">
          <div><span>Registros</span><b>{records.length}</b></div>
          <div><span>Média equipe</span><b>{formatPercent(stats.teamAvg)}</b></div>
          <div><span>Diferença</span><b className={difference >= 0 ? "success-text" : "critical-text"}>{formatChange(difference)}</b></div>
        </div>
      </section>
      <section className="individual-metrics">
        <MiniMetric label="Produtividade média" value={formatPercent(stats.avg)} helper="Média no período filtrado" tone={statusTone(getProductivityStatus(stats.avg))} icon={Target} />
        <MiniMetric label="Melhor mês" value={stats.best ? formatPercent(stats.best.avg) : "—"} helper={stats.best?.mes ?? "Sem registro"} tone="success" icon={TrendingUp} />
        <MiniMetric label="Pior mês" value={stats.worst ? formatPercent(stats.worst.avg) : "—"} helper={stats.worst?.mes ?? "Sem registro"} tone="critical" icon={TrendingDown} />
        <MiniMetric label="Registros na meta" value={`${stats.above} de ${records.length}`} helper={records.length ? `${((stats.above / records.length) * 100).toFixed(1).replace(".", ",")}% dos registros` : "Sem registro"} tone="primary" icon={ShieldCheck} />
        <MiniMetric label="Ranking" value={stats.rank ? `${stats.rank}º` : "—"} helper={`de ${stats.total} operadores`} icon={Trophy} />
      </section>
      <section className="individual-chart-grid">
        <ComparisonChart operatorRows={stats.monthlyRows} teamRows={stats.teamRows} />
        <EvolutionChart rows={stats.monthlyRows} />
      </section>
      <section className="individual-details-grid">
        <MonthlyTable rows={stats.monthlyRows} />
        <QuickStats rows={stats.monthlyRows} records={records} average={stats.avg} teamAverage={stats.teamAvg} />
      </section>
    </div>
  );
}

export default function DashboardApp() {
  const [data, setData] = useState<OperatorData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await loadProductivityJson());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erro desconhecido ao carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadProductivityJson()
      .then((loaded) => {
        if (active) setData(loaded);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Erro desconhecido ao carregar os dados.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const options = useMemo<FilterOptions>(() => {
    if (!data) return { meses: [], setores: [], turnos: [], statuses: [], nomes: [] };
    return {
      meses: Array.from(new Set(data.map((row) => row.mes))).sort(sortMonths),
      setores: Array.from(new Set(data.map((row) => row.setor))).filter(Boolean).sort(),
      turnos: Array.from(new Set(data.map((row) => row.turno))).filter(Boolean).sort((a, b) => Number(a) - Number(b)),
      statuses: ["Acima da Meta", "Abaixo da Meta", "Crítico"],
      nomes: Array.from(new Set(data.map((row) => row.nome))).filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR")),
    };
  }, [data]);

  const selectedName = useMemo(() => {
    const typed = normalize(filters.nome);
    return options.nomes.find((name) => normalize(name) === typed) ?? "";
  }, [filters.nome, options.nomes]);

  const teamData = useMemo(() => data ? applyFilters(data, filters, true) : [], [data, filters]);
  const filteredData = useMemo(() => data ? applyFilters(data, filters) : [], [data, filters]);
  const selectedRecords = useMemo(() => selectedName ? teamData.filter((row) => row.nome === selectedName) : [], [selectedName, teamData]);
  const ranking = useMemo(() => buildRanking(filteredData), [filteredData]);

  if (loading && !data) return <SpinnerScreen />;
  if (error || !data) return <ErrorScreen message={error ?? "Nenhum dado carregado."} onRetry={loadData} />;

  const selectOperator = (name: string) => {
    setFilters((current) => ({ ...current, nome: name }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="app-shell">
      <div className="app-main">
        <Header onReload={loadData} loading={loading} />
        <FilterBar filters={filters} setFilters={setFilters} options={options} />
        <main className="dashboard-main">
          {selectedName ? (
            <IndividualView name={selectedName} records={selectedRecords} teamData={teamData} onBack={() => setFilters((current) => ({ ...current, nome: "" }))} />
          ) : (
            <Overview data={filteredData} ranking={ranking} setFilters={setFilters} onSelect={selectOperator} />
          )}
        </main>
      </div>
    </div>
  );
}
