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

function getChartData(
  rows: Record<string, unknown>[],
  columns: string[]
): { labels: string[]; values: number[]; name: string }[] | null {
  if (rows.length === 0) return null
  const catCols = columns.filter((c) => inferColumnType(rows, c) === 'categorical')
  const numCols = columns.filter((c) => inferColumnType(rows, c) === 'numeric')
  const cat = catCols[0]
  const num = numCols[0]
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
      .map(([label, value]) => ({ name: label, labels: [label], values: [value] }))
  }
  const countMap = new Map<string, number>()
  for (const row of rows) {
    const k = key(row[cat])
    countMap.set(k, (countMap.get(k) ?? 0) + 1)
  }
  return Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([label, value]) => ({ name: label, labels: [label], values: [value] }))
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

export function DataCharts({ rows, columns }: DataChartsProps) {
  const chartData = getChartData(rows, columns)
  const analysis = getSummaryAnalysis(rows, columns)
  const hasNumeric = columns.some((c) => inferColumnType(rows, c) === 'numeric')

  if (rows.length === 0) return null
  if (!chartData || chartData.length === 0) return null

  const barData = chartData.map((d) => ({
    name: d.name.length > 18 ? d.name.slice(0, 15) + '…' : d.name,
    value: d.values[0] ?? 0,
    fullName: d.name,
  }))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Analysis
        </h3>
        <p className="text-sm text-slate-700">{analysis}</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Chart
        </h3>
        <div className="h-[260px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            {barData.length <= 6 && !hasNumeric ? (
              <PieChart>
                <Pie
                  data={barData}
                  dataKey="value"
                  nameKey="fullName"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {barData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, 'Count']} />
                <Legend />
              </PieChart>
            ) : (
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  angle={barData.length > 6 ? -35 : 0}
                  textAnchor={barData.length > 6 ? 'end' : 'middle'}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [v, 'Value']}
                  labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ''}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} name="Value" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
