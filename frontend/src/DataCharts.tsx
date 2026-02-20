import { useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'

const CHART_COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
  '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6',
]

function isNumeric(value: unknown): boolean {
  if (value == null || value === '') return false
  if (typeof value === 'number' && !Number.isNaN(value)) return true
  if (typeof value === 'string') {
    const n = Number(value)
    return !Number.isNaN(n) && value.trim() !== ''
  }
  return false
}

function inferColumnType(
  rows: Record<string, unknown>[],
  col: string
): 'numeric' | 'categorical' {
  const values = rows.map((r) => r[col]).filter((v) => v != null && v !== '')
  if (values.length === 0) return 'categorical'
  const numericCount = values.filter((v) => isNumeric(v)).length
  return numericCount >= values.length * 0.7 ? 'numeric' : 'categorical'
}

export type ChartType = 'bar' | 'pie' | 'line' | 'area' | 'donut'

export interface ChartDataPoint {
  name: string
  value: number
  fullName: string
}

function getChartData(
  rows: Record<string, unknown>[],
  columns: string[],
  categoryColumn?: string,
  valueColumn?: string | null
): ChartDataPoint[] | null {
  if (rows.length === 0) return null
  const catCols = columns.filter((c) => inferColumnType(rows, c) === 'categorical')
  const numCols = columns.filter((c) => inferColumnType(rows, c) === 'numeric')
  const cat = categoryColumn && catCols.includes(categoryColumn) ? categoryColumn : catCols[0]
  const num = valueColumn === null ? undefined : (valueColumn && numCols.includes(valueColumn) ? valueColumn : numCols[0])
  if (!cat) return null

  const key = (v: unknown) => String(v ?? '').trim() || '(empty)'
  if (num) {
    const map = new Map<string, number>()
    for (const row of rows) {
      const k = key(row[cat])
      const val = Number(row[num]) || 0
      map.set(k, (map.get(k) ?? 0) + val)
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([label, value]) => ({
        name: label.length > 18 ? label.slice(0, 15) + '…' : label,
        value,
        fullName: label,
      }))
  }
  const countMap = new Map<string, number>()
  for (const row of rows) {
    const k = key(row[cat])
    countMap.set(k, (countMap.get(k) ?? 0) + 1)
  }
  return Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([label, value]) => ({
      name: label.length > 18 ? label.slice(0, 15) + '…' : label,
      value,
      fullName: label,
    }))
}

function getSummaryAnalysis(
  rows: Record<string, unknown>[],
  columns: string[]
): string {
  if (rows.length === 0) return 'No data to summarize.'
  const parts: string[] = []
  parts.push(`Total: ${rows.length} row${rows.length !== 1 ? 's' : ''}.`)
  const catCols = columns.filter((c) => inferColumnType(rows, c) === 'categorical')
  const numCols = columns.filter((c) => inferColumnType(rows, c) === 'numeric')
  for (const col of catCols.slice(0, 2)) {
    const countMap = new Map<string, number>()
    for (const row of rows) {
      const k = String(row[col] ?? '').trim() || '(empty)'
      countMap.set(k, (countMap.get(k) ?? 0) + 1)
    }
    const sorted = Array.from(countMap.entries()).sort((a, b) => b[1] - a[1])
    if (sorted.length > 0) {
      const top = sorted[0]
      parts.push(`Top ${col}: ${top[0]} (${top[1]}).`)
    }
  }
  for (const col of numCols.slice(0, 1)) {
    const vals = rows.map((r) => Number(r[col])).filter((n) => !Number.isNaN(n))
    if (vals.length > 0) {
      const sum = vals.reduce((a, b) => a + b, 0)
      const avg = sum / vals.length
      parts.push(`${col}: avg ${avg.toFixed(1)}${vals.length < rows.length ? ` (${vals.length} values)` : ''}.`)
    }
  }
  return parts.join(' ')
}

interface DataChartsProps {
  rows: Record<string, unknown>[]
  columns: string[]
}

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: 'bar', label: 'Bar' },
  { id: 'pie', label: 'Pie' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
  { id: 'donut', label: 'Donut' },
]

export function DataCharts({ rows, columns }: DataChartsProps) {
  const catCols = columns.filter((c) => inferColumnType(rows, c) === 'categorical')
  const numCols = columns.filter((c) => inferColumnType(rows, c) === 'numeric')

  const [chartType, setChartType] = useState<ChartType>(() => {
    const data = getChartData(rows, columns)
    if (!data || data.length === 0) return 'bar'
    return data.length <= 6 && numCols.length === 0 ? 'pie' : 'bar'
  })
  const [categoryColumn, setCategoryColumn] = useState<string | undefined>(undefined)
  const [valueColumn, setValueColumn] = useState<string | null | undefined>(undefined)

  const chartData = getChartData(rows, columns, categoryColumn, valueColumn)
  const analysis = getSummaryAnalysis(rows, columns)

  if (rows.length === 0) return null
  if (!chartData || chartData.length === 0) return null

  const valueLabel = valueColumn === null ? 'Count' : (valueColumn || numCols[0] || 'Value')

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Analysis
        </h3>
        <p className="text-sm text-slate-700">{analysis}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Charts &amp; graphs
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as ChartType)}
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {CHART_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {catCols.length > 1 && (
              <select
                value={categoryColumn ?? catCols[0]}
                onChange={(e) => setCategoryColumn(e.target.value || undefined)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {catCols.map((c) => (
                  <option key={c} value={c}>
                    Group by: {c}
                  </option>
                ))}
              </select>
            )}
            {numCols.length > 0 && (
              <select
                value={valueColumn === null ? '__count__' : (valueColumn ?? numCols[0] ?? '')}
                onChange={(e) =>
                  setValueColumn(e.target.value === '__count__' ? null : e.target.value || undefined)
                }
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="__count__">Count</option>
                {numCols.map((c) => (
                  <option key={c} value={c}>
                    Value: {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <div className="h-[280px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'pie' && (
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="fullName"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number | undefined) => [v ?? 0, valueLabel]} />
                <Legend />
              </PieChart>
            )}
            {chartType === 'donut' && (
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="fullName"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number | undefined) => [v ?? 0, valueLabel]} />
                <Legend />
              </PieChart>
            )}
            {chartType === 'bar' && (
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={chartData.length > 6 ? -35 : 0}
                  textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number | undefined) => [v ?? 0, valueLabel]}
                  labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ''}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name={valueLabel} />
              </BarChart>
            )}
            {chartType === 'line' && (
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={chartData.length > 6 ? -35 : 0}
                  textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number | undefined) => [v ?? 0, valueLabel]}
                  labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ''}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={{ fill: '#6366f1', r: 4 }}
                  name={valueLabel}
                />
              </LineChart>
            )}
            {chartType === 'area' && (
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={chartData.length > 6 ? -35 : 0}
                  textAnchor={chartData.length > 6 ? 'end' : 'middle'}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number | undefined) => [v ?? 0, valueLabel]}
                  labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ''}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#6366f1"
                  fill="#6366f1"
                  fillOpacity={0.4}
                  name={valueLabel}
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
