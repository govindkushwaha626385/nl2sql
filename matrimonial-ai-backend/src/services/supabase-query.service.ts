/**
 * Converts generated PostgreSQL SQL to Supabase JavaScript client format.
 * Best-effort for our known query shape: SELECT ... FROM profiles p LEFT JOIN ... WHERE ... LIMIT.
 */

const ALIAS_TO_TABLE: Record<string, string> = {
  p: 'profiles',
  pl: 'profile_locations',
  c: 'career_details',
  sb: 'social_background',
  lh: 'lifestyle_habits',
  ed: 'education_details',
  f: 'family_origin',
  uh: 'user_horoscopes',
}

function aliasToTable(alias: string): string {
  return ALIAS_TO_TABLE[alias] ?? alias
}

/** Build Supabase .select() string: profiles columns + relation(columns) for joined tables. */
function buildSelectClause(sql: string): string {
  const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM\s+/i)
  if (!selectMatch?.[1]) return '*' 

  const list = selectMatch[1].split(',').map((s) => s.trim())
  const byTable = new Map<string, string[]>()
  for (const part of list) {
    const colMatch = part.match(/^(\w+)\.(\w+)$/)
    if (colMatch) {
      const alias = colMatch[1].toLowerCase()
      const col = colMatch[2]
      const table = aliasToTable(alias)
      if (!byTable.has(table)) byTable.set(table, [])
      byTable.get(table)!.push(col)
    }
  }

  const parts: string[] = []
  const profilesCols = byTable.get('profiles')
  if (profilesCols?.length) parts.push(profilesCols.join(', '))
  for (const [table, cols] of byTable) {
    if (table === 'profiles') continue
    parts.push(`${table}(${cols.join(', ')})`)
  }
  return parts.length > 0 ? parts.join(', ') : '*'
}

/** Escape single quotes for use inside single-quoted JS string. */
function escapeForJs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

/** Parse WHERE and return Supabase filter calls (array of strings like ".ilike('profile_locations.city', '%pune%')"). */
function extractFilters(sql: string): string[] {
  const filters: string[] = []
  const whereMatch = sql.match(/\bWHERE\s+([\s\S]+?)(?:\s+LIMIT\s|\s*$)/i)
  if (!whereMatch?.[1]) return filters

  const whereClause = whereMatch[1].trim()
  // Split by AND, respecting parentheses
  const andParts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < whereClause.length; i++) {
    const c = whereClause[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (depth === 0 && /\bAND\b/i.test(whereClause.slice(i))) {
      andParts.push(whereClause.slice(start, i).trim())
      start = i + 3
      i += 2
    }
  }
  if (start < whereClause.length) andParts.push(whereClause.slice(start).trim())

  for (const part of andParts) {
    const expr = part.replace(/^\(|\)$/g, '').trim()
    // LOWER(x.y) LIKE LOWER('%val%') or x.y ILIKE '%val%'
    const likeMatch = expr.match(/(?:LOWER\s*\(\s*(\w+)\.(\w+)\s*\)\s+LIKE\s+LOWER\s*\(\s*'([^']*)'\s*\)|(\w+)\.(\w+)\s+ILIKE\s+'([^']*)')/i)
    if (likeMatch) {
      const alias = (likeMatch[1] ?? likeMatch[4]).toLowerCase()
      const col = likeMatch[2] ?? likeMatch[5]
      const val = (likeMatch[3] ?? likeMatch[6] ?? '').replace(/%/g, '')
      const table = aliasToTable(alias)
      const key = table === 'profiles' ? col : `${table}.${col}`
      filters.push(`.ilike('${key}', '%${val.replace(/'/g, "\\'")}%')`)
      continue
    }
    // x.y = 'val' or LOWER(x.y) = LOWER('val')
    const eqMatch = expr.match(/(?:LOWER\s*\(\s*(\w+)\.(\w+)\s*\)\s*=\s*LOWER\s*\(\s*'([^']*)'\s*\)|(\w+)\.(\w+)\s*=\s*'([^']*)'|(\w+)\.(\w+)\s+ILIKE\s+'([^']*)')/i)
    if (eqMatch) {
      const alias = (eqMatch[1] ?? eqMatch[4] ?? eqMatch[7]).toLowerCase()
      const col = eqMatch[2] ?? eqMatch[5] ?? eqMatch[8]
      const val = (eqMatch[3] ?? eqMatch[6] ?? eqMatch[9] ?? '').replace(/''/g, "'")
      const table = aliasToTable(alias)
      const key = table === 'profiles' ? col : `${table}.${col}`
      filters.push(`.eq('${key}', '${val.replace(/'/g, "\\'")}')`)
      continue
    }
    // c.annual_income >= 1000000
    const gteMatch = expr.match(/(\w+)\.(\w+)\s*>=\s*(\d+)/)
    if (gteMatch) {
      const table = aliasToTable(gteMatch[1].toLowerCase())
      const key = table === 'profiles' ? gteMatch[2] : `${table}.${gteMatch[2]}`
      filters.push(`.gte('${key}', ${gteMatch[3]})`)
      continue
    }
    // EXTRACT(YEAR FROM AGE(...)) BETWEEN 25 AND 30 → age filter: Supabase might use .gte/.lte on date_of_birth or RPC
    const ageMatch = expr.match(/BETWEEN\s+(\d+)\s+AND\s+(\d+)/i)
    if (ageMatch && /date_of_birth|AGE/i.test(expr)) {
      filters.push(`// Age filter: .gte('date_of_birth', ...) and .lte('date_of_birth', ...) or use RPC for computed age`)
      continue
    }
    // OR condition (e.g. first_name OR last_name): leave as comment
    if (/\bOR\b/i.test(expr)) {
      filters.push(`// OR condition: ${expr.slice(0, 60)}...`)
    }
  }
  return filters
}

function extractLimit(sql: string): number {
  const m = sql.match(/\bLIMIT\s+(\d+)/i)
  return m ? parseInt(m[1], 10) : 50
}

/**
 * Convert generated SQL to Supabase JavaScript client code.
 */
export function sqlToSupabaseQuery(sql: string): string {
  if (!sql || !/^\s*SELECT\s+/i.test(sql)) {
    return '// Only SELECT queries can be converted.'
  }

  const selectStr = buildSelectClause(sql)
  const filters = extractFilters(sql)
  const limit = extractLimit(sql)

  const selectEscaped = escapeForJs(selectStr)
  const lines: string[] = [
    "const { data, error } = await supabase",
    "  .from('profiles')",
    `  .select('${selectEscaped}')`,
  ]
  for (const f of filters) {
    lines.push(f.startsWith('//') ? `  ${f}` : `  ${f}`)
  }
  lines.push(`  .limit(${limit})`)

  return lines.join('\n')
}
