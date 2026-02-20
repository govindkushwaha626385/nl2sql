import { generateText, type TokenUsage } from './ai.service.js';

/** Extracted intent item: attribute (e.g. gender, profession) and value (e.g. male, doctor). */
export interface ExtractedIntent {
  attribute: string;
  value: string;
}

/** Extract structured intents from a natural language question for display and validation. */
export async function extractIntentFromQuestion(question: string): Promise<{ intents: ExtractedIntent[]; usage?: TokenUsage }> {
  const prompt = `
You extract search criteria from a user's natural-language question. Output a JSON array of objects, each with keys "attribute" (string, lowercase) and "value" (string). Include only criteria the user explicitly stated; do not infer, assume, or add values (e.g. do not add "not specified", "any", or default filters).

ATTRIBUTE DEFINITIONS (use the attribute name when the user's question implies that criterion):

Identity and name: first_name — when the user asks for a person by first name (e.g. "show me Neha's profile", "profile of Ananya", "X's profile"). last_name — when the user clearly gives a surname/family name (e.g. "show me Prashant" as surname, or "last name Sharma"). For "show me [Name]'s profile" or "profile of [Name]", use first_name: [Name] so the name is searched in first_name (and optionally last_name in SQL). Do not use last_name for a single given name like Ananya or Neha unless the user explicitly said it is a surname.

Demographics: gender — when the user mentions male, female, men, women. marital_status — when they mention marital state (e.g. never married, divorced, single, widowed). age — when they mention age or age range (e.g. "between 25 and 30" → value "25-30"; "above 40" → "40+").

Location: city — current residence city. state — current residence state. country — current residence country. native_place — when the user says "originally from", "from", "hails from", "native of" a place (the place is value). work_country — when they say "working in", "based in", "employed in" a country or region (the place is value).

Language and background: mother_tongue — when the user mentions mother tongue, first language, or "speak X" / "who speak X" (e.g. "speak hindi", "speak Marathi"); put the language name in value (e.g. hindi, Marathi). religion — when they mention religion (e.g. Hindu, Islam, Christianity); put the religion name in value. caste — when they mention caste, community, or sub-caste (e.g. Brahmin, Rajput); put the exact term in value.

Career and education: profession — when they mention job, occupation, or profession (use the exact phrase, e.g. software engineer, chartered accountant, doctor). degree_type — when they mention degree, qualification, or education level (e.g. MBA, MBBS, MD, Masters, UG, PG); put the exact degree(s) in value. income — when they mention salary, income, or LPA; put the number and unit (e.g. "15 LPA") in value.

Lifestyle: diet — when they mention diet (e.g. vegetarian, vegan, non-veg). smoking — when they mention smoking (e.g. no, yes, non-smoker). drinking — when they mention drinking (e.g. no, yes).

Physical: height — when they mention height (value can be a number with unit or range). weight — when they mention weight.

Other: manglik — only when they explicitly mention manglik or non-manglik. verified — only when they mention verified or verification. registered_since — when they mention joined, registered, or signup and a time. subscription_plan — when they mention plan type (e.g. premium, gold, platinum). most_viewed — only when they explicitly mention most viewed, top viewed, or view count.

CRITICAL — DO NOT INFER: Output only attributes that the user explicitly stated. Do not add manglik, most_viewed, diet, smoking, drinking, gender, profession, city, religion, caste, or any other attribute if the user did not mention it. Use simple attribute names: "city" not "location.city", "income" not "income.value". Do not extract place or name from typos or phrase words: e.g. "show me X's profile" or "shoe me X's profile" (typo for "show") → extract only first_name or last_name from X, not native_place from "shoe".

EXAMPLES: "show me Neha's profile" or "profile of Ananya" → first_name: Neha / first_name: Ananya. "List all profiles between 25 and 30" → age: 25-30. "Hindu Brahmin who speak hindi" → religion, caste, mother_tongue. "lawyers in Pune" → profession: lawyer, city: Pune. "Find Lawyers originally from Mumbai" → profession, native_place. Never return [] when the user clearly states a name, age, religion, profession, city, or income—always extract those.

RULES: One object per criterion. Use the exact words or numbers the user gave for "value". If nothing is clearly a search criterion, output [].

User question: "${question}"

Output only a valid JSON array of objects with "attribute" and "value" keys. No markdown, no explanation. If no criteria, output [].
`.trim();

  const { text, usage } = await generateText(prompt);
  const cleaned = text.replace(/^```\w*\n?|```\s*$/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(parsed)) return { intents: fallbackExtractIntent(question), ...(usage && { usage }) };
    const result = parsed.filter(
      (x): x is ExtractedIntent =>
        typeof x === 'object' && x !== null && 'attribute' in x && 'value' in x && typeof (x as ExtractedIntent).attribute === 'string' && typeof (x as ExtractedIntent).value === 'string'
    );
    const intents = result.length > 0 ? result : fallbackExtractIntent(question);
    return { intents, ...(usage && { usage }) };
  } catch {
    return { intents: fallbackExtractIntent(question), ...(usage && { usage }) };
  }
}

