/**
 * Validates and auto-fixes generated SQL to reduce execution errors and hallucination.
 * Runs after SQL generation and before (or in place of) first execution when possible.
 */

import type { ExtractedIntent } from './planner.service.js';

export interface ValidationResult {
  valid: boolean;
  sql: string;
  error?: string;
  fixed?: boolean;
}

/**
 * Validate and auto-fix common SQL issues:
 * - Base table must be FROM profiles p
 * - Replace literal %value% or 'value' with actual intent values
 * - Remove extra closing parenthesis before LIMIT
 * - Ensure no semicolon before LIMIT
 */
export function validateAndFixSql(
  sql: string,
  extractedIntent: ExtractedIntent[] = []
): ValidationResult {
  let s = sql.trim();
  const fixes: string[] = [];

  // 1) Ensure FROM profiles p (fix missing p: FROM career_details c → FROM profiles p + JOINs)
  if (/\bFROM\s+career_details\s+c\b/i.test(s) && !/\bFROM\s+profiles\s+p\b/i.test(s)) {
    s = s.replace(/\bFROM\s+career_details\s+c\b/i, 'FROM profiles p\nLEFT JOIN career_details c ON p.profile_id = c.profile_id');
    fixes.push('base table set to profiles p');
  }
  if (/\bFROM\s+profile_locations\s+pl\b/i.test(s) && !/\bFROM\s+profiles\s+p\b/i.test(s)) {
    s = s.replace(/\bFROM\s+profile_locations\s+pl\b/i, 'FROM profiles p\nLEFT JOIN profile_locations pl ON p.profile_id = pl.profile_id');
    fixes.push('base table set to profiles p');
  }
  if (/\bFROM\s+profiles\b/i.test(s) && !/\bFROM\s+profiles\s+\w+\s*\n/i.test(s) && !/\bFROM\s+profiles\s+p\b/i.test(s)) {
    s = s.replace(/\bFROM\s+profiles\s*(\n|LEFT|JOIN|$)/i, (m) => {
      if (/\bFROM\s+profiles\s+p\b/i.test(s)) return m;
      return m.replace(/FROM\s+profiles\s*/i, 'FROM profiles p ');
    });
  }

  // 2) Substitute intent values: placeholders and wrong literals (use exact intent value everywhere)
  const values = extractedIntent.map((i) => i.value.replace(/'/g, "''"));
  const byAttr: Record<string, string> = {};
  extractedIntent.forEach((i) => { byAttr[i.attribute.toLowerCase()] = i.value.replace(/'/g, "''"); });
  if (byAttr.city) {
    const prev = s;
    s = s.replace(/(pl\.city|pl\.state)\s+LIKE\s+LOWER\s*\(\s*'%[^%']+%'\s*\)/gi, (m, col) => `${col} LIKE LOWER('%${byAttr.city}%')`);
    if (s !== prev) fixes.push('aligned city with intent');
  }
  if (byAttr.profession) {
    const prev = s;
    const pro = byAttr.profession;
    s = s.replace(/c\.profession\s+LIKE\s+LOWER\s*\(\s*'%[^%']+%'\s*\)/gi, () => `c.profession LIKE LOWER('%${pro}%')`);
    s = s.replace(/LOWER\s*\(\s*c\.profession\s*\)\s+LIKE\s+LOWER\s*\(\s*'%[^%']+%'\s*\)/gi, () => `LOWER(c.profession) LIKE LOWER('%${pro}%')`);
    if (s !== prev) fixes.push('aligned profession with intent');
  }
  if (values.length > 0 && (s.includes('%value%') || s.includes("'value'"))) {
    let idx = 0;
    s = s.replace(/'%value%'/gi, () => {
      const v = values[idx % values.length];
      idx++;
      return `'%${v}%'`;
    });
    idx = 0;
    s = s.replace(/%value%/gi, () => {
      const v = values[idx % values.length];
      idx++;
      return `%${v}%`;
    });
    s = s.replace(/'value'/g, () => {
      const v = values[idx % values.length];
      idx++;
      return `'${v}'`;
    });
    fixes.push('substituted intent values for placeholders');
  }

  // 3) Remove extra closing parenthesis immediately before LIMIT (e.g. ) ) LIMIT → ) LIMIT or AND x ) LIMIT → AND x LIMIT)
  const limitMatch = s.match(/\bLIMIT\s+\d+\s*;?\s*$/i);
  if (limitMatch) {
    const beforeLimit = s.slice(0, s.length - limitMatch[0].length);
    const trimmed = beforeLimit.trimEnd();
    // Strip one extra ) right before LIMIT if present (pattern: ... AND cond ) LIMIT)
    if (/\)\s*\)\s*$/.test(trimmed)) {
      s = trimmed.replace(/\)\s*\)\s*$/, ') ') + limitMatch[0];
      fixes.push('removed extra parenthesis before LIMIT');
    } else if (/\b(AND|OR)\s+[^)]+\)\s*\)\s*$/.test(trimmed)) {
      s = trimmed.replace(/\)\s*\)\s*$/, ') ') + limitMatch[0];
      fixes.push('removed extra parenthesis before LIMIT');
    }
  }

  // 4) Remove semicolon before LIMIT
  if (/\;\s*LIMIT\s+\d+/i.test(s)) {
    s = s.replace(/\;\s*(LIMIT\s+\d+)/i, ' $1');
    fixes.push('removed semicolon before LIMIT');
  }

  // 5) Validate: must contain FROM profiles
  if (!/\bFROM\s+profiles\b/i.test(s)) {
    return { valid: false, sql: s, error: 'Query must start from FROM profiles p.', fixed: fixes.length > 0 };
  }

  // 6) Check for remaining placeholder
  if (/%value%|'value'/.test(s) && extractedIntent.length > 0) {
    return { valid: false, sql: s, error: "SQL still contains literal '%value%' or 'value'; replace with actual intent values.", fixed: fixes.length > 0 };
  }

  // 7) Intent-based validation and auto-fix: name must appear in WHERE (use actual value from intent)
  const attrs = new Set(extractedIntent.map((i) => i.attribute.toLowerCase()));
  const nameIntent = extractedIntent.find((i) => i.attribute.toLowerCase() === 'first_name' || i.attribute.toLowerCase() === 'last_name');
  const nameValue = nameIntent?.value?.replace(/'/g, "''");
  if (attrs.has('first_name') || attrs.has('last_name')) {
    const hasNameInWhere = /\bWHERE\b/i.test(s) && (/\bp\.first_name\b/i.test(s) || /\bp\.last_name\b/i.test(s));
    if (!hasNameInWhere && nameValue) {
      // Auto-fix: inject name filter so SQL is correct without relying on corrector
      const nameCond = `(LOWER(p.first_name) = LOWER('${nameValue}') OR LOWER(p.last_name) = LOWER('${nameValue}'))`;
      if (/\bWHERE\b/i.test(s)) {
        s = s.replace(/\bWHERE\b/i, `WHERE ${nameCond} AND (`).replace(/\s+LIMIT\s+(\d+)\s*$/i, (m) => `) ${m}`);
      } else {
        s = s.replace(/\s+LIMIT\s+(\d+)\s*$/i, ` WHERE ${nameCond} $&`);
      }
      fixes.push('injected name filter from intent');
    } else if (!hasNameInWhere) {
      return { valid: false, sql: s, error: "Intent has first_name or last_name but SQL WHERE does not filter by p.first_name or p.last_name. Add WHERE (LOWER(p.first_name) = LOWER('<value>') OR LOWER(p.last_name) = LOWER('<value>')) using the exact value from the intent list.", fixed: fixes.length > 0 };
    }
  }
  if (attrs.has('age')) {
    const hasAgeInWhere = /\bWHERE\b/i.test(s) && (/\bdate_of_birth\b/i.test(s) || /\bAGE\s*\(/i.test(s) || /\bEXTRACT\s*\(\s*YEAR/i.test(s));
    const ageIntent = extractedIntent.find((i) => i.attribute.toLowerCase() === 'age');
    const ageRange = ageIntent?.value?.match(/(\d+)\s*[-–]\s*(\d+)/);
    if (!hasAgeInWhere && ageRange) {
      const [_, min, max] = ageRange;
      const ageCond = `(EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) BETWEEN ${min} AND ${max})`;
      if (/\bWHERE\b/i.test(s)) {
        s = s.replace(/\bWHERE\b/i, `WHERE ${ageCond} AND (`).replace(/\s+LIMIT\s+(\d+)\s*$/i, (m) => `) ${m}`);
      } else {
        s = s.replace(/\s+LIMIT\s+(\d+)\s*$/i, ` WHERE ${ageCond} $&`);
      }
      fixes.push('injected age filter from intent');
    } else if (!hasAgeInWhere) {
      return { valid: false, sql: s, error: "Intent has age but SQL WHERE does not filter by date_of_birth/age. Use (EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) BETWEEN min AND max) with the numbers from the intent.", fixed: fixes.length > 0 };
    }
  }

  // 8) If SQL uses uh. or f., the corresponding JOIN must exist
  if (/\buh\./i.test(s) && !/\bJOIN\s+user_horoscopes\s+uh\b/i.test(s)) {
    return { valid: false, sql: s, error: "SQL uses uh. (e.g. uh.place_of_birth) but has no JOIN user_horoscopes uh. Add LEFT JOIN user_horoscopes uh ON p.profile_id = uh.profile_id.", fixed: fixes.length > 0 };
  }
  if (/\bf\./i.test(s) && !/\bJOIN\s+family_origin\s+f\b/i.test(s)) {
    return { valid: false, sql: s, error: "SQL uses f. (e.g. f.native_place) but has no JOIN family_origin f. Add LEFT JOIN family_origin f ON p.profile_id = f.profile_id.", fixed: fixes.length > 0 };
  }

  return {
    valid: true,
    sql: s,
    ...(fixes.length > 0 && { fixed: true }),
  };
}