/** Rule-based fallback when LLM returns [] or invalid JSON, so we still extract obvious criteria. */
function fallbackExtractIntent(question: string): ExtractedIntent[] {
  const q = question.trim();
  const lower = q.toLowerCase();
  const intents: ExtractedIntent[] = [];

  // Profession: "software engineers", "chartered accountants", "doctors", "engineers in", etc.
  const professionMatch = lower.match(/\b(software\s+engineers?|chartered\s+accountants?|doctors?|engineers?|lawyers?|teachers?|accountants?)\b/i);
  if (professionMatch?.[1]) intents.push({ attribute: 'profession', value: professionMatch[1].trim() });

  // Native place: "originally from Mumbai", "hails from X", "native of X" → native_place (not city)
  const nativeMatch = lower.match(/\b(?:originally\s+from|hails?\s+from|native\s+of)\s+([a-z][a-z\s]{0,40}?)(?:\s*\.|$)/i) || q.match(/(?:originally\s+from|hails?\s+from|native\s+of)\s+([A-Za-z][A-Za-z\s]{0,40}?)(?:\s*\.|$)/i);
  if (nativeMatch?.[1]) intents.push({ attribute: 'native_place', value: nativeMatch[1].trim() });

  // City: "in Bangalore", "lives in Mumbai", "from Mumbai" (when not "originally from") — avoid duplicating with native_place
  if (!intents.some((i) => i.attribute === 'native_place')) {
    const cityMatch = q.match(/\b(?:in|from|at|lives?\s+in)\s+([A-Za-z][A-Za-z\s]{1,40}?)(?:\s+earning|\s+who|\s+speak|\.|$)/i) || q.match(/\b(?:in|from)\s+([A-Za-z]+)\b/i);
    if (cityMatch?.[1]) intents.push({ attribute: 'city', value: cityMatch[1].trim() });
  }

  // Income: "earning more than 10 LPA", "10 LPA", "more than 15 LPA"
  const incomeMatch = lower.match(/(?:earning\s+)?(?:more than|above|over)\s*(\d+)\s*lpa/i) || lower.match(/\b(\d+)\s*lpa/i);
  if (incomeMatch?.[1]) intents.push({ attribute: 'income', value: `${incomeMatch[1]} LPA` });

  // Religion: Hindu, Islam, Christianity (often "Hindu Brahmin")
  const religionMatch = lower.match(/\b(hindu|islam|muslim|christianity|christian|sikh|jain|buddhist)\b/i);
  if (religionMatch?.[1]) intents.push({ attribute: 'religion', value: religionMatch[1].trim() });

  // Caste: Brahmin, Rajput, etc. (often after religion)
  const casteMatch = lower.match(/\b(brahmin|rajput|maratha|kayasta|bania|vaishya|kshatriya)\b/i);
  if (casteMatch?.[1]) intents.push({ attribute: 'caste', value: casteMatch[1].trim() });

  // Mother tongue: "speak hindi", "who speak Marathi", "speak english"
  const langMatch = lower.match(/(?:speak|who speak|mother tongue)\s+([a-z]+)/i) || q.match(/(?:speak|who speak)\s+([A-Za-z]+)/i);
  if (langMatch?.[1]) intents.push({ attribute: 'mother_tongue', value: langMatch[1].trim() });

  // First name from "X's profile" or "profile of X" (single name — treat as first_name)
  const profileNameMatch = q.match(/([A-Za-z][a-z]+)'s\s+profile/i) || q.match(/(?:show\s+me|profile\s+of)\s+([A-Za-z][a-z]+)\.?\s*$/i) || q.match(/(?:profile\s+of)\s+([A-Za-z][a-z]+)/i);
  if (profileNameMatch?.[1]) intents.push({ attribute: 'first_name', value: profileNameMatch[1].trim() });

  // Age range: "between 25 and 30", "ages 25-30", "25 to 30 years"
  const ageMatch = lower.match(/(?:between|ages?)\s+(\d+)\s+(?:and|to|-)\s+(\d+)/i) || lower.match(/(\d+)\s*-\s*(\d+)\s*(?:years?)?/);
  if (ageMatch?.[1] && ageMatch?.[2]) intents.push({ attribute: 'age', value: `${ageMatch[1]}-${ageMatch[2]}` });

  return intents;
}

/** Map extracted intent attribute to table.column and SQL pattern. Used to force WHERE from intent. */
const INTENT_TO_SQL: Record<string, string> = {
  first_name: "LOWER(p.first_name) = LOWER('<value>') OR LOWER(p.last_name) = LOWER('<value>')",
  last_name: "LOWER(p.last_name) LIKE LOWER('%<value>%')",
  gender: "LOWER(p.gender) = LOWER('<value>') or p.gender ILIKE '%<value>%'",
  marital_status: "LOWER(p.marital_status) = LOWER('<value>') or p.marital_status ILIKE '%<value>%'",
  profession: "LOWER(c.profession) LIKE LOWER('%<value>%') — career_details c only, never master_castes",
  city: "LOWER(pl.city) LIKE LOWER('%<value>%') or pl.state ILIKE '%<value>%' — profile_locations pl",
  state: "LOWER(pl.state) LIKE LOWER('%<value>%')",
  country: "LOWER(pl.country) LIKE LOWER('%<value>%') — profile_locations pl",
  work_country: "LOWER(c.work_location) LIKE LOWER('%<value>%') or LOWER(pl.country) LIKE LOWER('%<value>%')",
  mother_tongue: "LOWER(p.mother_tongue) LIKE LOWER('%<value>%') — profiles only",
  religion: "LOWER(sb.religion) LIKE LOWER('%<value>%') — social_background sb",
  caste: "LOWER(sb.caste) LIKE LOWER('%<value>%') or sb.sub_caste ILIKE '%<value>%'",
  diet: "LOWER(lh.diet) LIKE LOWER('%<value>%') — lifestyle_habits lh, join ON p.profile_id = lh.profile_id",
  smoking: "LOWER(lh.smoking) = LOWER('<value>')",
  drinking: "LOWER(lh.drinking) = LOWER('<value>')",
  degree_type: "LOWER(ed.degree_type) LIKE LOWER('%<value>%') or ed.specialization ILIKE '%<value>%'",
  income: "c.annual_income >= <number> (e.g. 15 LPA = 1500000)",
  age: "EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) BETWEEN <min> AND <max>",
  height: "p.height_cm >= <value> or BETWEEN",
  weight: "p.weight_kg <= <value> or BETWEEN",
  subscription_plan: "LOWER(us.plan_name) LIKE LOWER('%<value>%') — join users u, user_subscriptions us",
  native_place: "LOWER(f.native_place) LIKE LOWER('%<value>%') OR LOWER(uh.place_of_birth) LIKE LOWER('%<value>%') — family_origin f or user_horoscopes uh",
};

/** Normalize intent attribute names so INTENT_TO_SQL and JOIN rules match (e.g. location.city → city). */
function normalizeIntentAttribute(attr: string): string {
  const lower = attr.toLowerCase().trim();
  if (lower === "location.city" || lower === "location" || lower === "city") return "city";
  if (lower === "income.value" || lower === "income") return "income";
  return lower.replace(/^location\./i, "").trim() || attr;
}

/** SQL fragment only (before " — " or " (e.g."). */
function getSqlPattern(attr: string): string {
  const raw = INTENT_TO_SQL[attr] ?? "";
  return (raw.split(/\s+—\s+|\s+\(e\.g\./)[0] ?? "").trim();
}

/** Which tables are required for this attribute (alias name). */
const INTENT_TABLES: Record<string, string[]> = {
  first_name: [], last_name: [], gender: [], marital_status: [], mother_tongue: [], age: [], height: [], weight: [],
  profession: ["c"], income: ["c"], degree_type: ["ed"], work_country: ["c", "pl"],
  city: ["pl"], state: ["pl"], country: ["pl"],
  religion: ["sb"], caste: ["sb"],
  diet: ["lh"], smoking: ["lh"], drinking: ["lh"],
  native_place: ["f", "uh"], subscription_plan: ["u", "us"],
};

/** Build SELECT columns for intent (minimal: only tables we join). */
function selectColumnsForIntent(intentAttrs: Set<string>, joins: Set<string>): string[] {
  const cols = ["p.profile_id", "p.first_name", "p.last_name"];
  if (joins.has("pl") || intentAttrs.has("city") || intentAttrs.has("state") || intentAttrs.has("country")) cols.push("pl.city", "pl.state");
  if (joins.has("c")) { if (intentAttrs.has("profession")) cols.push("c.profession"); if (intentAttrs.has("income")) cols.push("c.annual_income"); }
  if (joins.has("sb")) { cols.push("sb.religion", "sb.caste"); }
  if (joins.has("lh")) cols.push("lh.diet", "lh.smoking", "lh.drinking");
  if (intentAttrs.has("mother_tongue")) cols.push("p.mother_tongue");
  if (intentAttrs.has("gender")) cols.push("p.gender");
  if (intentAttrs.has("marital_status")) cols.push("p.marital_status");
  if (joins.has("f")) cols.push("f.native_place");
  if (joins.has("uh")) cols.push("uh.place_of_birth");
  if (joins.has("ed")) cols.push("ed.degree_type");
  return cols;
}

/**
 * Build a correct SQL query deterministically from extracted intent.
 * Uses only tables and columns required by the intent; WHERE has one condition per intent.
 */
export function buildSqlFromIntent(extractedIntent: ExtractedIntent[]): string {
  const normalized = extractedIntent.map((i) => ({ ...i, attribute: normalizeIntentAttribute(i.attribute) }));
  if (normalized.length === 0) return "";

  const intentAttrs = new Set(normalized.map((i) => i.attribute));
  const joins = new Set<string>();
  for (const i of normalized) {
    const tables = INTENT_TABLES[i.attribute] ?? [];
    tables.forEach((t) => joins.add(t));
  }

  const selectCols = selectColumnsForIntent(intentAttrs, joins);
  const joinLines: string[] = [];
  if (joins.has("pl")) joinLines.push("LEFT JOIN profile_locations pl ON p.profile_id = pl.profile_id");
  if (joins.has("c")) joinLines.push("LEFT JOIN career_details c ON p.profile_id = c.profile_id");
  if (joins.has("sb")) joinLines.push("LEFT JOIN social_background sb ON p.profile_id = sb.profile_id");
  if (joins.has("lh")) joinLines.push("LEFT JOIN lifestyle_habits lh ON p.profile_id = lh.profile_id");
  if (joins.has("ed")) joinLines.push("LEFT JOIN education_details ed ON p.profile_id = ed.profile_id");
  if (joins.has("f")) joinLines.push("LEFT JOIN family_origin f ON p.profile_id = f.profile_id");
  if (joins.has("uh")) joinLines.push("LEFT JOIN user_horoscopes uh ON p.profile_id = uh.profile_id");

  const conditions: string[] = [];
  for (const i of normalized) {
    const attr = i.attribute;
    const val = i.value.replace(/'/g, "''");
    let expr = getSqlPattern(attr);
    if (!expr) continue;
    if (attr === "income") {
      const match = i.value.match(/(\d+)\s*LPA/i);
      const num = match ? parseInt(match[1] ?? "0", 10) * 100000 : 1000000;
      expr = `c.annual_income >= ${num}`;
    } else if (attr === "age") {
      const range = i.value.match(/(\d+)\s*[-–]\s*(\d+)/);
      const min = range?.[1] ?? "25";
      const max = range?.[2] ?? "30";
      expr = `(EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) BETWEEN ${min} AND ${max})`;
    } else {
      expr = expr.replace(/%<value>%/gi, `%${val}%`).replace(/<value>/gi, val).replace(/\s+or\s+/g, " OR ");
    }
    // Wrap in parentheses if condition contains OR so AND/OR precedence is correct
    conditions.push(expr.includes(" OR ") ? `(${expr})` : expr);
  }

  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const sql = `SELECT ${selectCols.join(", ")}\nFROM profiles p\n${joinLines.join("\n")}${whereClause}\nLIMIT 50`;
  return sql;
}

export async function generateMatrimonialSQL(question: string, schemaContext: string, extractedIntent: ExtractedIntent[] = []): Promise<{ sql: string; usage?: TokenUsage }> {
  const normalizedIntents = extractedIntent.map((i) => ({ ...i, attribute: normalizeIntentAttribute(i.attribute) }));

  // When we have extracted intent, build SQL deterministically so tables/columns are always correct
  if (normalizedIntents.length > 0) {
    return { sql: buildSqlFromIntent(extractedIntent) };
  }

  const intentBlock =
    normalizedIntents.length > 0
      ? `
EXTRACTED INTENT (MANDATORY — your query MUST include a WHERE clause with exactly these criteria; no query without WHERE when this list is non-empty):
${normalizedIntents.map((i) => `- ${i.attribute}: "${i.value}" → ${INTENT_TO_SQL[i.attribute] ?? `map to correct column for ${i.attribute}`}`).join("\n")}

GENERAL RULE — USE EXACT INTENT VALUES: For every attribute in the intent list above, use that attribute's exact value in the SQL. Never use a placeholder (e.g. 'name', 'value', '%value%') or a different value (e.g. if intent says city: pune use '%pune%' in SQL, not '%mumbai%'; if first_name: Neha use 'Neha', not 'name'). Each condition in WHERE must use the value from the list for that attribute.

USE ONLY THE INTENT LINES ABOVE IN WHERE. Do not add mother_tongue, caste, religion, profession, city, income, marital_status, place_of_birth, or date_of_birth range unless that attribute is in the list above.

When intent has first_name or last_name (person by name): WHERE must filter by that name using the exact value from the intent list: (LOWER(p.first_name) = LOWER('<value from list>') OR LOWER(p.last_name) = LOWER('<value from list>')). Join ONLY profiles p. Do not join career_details, profile_locations, social_background, lifestyle_habits, or user_horoscopes. SELECT p.profile_id, p.first_name, p.last_name only (no c., pl., sb., lh., uh. unless needed for display and in intent).

When intent has age (e.g. 25-30): WHERE must use (EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) BETWEEN 25 AND 30) with the numbers from the value. Join only profiles p. Do not add mother_tongue, place_of_birth, or any other filter.

When intent has native_place: you must JOIN family_origin f and/or user_horoscopes uh; use LOWER(f.native_place) LIKE LOWER('%value%') OR LOWER(uh.place_of_birth) LIKE LOWER('%value%') with the actual place value (e.g. Pune, Mumbai), never the literal 'native_place'. If you use uh. or f. in WHERE or SELECT, you must have the corresponding LEFT JOIN.

ZERO HALLUCINATION: Add ONLY the conditions in the EXTRACTED INTENT list above. Do NOT add income, mother_tongue, marital_status, diet, smoking, religion, caste, or city unless that exact attribute is in the list. One WHERE condition per intent line—no extra filters. Combine all WHERE conditions with AND only; never use OR to add unrelated criteria (e.g. never "mother_tongue LIKE '%hindi%' OR pl.city LIKE '%mumbai%' OR c.annual_income >= ..."—use only the intent criteria, each with AND).

MINIMAL TABLES AND COLUMNS: Join ONLY tables required for the intent. Do not join career_details (c) unless intent has profession or income. Do not join lifestyle_habits (lh) unless intent has diet, smoking, or drinking. Do not join social_background (sb) unless intent has religion or caste. Do not join education_details (ed) unless intent has degree_type. Do not join user_horoscopes (uh) or family_origin (f) unless intent has native_place, place_of_birth, or manglik. In SELECT, list only columns from tables you joined and that are needed for the answer: e.g. intent city only → SELECT p.profile_id, p.first_name, p.last_name, pl.city; do not add c.profession, lh.diet, lh.smoking, lh.drinking unless those are in the intent.

CRITICAL — FILTERS IN WHERE ONLY: Put every filter in the WHERE clause. SELECT must list only column names (e.g. p.first_name, p.last_name, c.profession, pl.city). NEVER put filter logic or boolean expressions in SELECT (invalid: COALESCE(c.annual_income,0) > 1000000 AS "more_than_10_lpa" or c.profession AS "Software Engineer"; valid: WHERE c.annual_income >= 1000000 AND LOWER(c.profession) LIKE LOWER('%software%') AND ...). Use the actual intent value in SQL (e.g. Mumbai not %value%); never leave literal "%value%" or "value" in the query.

REQUIRED: (1) Include a WHERE clause with one condition per line above. native_place (e.g. "originally from Mumbai") → use LOWER(f.native_place) LIKE LOWER('%mumbai%') OR LOWER(uh.place_of_birth) LIKE LOWER('%mumbai%') and JOIN family_origin f and/or user_horoscopes uh; do NOT use pl.city for "originally from". (2) Map each intent to the correct table: profession/income → career_details (c), never c for caste; religion/caste → social_background (sb) with JOIN ON p.profile_id = sb.profile_id only; city → profile_locations (pl); mother_tongue → p.mother_tongue (no extra join). Do not add any condition not in this list. (3) Required JOINs: if intent has city/state/country → LEFT JOIN profile_locations pl ON p.profile_id = pl.profile_id. If intent has profession or income → LEFT JOIN career_details c ON p.profile_id = c.profile_id. If intent has religion or caste → LEFT JOIN social_background sb ON p.profile_id = sb.profile_id. If intent has mother_tongue → use p.mother_tongue (no extra join). If intent has native_place → LEFT JOIN family_origin f ON p.profile_id = f.profile_id (or user_horoscopes uh). If intent has degree_type → LEFT JOIN education_details ed ON p.profile_id = ed.profile_id. If intent has diet/smoking/drinking → LEFT JOIN lifestyle_habits lh ON p.profile_id = lh.profile_id (lifestyle_habits has profile_id, not id). Do NOT join lifestyle_habits if intent has only profession, city, income, religion, caste, mother_tongue. (4) Income in LPA: 10 LPA = 1000000, 15 LPA = 1500000; use c.annual_income >= number (numeric, never a string like '1000000'). (5) Column usage: sb.religion is ONLY for religion (e.g. Hindu). Marital status ("never married") is in p.marital_status only—never use sb.religion for marital status. (6) End with ) LIMIT 50 with no semicolon before LIMIT. (7) mother_tongue is in profiles (p), not profile_languages; profile_locations pl has city—use pl only for city/state/country; if you need pl you must JOIN profile_locations pl.
`
      : `

NO EXTRACTED INTENT — FILTER ONLY BY WHAT THE USER SAID (critical):
- Read the user question and add WHERE conditions ONLY for criteria that appear in it. Combine conditions with AND only; never use OR to add unrelated criteria (e.g. do not add "mother_tongue LIKE '%hindi%' OR city LIKE '%mumbai%'" when the user only said "in Mumbai").
- Join only tables needed: city → profiles + profile_locations; profession → profiles + career_details; etc. Do not join lifestyle_habits, social_background, education_details, or user_horoscopes unless the user asked for diet/smoking, religion/caste, degree, or native_place/manglik. SELECT only columns from those tables (e.g. for "list in Mumbai" → SELECT p.profile_id, p.first_name, p.last_name, pl.city only).
- FORBIDDEN: Do not add profession, religion, marital_status, mother_tongue, diet, smoking, or city unless the user said it. "Never married" → p.marital_status only.
- pl = profile_locations for city. Income: numeric. All filters in WHERE only.
`;

  const prompt = `
You are an expert SQL analyst for a matrimonial profile database. Produce exactly one valid PostgreSQL SELECT that answers the user's question. Use only tables and columns present in CONTEXT.
${intentBlock}

CONTEXT (Relevant Tables and Columns; use only these):
${schemaContext}

SCHEMA — CORRECT TABLE AND COLUMN USAGE (never invent columns):
- profiles (p): profile_id, first_name, last_name, gender, mother_tongue, marital_status, height_cm, weight_kg, date_of_birth. NO id, NO religion, NO place_of_birth, NO created_at, NO is_verified.
- career_details (c): profile_id, profession, annual_income, work_location. Join ON p.profile_id = c.profile_id. Caste and religion are NOT here—use social_background.
- profile_locations (pl): profile_id, city, state, country. Join ON p.profile_id = pl.profile_id. Use pl only for city/state/country.
- social_background (sb): profile_id, religion, caste, sub_caste. Join ON p.profile_id = sb.profile_id. Use sb.religion for religion, sb.caste for caste. NEVER join sb with ON p.gender = ... or ON p.mother_tongue = ...; always ON p.profile_id = sb.profile_id.
- lifestyle_habits (lh): profile_id, diet, smoking, drinking. There is NO column named "lifestyle_habits". Join ON p.profile_id = lh.profile_id. Only join lh when intent has diet/smoking/drinking; do not join for profession/city/income/religion/caste/mother_tongue.
- user_horoscopes (uh): profile_id, place_of_birth, manglik_status. place_of_birth is ONLY in this table; profiles has NO place_of_birth. Join ON p.profile_id = uh.profile_id only—never ON p.place_of_birth = uh.place_of_birth. Only join uh when intent has native_place/place_of_birth/manglik.
- education_details (ed): profile_id, degree_type, specialization. Join ON p.profile_id = ed.profile_id. Only when intent has degree_type.

JOIN RULE — CRITICAL: Every JOIN must be exactly ON p.profile_id = <alias>.profile_id (integer = integer). Never put filter conditions in the ON clause (e.g. never ON p.gender = 'male' OR p.gender = 'female', never ON LOWER(p.mother_tongue) LIKE '%hindi%', never ON p.place_of_birth = uh.place_of_birth). Only join tables required by the intent: profession/income → c; city → pl; religion/caste → sb; mother_tongue → no extra join; diet/smoking/drinking → lh; native_place/manglik → f or uh; degree_type → ed.

USER QUESTION: "${question}"

CASE INSENSITIVITY AND NUMERIC COLUMNS
- Text (VARCHAR/TEXT): Always use LOWER(column) = LOWER('value') or column ILIKE '%value%' so comparisons are case-insensitive. Never use column = 'Value' alone.
- Numeric columns: NEVER use LOWER() on numeric columns. profiles: height_cm, weight_kg, date_of_birth. career_details: annual_income. partner_preferences: min_age, max_age, min_height, max_height. Use >=, <=, =, or BETWEEN for numbers (e.g. c.annual_income >= 1000000, p.height_cm >= 168).

INTENT EXTRACTION — USE EXACT USER VALUES
- List only intents and values the user actually said. Map to table.column from CONTEXT. Use the EXACT word or phrase the user used in the filter (e.g. if user said "doctors" use '%doctor%'; if "engineer" use '%engineer%'; if "Pune" use '%pune%'). Never substitute a different value (e.g. do not use "engineer" when the user said "doctors").
- first name / last name / person by name → profiles (p). gender / male / female → p.gender. height / weight / age / marital status / mother tongue → profiles (p): height_cm, weight_kg, date_of_birth, marital_status, mother_tongue.
- Mother tongue: Use profiles.mother_tongue (p.mother_tongue) only. Example: "hindi or english" → (LOWER(p.mother_tongue) LIKE LOWER('%hindi%') OR LOWER(p.mother_tongue) LIKE LOWER('%english%')). Do NOT use profile_languages for "mother tongue"; profile_languages is for additional languages spoken; the column there is language_name (not lang_name).
- profession / job (use exact user word: doctor, engineer, lawyer) → career_details.profession (c). salary / income / LPA → c.annual_income (numeric). city / location → profile_locations (pl). religion / caste → social_background (sb). degree / education → education_details (ed).
- Diet / vegetarian / vegan / smoking / drinking → lifestyle_habits (lh) ONLY: lh.diet, lh.smoking, lh.drinking. career_details (c) has NO diet or smoking column. Join LEFT JOIN lifestyle_habits lh ON p.profile_id = lh.profile_id. Put ALL filter conditions in WHERE only; never put boolean expressions in SELECT.
- Marital status (never married, divorced, single, widowed) → profiles.marital_status (p) ONLY. social_background has religion and caste only; never use sb.religion for "never married". Use LOWER(p.marital_status) = LOWER('never married') or ILIKE.
- "Registered / joined in last X days" → users table has created_at; profiles does NOT. Join users u ON p.user_id = u.user_id and WHERE u.created_at > NOW() - INTERVAL 'X days'.
- "Verified profiles" → profile_contacts.is_mobile_verified = true (join profile_contacts pc ON p.profile_id = pc.profile_id) or users.is_verified = true. profiles has NO is_verified column.
- place_of_birth / born in → only in user_horoscopes (uh). Join LEFT JOIN user_horoscopes uh ON p.profile_id = uh.profile_id. profiles has NO place_of_birth column; never use p.place_of_birth.
- Alias pl = profile_locations only (city, state, country). If you need profile_languages use alias plang (columns: language_name, proficiency_level). profile_languages has NO city column—so "pl.city" only when pl is profile_locations.
- Add exactly one WHERE condition per criterion the user mentioned. Do not add any other filters.

CRITICAL — GENERAL LOGIC: NO HARDCODED OR DEFAULT FILTERS
- Add ONLY filters that correspond to something the user explicitly said in their question. Do not add any filter (gender, marital_status, profession, city, religion, diet, smoking, drinking, mother_tongue, height, weight, first_name, last_name, subscription_plan, etc.) unless the user's question clearly mentions that criterion.
- Never use a specific person's name (e.g. first_name = 'Riya' or last_name = 'Kriti') unless the user's question actually contains that name. If the user asked "premium subscribers in Pune", do NOT add a filter on name; only subscription_plan and city.
- Do not add default or example filters (e.g. vegetarian, non-smoker, doctor, male, never married, Hindi) when the user did not ask for them. Every WHERE condition must be justified by the exact wording of the user question.
- Before outputting SQL: list each WHERE condition and the phrase in the user question that justifies it; if any condition has no matching phrase, remove it.

CONSISTENT ALIASES (avoid "missing FROM-clause entry" and syntax errors)
- Use exactly one alias per table and use it everywhere. If you write LEFT JOIN career_details c ON ... then use c.profession and c.annual_income everywhere—never cd or any other alias for career_details. If you write LEFT JOIN lifestyle_habits lh ON ... use lh.diet, lh.smoking (lowercase lh), not Ih or LH. Typos like Ih instead of lh cause "syntax error at or near ON".
- Only use standard PostgreSQL. Do not use LINEAR() or other non-standard functions. For text use LOWER(), TRIM(), or ILIKE. Check quotes: use '%delhi%' not '% delhi%)' (no space or stray parenthesis inside the string).

ATTRIBUTE VS PERSON NAME (critical — wrong mapping causes bad queries)
- Gender words ("female", "male", "women", "men") → always p.gender. Use LOWER(p.gender) = LOWER('female') or p.gender ILIKE '%female%'. Never use first_name or last_name for gender.
- Caste/community words ("Rajput", "Brahmin", etc.) → sb.caste or sb.sub_caste. Religion → sb.religion. The profiles table has no religion column.
- Person name: Only when the user asks for one specific person by name (e.g. "show me [Name]'s profile") use first_name/last_name with the name the user typed. Do not insert any name the user did not mention.

EXTRACT CRITERIA — ONLY WHAT USER SAID (no defaults)
- Person name: Only if the user asked for a specific person by name. WHERE (LOWER(p.first_name) = LOWER('exact_name_from_question') OR LOWER(p.last_name) = LOWER('exact_name_from_question')). Use only the name that appears in the user's question; do not add any name they did not say. Do not add other filters (gender, profession, city, etc.) unless the user said them.
- Age / "between X and Y years" / "ages 25-30": profiles has date_of_birth, not age. Use: (EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) BETWEEN 25 AND 30) with the numbers the user said. Do not use first_name/last_name LIKE '%' or profession for age-only queries.
- Place (city/state/country): Only if user said a place. LOWER(pl.city) LIKE LOWER('%user_city%') or pl.city ILIKE '%user_city%'. Use the city name the user said.
- Gender: Only if user said male/female. LOWER(p.gender) = LOWER('male') or p.gender ILIKE '%male%'.
- Profession: Only if user said a profession. Use the exact word they used: "Software Engineers" → LOWER(c.profession) LIKE LOWER('%software%') AND LOWER(c.profession) LIKE LOWER('%engineer%') or ILIKE '%software%engineer%'; "doctors" → '%doctor%'. Use the same alias for career_details everywhere (e.g. c), never cd.
- Subscription / premium / platinum: Only if user said it. Join users u ON p.user_id = u.user_id, user_subscriptions us ON u.user_id = us.user_id. WHERE LOWER(us.plan_name) LIKE LOWER('%premium%') or '%platinum%' as the user said. Do not add a filter on first_name or last_name unless the user gave a name.
- Mother tongue / diet / smoking / drinking: Only if user said them. Use p.mother_tongue or lh.diet, lh.smoking, lh.drinking (alias lh for lifestyle_habits, spelled with lowercase L). Do not add these filters when the user did not mention them.
- WHERE: Only user-mentioned criteria. SELECT must be column names only, never boolean expressions.

SELECT CLAUSE — MINIMAL COLUMNS (no unnecessary columns or tables)
- Include in SELECT only: (1) columns from profiles (p) needed for the answer (e.g. p.profile_id, p.first_name, p.last_name), and (2) columns from other tables ONLY if that table is required by the intent and the column is relevant. Do not add c.profession, c.annual_income, lh.diet, lh.smoking, lh.drinking, pl.city, sb.religion, sb.caste unless the intent includes profession, income, diet, smoking, city, religion, or caste respectively.
- Example: intent = city Mumbai only → SELECT p.profile_id, p.first_name, p.last_name, pl.city; JOIN only profiles p and profile_locations pl. Do not SELECT or JOIN career_details, lifestyle_habits, or social_background. Example: intent = profession lawyer, native_place Pune → SELECT p.profile_id, p.first_name, p.last_name, c.profession, f.native_place (or uh.place_of_birth); JOIN profiles p, career_details c, family_origin f (or user_horoscopes uh); do not add lh, sb, ed.
- NEVER put filter logic in SELECT. Add LIMIT 50 for list queries. For "how many/count" only → SELECT COUNT(DISTINCT p.profile_id).

WORKFLOW (follow in order)
1. Base table: Always start with FROM profiles p. Never use FROM career_details, profile_locations, or any other table as the base—all profile searches start from profiles.
2. Intent: Does the user want to see profile rows ("list", "show", "all", "find") or only a number ("how many", "count")? For list/show/all/find → SELECT profile columns. For how many/count → SELECT COUNT(...).
3. Extract: List only criteria the user mentioned. Map each to the correct column (gender→p.gender; profession→c.profession; city→pl.city; income→c.annual_income). Do not add tables the user did not ask for (e.g. do not join payment_transactions for "earning more than X"—use career_details.annual_income only; do not join success_stories or user_horoscopes.place_of_birth for "in Mumbai"—use profile_locations.pl.city).
4. Tables and JOINs: For every column in SELECT and WHERE, the table must appear in FROM or JOIN. Use one alias per table and use it consistently: career_details → c (use c.profession, c.annual_income everywhere, never cd). profile_locations → pl. lifestyle_habits → lh (lowercase L, not Ih). If you use pl.city you MUST have LEFT JOIN profile_locations pl ON p.profile_id = pl.profile_id. If you use c.profession or c.annual_income you MUST have LEFT JOIN career_details c ON p.profile_id = c.profile_id. Each alias used in SELECT/WHERE must have exactly one JOIN; using a different alias for the same table (e.g. c in JOIN but cd in SELECT) causes "missing FROM-clause entry for table cd".
5. JOINs: Use LEFT JOIN only. Every join ON p.profile_id = <alias>.profile_id. career_details → alias c only. profile_locations → pl. lifestyle_habits → lh (not Ih). Never join on data columns (city, profession, etc.).
6. WHERE: One condition per criterion in the intent, combined with AND only (never OR for unrelated criteria). Every condition must match exactly one intent item. Do not add mother_tongue, profession, income, diet, city, etc. unless that attribute is in the intent. For text use LOWER(column) LIKE LOWER('%value%'). Income → c.annual_income >= number. City → LOWER(pl.city) LIKE LOWER('%mumbai%'). Native_place → LOWER(f.native_place) LIKE LOWER('%mumbai%') or uh.place_of_birth.
7. SELECT: Only columns from tables you joined for the intent; keep minimal (p.profile_id, p.first_name, p.last_name, plus filter/display columns for intent). End with LIMIT 50.

COLUMN AND TABLE RULES (accuracy — use exact names from CONTEXT)
- profiles (p): Primary key is profile_id; there is NO column "id". Use p.profile_id, p.first_name, p.last_name, p.gender, p.mother_tongue, p.marital_status, p.height_cm, p.weight_kg, p.date_of_birth. No religion in profiles → use sb.religion.
- Mother tongue: Only in profiles.mother_tongue (p.mother_tongue). Not in profile_languages. For "mother tongue is hindi or english" use (LOWER(p.mother_tongue) LIKE LOWER('%hindi%') OR LOWER(p.mother_tongue) LIKE LOWER('%english%')).
- profile_languages: Columns are language_name, proficiency_level (not lang_name). Use alias plang to avoid confusion with profile_locations pl. Use only when user asks for "languages spoken" or "speaks X", not for "mother tongue".
- profile_locations (pl): city, state, country. Join ON p.profile_id = pl.profile_id.
- career_details (c): profession, annual_income, work_location. Join ON p.profile_id = c.profile_id. Profession is ONLY here—never use master_castes for profession; master_castes has no profile_id and is a lookup table. Use exact profession from user (Chartered Accountant → '%chartered%' '%accountant%', doctor → '%doctor%').
- education_details (ed): degree_type, specialization. social_background (sb): religion, caste only (no marital_status). user_horoscopes (uh): place_of_birth, manglik_status; join ON p.profile_id = uh.profile_id. family_origin (f): native_place, ancestral_origin—for "originally from X" use LOWER(f.native_place) LIKE LOWER('%X%') or uh.place_of_birth. family_details (fd): family_type, family_values. lifestyle_habits (lh): diet, smoking, drinking; join ON p.profile_id = lh.profile_id only—never on p.mother_tongue = lh.diet or lh.smoking.
- "Top N most viewed profiles" / "most viewed this week" → use profile_views: viewed_id = profile, viewed_at for time. Aggregate COUNT(*) per viewed_id, filter viewed_at >= start of week, ORDER BY count DESC LIMIT N. Join profiles p to the subquery on p.profile_id = viewed_id.
- "Platinum members / subscription expires next month" → user_subscriptions (user_id, plan_name, end_date). Join users u ON p.user_id = u.user_id, user_subscriptions us ON u.user_id = us.user_id. Filter LOWER(us.plan_name) LIKE LOWER('%platinum%') and end_date in next month. Do not use profile_languages for city; pl = profile_locations for city.
- "Doctors with MBBS or MD" → both profession AND degree: (c.profession ILIKE '%doctor%') AND (ed.degree_type ILIKE '%MBBS%' OR ed.degree_type ILIKE '%MD%').
- Do not join partner_preferences, privacy_settings unless the user asked about them.

FILTER MAPPING (only for values the user mentioned; use EXACT user word in the value)
- gender → LOWER(p.gender) = LOWER('male') or ILIKE; use the gender the user said (male/female).
- marital status (never married, divorced, single) → p.marital_status only. Never sb.religion. LOWER(p.marital_status) = LOWER('never married') or ILIKE.
- profession → LOWER(c.profession) LIKE LOWER('%<user_word>%') — "doctors" → '%doctor%', "engineers" → '%engineer%'. Never use a profession the user did not say.
- city → LOWER(pl.city) LIKE LOWER('%<user_city>%'); pl must be profile_locations (not profile_languages).
- mother tongue → p.mother_tongue only. diet / vegetarian / smoking / drinking → lh.diet, lh.smoking, lh.drinking (lifestyle_habits lh). Never c.profession or c.smoking.
- religion / caste → sb.religion, sb.caste. income / LPA → c.annual_income >= number (numeric). height/weight → p.height_cm, p.weight_kg (numeric).

OUTPUT FORMAT AND SYNTAX
- Exactly one valid PostgreSQL SELECT. No markdown, no backticks, no explanation. Base table must be FROM profiles p (never FROM career_details or another table). Non-aggregate list queries: end with LIMIT 50 (no semicolon before LIMIT; no extra closing parenthesis before LIMIT—write "AND cond LIMIT 50" or ") LIMIT 50" only when the parenthesis closes an open one, never ") ) LIMIT 50").
- Do not use AS with a dot or invalid alias (e.g. "AS pl.city" or "AS f native_place" is invalid; use a simple alias like AS city_name or omit AS). LIKE must have one string literal: LOWER('%mumbai%') not '%hindi%' 'english%' (use OR for multiple: LIKE '%hindi%' OR LIKE '%english%').
- Substitute actual intent values: use the value from the list (e.g. Mumbai, lawyer, 10 LPA) in the SQL; never leave literal "%value%" or "'value'" in the query.
- When EXTRACTED INTENT has one or more criteria, the query MUST have a WHERE clause containing one condition per criterion. Never output only SELECT and JOINs with no WHERE when the user asked for filtered results.
- Income "X LPA": 1 LPA = 100000 (lakh). 10 LPA = 1000000, 15 LPA = 1500000. Use c.annual_income >= <number> (numeric, not string like '10 LPA').
- Use only standard PostgreSQL. No LINEAR(). lifestyle_habits join: ON p.profile_id = lh.profile_id (the table has profile_id, not id). profile_locations for city: alias pl, JOIN ON p.profile_id = pl.profile_id.
- Before outputting: (1) Every intent criterion has a WHERE condition. (2) Every table/alias used in SELECT or WHERE has a JOIN; base is FROM profiles p. (3) No condition for an attribute not in the intent list.
`.trim();

  const { text, usage } = await generateText(prompt);
  return { sql: text.replace(/^```\w*\n?|```\s*$/g, '').trim(), ...(usage && { usage }) };
}

/** Generate a corrected SQL when a previous attempt failed with an execution error. Uses extracted intent so the corrected query matches user criteria. */
export async function generateCorrectedSQL(
  question: string,
  schemaContext: string,
  previousSql: string,
  executionError: string,
  extractedIntent: ExtractedIntent[] = []
): Promise<{ sql: string; usage?: TokenUsage }> {
  const intentBlock =
    extractedIntent.length > 0
      ? `
EXTRACTED INTENT (the corrected query MUST use these and only these in WHERE; use exact values):
${extractedIntent.map((i) => `- ${i.attribute}: "${i.value}"`).join("\n")}

Map: profession → career_details (c). mother_tongue → p.mother_tongue. religion/caste → social_background (sb). city → profile_locations (pl). native_place → family_origin (f).native_place or user_horoscopes (uh).place_of_birth. Use the EXACT value from the intent list in the SQL (e.g. Mumbai not %value%, lawyer not value). Do not leave literal "%value%" or "'value'" in the query. Base table: FROM profiles p. Do not use GROUP BY or COUNT for list queries.
`
      : "";

  const prompt = `
You are a SQL expert. A previous query failed with a PostgreSQL execution error. Fix the query so it (1) satisfies the extracted intent below and (2) fixes the reported error. Output only the corrected SQL (no markdown, no explanation).
${intentBlock}

CONTEXT (Relevant Tables and Columns; use only these):
${schemaContext}

USER QUESTION: "${question}"

FAILED SQL (had an error):
\`\`\`
${previousSql}
\`\`\`

POSTGRESQL ERROR:
${executionError}

FIX RULES (apply based on the error):
- Intent has first_name or last_name but query does not filter by name: Add WHERE (LOWER(p.first_name) = LOWER('value') OR LOWER(p.last_name) = LOWER('value')) with the actual name from the intent. Remove all other WHERE conditions (mother_tongue, profession, caste, city, etc.) that are not in the intent. Join only profiles p; remove JOINs to career_details, profile_locations, social_background, lifestyle_habits, user_horoscopes if intent is only name.
- Intent has age but query uses mother_tongue or place_of_birth: Replace WHERE with (EXTRACT(YEAR FROM AGE(CURRENT_DATE, p.date_of_birth)) BETWEEN min AND max) using the age range from intent (e.g. 25-30 → BETWEEN 25 AND 30). Remove mother_tongue, place_of_birth, and any other non-age conditions. Join only profiles p.
- "missing FROM-clause entry for table \"f\"" → You used f. (e.g. f.native_place) without joining. Add LEFT JOIN family_origin f ON p.profile_id = f.profile_id. Use the actual place value from intent (e.g. LOWER(f.native_place) LIKE LOWER('%pune%')), not the literal 'native_place'.
- "missing FROM-clause entry for table \"uh\"" → You used uh. (e.g. uh.place_of_birth) without joining. Add LEFT JOIN user_horoscopes uh ON p.profile_id = uh.profile_id. Use the actual value from intent (e.g. LOWER(uh.place_of_birth) LIKE LOWER('%mumbai%')), never uh.place_of_birth = 'native_place'.
- "Missing WHERE clause" → The query has no WHERE but EXTRACTED INTENT has criteria. Add a WHERE clause with one condition per intent: profession → LOWER(c.profession) LIKE LOWER('%value%') and JOIN career_details c; city → LOWER(pl.city) LIKE LOWER('%value%') and JOIN profile_locations pl; income → c.annual_income >= number (10 LPA = 1000000) and JOIN career_details c; religion → LOWER(sb.religion) LIKE LOWER('%value%') and JOIN social_background sb; caste → LOWER(sb.caste) LIKE LOWER('%value%') and JOIN social_background sb; mother_tongue → LOWER(p.mother_tongue) LIKE LOWER('%value%'). Add only the JOINs needed for these conditions. SELECT only column names (p.first_name, p.last_name, c.profession, pl.city, etc.); no boolean expressions in SELECT.
- "column p.id does not exist" → profiles table has profile_id only (no "id"). Replace p.id with p.profile_id or with actual columns (p.first_name, p.last_name, p.gender, etc.) in SELECT.
- "column pl.lang_name does not exist" → profile_languages has language_name (not lang_name). If the intent was "mother tongue", use profiles.mother_tongue (p.mother_tongue) and filter with LOWER(p.mother_tongue) LIKE LOWER('%hindi%') etc.; do not use profile_languages for mother tongue. If you need profile_languages, use alias plang and column plang.language_name.
- "missing FROM-clause entry for table X" or "missing FROM-clause entry for table \"pl\"" → You used an alias without a JOIN. If you used pl (e.g. pl.city), add LEFT JOIN profile_locations pl ON p.profile_id = pl.profile_id. If you used "cd", replace with c and ensure LEFT JOIN career_details c ON p.profile_id = c.profile_id. One alias per table; every alias in SELECT/WHERE must have a matching JOIN.
- "column c.id does not exist" or "column c.user_id does not exist" → career_details has profile_id only. Use LEFT JOIN career_details c ON p.profile_id = c.profile_id.
- "column p.user_id" in a JOIN to profile_locations → Use p.profile_id = pl.profile_id.
- "column c.smoking does not exist" or "column c.diet does not exist" → diet and smoking are in lifestyle_habits (lh), not career_details (c). Add LEFT JOIN lifestyle_habits lh ON p.profile_id = lh.profile_id. Use lh.diet, lh.smoking, lh.drinking in WHERE (e.g. LOWER(lh.diet) LIKE LOWER('%vegetarian%'), LOWER(lh.smoking) = LOWER('no')).
- "column p.created_at does not exist" → profiles has no created_at. Use users table: JOIN users u ON p.user_id = u.user_id and WHERE u.created_at > NOW() - INTERVAL '7 days' (or the number of days the user said).
- "column p.place_of_birth does not exist" → place_of_birth is only in user_horoscopes (uh). Join LEFT JOIN user_horoscopes uh ON p.profile_id = uh.profile_id. Use uh.place_of_birth in WHERE/SELECT. Never join ON p.place_of_birth = uh.place_of_birth.
- "column p.is_verified does not exist" → Use profile_contacts.is_mobile_verified (join profile_contacts pc ON p.profile_id = pc.profile_id WHERE pc.is_mobile_verified = true) or users.is_verified (join users u ON p.user_id = u.user_id WHERE u.is_verified = true).
- "column pl.city does not exist" or "column plang.city does not exist" → profile_languages has no city column. Use profile_locations for city: LEFT JOIN profile_locations pl ON p.profile_id = pl.profile_id and LOWER(pl.city) LIKE LOWER('%value%'). Use plang only for language_name (languages spoken), not for city or mother_tongue.
- "column plang.mother_tongue does not exist" → mother_tongue is in profiles only. Use LOWER(p.mother_tongue) LIKE LOWER('%value%'). Do not use profile_languages for mother tongue.
- "never married" mapped to sb.religion or LOWER(sb.religion) LIKE '%never married%' → sb.religion is for religion only (Hindu, Islam). Marital status is in profiles only. Use LOWER(p.marital_status) = LOWER('never married'). Remove any condition on sb.religion for "never married".
- Conditions in SELECT (e.g. LOWER(pl.city) LIKE ..., c.annual_income >= ..., boolean expressions) → Move every filter into the WHERE clause. SELECT must list only column names (p.first_name, c.profession, pl.city). Never put LOWER(...) LIKE or >= comparisons in SELECT.
- "missing FROM-clause entry for table \"pl\"" → You used pl (e.g. pl.city) but did not join profile_locations. Add LEFT JOIN profile_locations pl ON p.profile_id = pl.profile_id. pl is only for profile_locations (city); for languages use plang and profile_languages.
- "column c.profile_id does not exist" or "column c.profession does not exist" when c is master_castes → profession is in career_details only. Use LEFT JOIN career_details c ON p.profile_id = c.profile_id. Never join master_castes for profession; master_castes is a lookup table with no profile_id.
- "column c.degree_type does not exist" → degree_type and education are in education_details (ed), not career_details (c). Add LEFT JOIN education_details ed ON p.profile_id = ed.profile_id and use ed.degree_type in WHERE. career_details has profession and annual_income only.
- "column lh.id does not exist" or "column Ih.id does not exist" → lifestyle_habits has profile_id, not id. Use LEFT JOIN lifestyle_habits lh ON p.profile_id = lh.profile_id. Never ON p.profile_id = lh.id or p.mother_tongue = lh.diet.
- "column lh.lifestyle_habits does not exist" → The table lifestyle_habits has columns diet, smoking, drinking only (no column named lifestyle_habits). Remove lh.lifestyle_habits from SELECT; use lh.diet, lh.smoking, lh.drinking if you need lifestyle columns. If intent has no diet/smoking/drinking, remove the lifestyle_habits JOIN and any lh.* from SELECT.
- Wrong JOIN ON (e.g. ON p.gender = 'male' OR p.gender = 'female', or ON LOWER(p.mother_tongue) LIKE '%hindi%', or ON p.place_of_birth = uh.place_of_birth) → Every JOIN must be ON p.profile_id = <alias>.profile_id only. Fix: social_background → ON p.profile_id = sb.profile_id; user_horoscopes → ON p.profile_id = uh.profile_id. Never use filter expressions or p.place_of_birth in ON.
- Caste/religion in wrong table (e.g. LOWER(c.profession) LIKE '%brahmin%' or c.profession for caste) → Caste and religion are in social_background only. Use LEFT JOIN social_background sb ON p.profile_id = sb.profile_id, then WHERE LOWER(sb.caste) LIKE LOWER('%brahmin%'), LOWER(sb.religion) LIKE LOWER('%hindu%'). Never use career_details (c) for caste or religion.
- "column X must appear in the GROUP BY clause" → For list queries do not use COUNT(...) or GROUP BY. Use a simple SELECT of columns (p.first_name, p.last_name, ...) with WHERE only. Remove GROUP BY and any aggregate from SELECT.
- "column X does not exist" (other) → Use only columns from CONTEXT. profiles: profile_id, first_name, last_name, gender, mother_tongue, marital_status, height_cm, weight_kg, date_of_birth—no id, religion, created_at, place_of_birth, is_verified. lifestyle_habits: diet, smoking, drinking—no column "lifestyle_habits". profile_languages: language_name (not lang_name). social_background: religion, caste (join ON p.profile_id = sb.profile_id). career_details: profession, annual_income. user_horoscopes: place_of_birth (profiles has no place_of_birth).
- Remove invented filters: Align WHERE to EXTRACTED INTENT above. Use AND to combine intent conditions only; remove any OR that adds non-intent criteria (e.g. mother_tongue, income, profession when not in intent). Never add profession, mother_tongue, marital_status, diet, income, or religion unless in the intent list. Remove unnecessary JOINs: if intent has only city, remove career_details, lifestyle_habits, social_background. Remove unnecessary SELECT columns: do not select c.profession, lh.diet, lh.smoking, lh.drinking unless those are in the intent.
- SELECT must be column names (p.first_name, p.last_name, ...), not a boolean expression. Never put (LOWER(p.first_name) = LOWER('x')) in SELECT; that belongs in WHERE.
- Never use LOWER() on numeric columns (annual_income, min_age, max_age, height_cm, weight_kg). Use >=, <=, = for numbers.
- "operator does not exist: integer = character varying" → Joins must be ON p.profile_id = <alias>.profile_id only.
- "missing FROM-clause entry for table \"p\"" → The base table must be FROM profiles p. Never start with FROM career_details c or FROM profile_locations pl. Change to FROM profiles p and then LEFT JOIN career_details c ON p.profile_id = c.profile_id, etc.
- "syntax error at or near \"LIMIT\"" or "syntax error at or near \".\"" or "syntax error at or near \"native_place\"" → Often an extra closing parenthesis before LIMIT or invalid AS (e.g. AS pl.city). Remove any extra ) so the WHERE ends with the last condition then LIMIT 50 (e.g. AND cond LIMIT 50). Do not use AS with a dot (AS pl.city); use a simple alias or omit AS. Fix: ... AND last_condition LIMIT 50 (no ) ) before LIMIT unless it closes an open paren).
- "syntax error at or near \"'english%'\"" or malformed LIKE with two strings → LIKE accepts one string. For "hindi or english" use (LOWER(p.mother_tongue) LIKE LOWER('%hindi%') OR LOWER(p.mother_tongue) LIKE LOWER('%english%')). Never write LIKE LOWER('%hindi%' 'english%').
- "syntax error at or near \"LIMIT\"" (semicolon) → Do not put a semicolon before LIMIT. End with LIMIT 50 not ); LIMIT 50.
- "syntax error at or near \"ON\"" → Usually wrong join: lifestyle_habits must be ON p.profile_id = lh.profile_id (table has profile_id, not id). Replace lh.id with lh.profile_id. Use lowercase lh, not Ih.
- Syntax errors → Fix parentheses, commas, quotes, AND/OR. Use only standard PostgreSQL. No LINEAR().
- General: WHERE must match EXTRACTED INTENT only. Use one alias per table (c for career_details, lh for lifestyle_habits). Joins: lifestyle_habits must be ON p.profile_id = lh.profile_id only—never ON p.mother_tongue = lh.diet or p.mother_tongue = lh.smoking.

If the failed query has no WHERE clause but EXTRACTED INTENT has criteria: add a WHERE clause with one condition per intent (profession → c.profession, city → pl.city, income → c.annual_income as number, religion → sb.religion, caste → sb.caste, mother_tongue → p.mother_tongue, native_place → f.native_place or uh.place_of_birth). Add the required JOINs for each table used in WHERE (pl, c, sb, ed, lh, f, uh as needed).

Income: use numeric only, e.g. 10 LPA = 1000000. Write ) LIMIT 50 with no semicolon before LIMIT.

Output only the corrected SELECT statement. End list queries with ) LIMIT 50. No backticks or commentary.
`.trim();

  const { text, usage } = await generateText(prompt);
  return { sql: text.replace(/^```\w*\n?|```\s*$/g, '').trim(), ...(usage && { usage }) };
}