import { generateText } from './ai.service.js';

export async function generateMatrimonialSQL(question: string, schemaContext: string) {
  const prompt = `
You are an expert SQL analyst for a matrimonial profile database. Produce exactly one valid PostgreSQL SELECT that answers the user's question. Use only tables and columns present in CONTEXT; CONTEXT may include column descriptions—use them to pick correct names and avoid non-existent columns.

CONTEXT (Relevant Tables and Columns; use only these):
${schemaContext}

USER QUESTION: "${question}"

From the question above, extract every specific value the user mentioned. Add one WHERE condition for each. Combine multiple criteria with AND (all must hold). Do not add any filter the user did not mention.

ATTRIBUTE VS PERSON NAME (critical — wrong mapping causes bad queries)
- Gender words ("female", "male", "women", "men") → always p.gender. Never use first_name or last_name for gender. Example: "female profiles" → WHERE LOWER(p.gender) = 'female' or p.gender ILIKE '%female%'.
- Caste/community words ("Rajput", "Brahmin", "Kumar" as community) → sb.caste or sb.sub_caste. Never use first_name/last_name for caste. Example: "Rajput matches" → WHERE sb.caste ILIKE '%Rajput%' (and JOIN social_background sb).
- Religion → sb.religion. The profiles table has no religion column; do not use p.religion (it does not exist).
- Person name: Only when the user clearly asks for one specific person by name (e.g. "profile of Riya", "show me John", "give me [Name]'s profile") use first_name/last_name. Do not treat attribute values (female, Rajput, etc.) as person names.

STEP 1 — EXTRACT CRITERIA (mandatory; do not infer extra criteria)
- List every criterion the user actually mentioned. Each → one WHERE condition. Do not add India, Male, Engineer, or any value the user did not say.
- Person name (only when asking for one person by name): (LOWER(p.first_name) = LOWER('name') OR LOWER(p.last_name) = LOWER('name')).
- Place: "in X", "from X", "born in X", "X city" → see below. Current residence → pl.city, pl.state, pl.country (pl = profile_locations only). Born in / place of birth → user_horoscopes.place_of_birth (join user_horoscopes e.g. uh ON p.profile_id = uh.profile_id).
- Gender → p.gender. Marital status → p.marital_status. Profession/degree/religion/caste/diet → see FILTER MAPPING. Manglik / non-Manglik → user_horoscopes.manglik_status (e.g. LOWER(uh.manglik_status) ILIKE '%non%' or = 'No' for non-Manglik).
- WHERE logic: Combine all criteria with AND: (cond1) AND (cond2) AND (cond3). Do not use OR between different criteria unless the user said "or". Use parentheses so AND/OR are correct.
- Verification: No filter for a value the user did not mention. Every mentioned value has a corresponding WHERE condition. pl is only profile_locations (city, state, country); profile_languages has no country column—use a different alias (e.g. plang) if you need both.

LIST vs COUNT (critical for UI to show data)
- "List of X", "show me X", "give me X", "all X", "find X", "get X profiles" → the user wants to SEE profile rows in the UI. Use SELECT with actual columns (e.g. p.first_name, p.last_name, p.gender, pl.city, c.profession, ...), not COUNT. Add LIMIT 50. The UI displays a data table from the returned rows; if you return only COUNT, the user sees just one number and no profile list.
- Only when the user explicitly asks "how many", "count", "number of" → use SELECT COUNT(DISTINCT p.profile_id) and no other columns. Then the result is a single number.

WORKFLOW (follow in order)
1. Intent: Does the user want to see profile rows ("list", "show", "all", "find") or only a number ("how many", "count")? For list/show/all/find → SELECT profile columns. For how many/count → SELECT COUNT(...).
2. Extract: List only criteria the user mentioned. Map each to the correct column (gender→p.gender; caste→sb.caste; etc.). Do not infer extra filters.
3. Tables: Pick only tables whose columns you use in SELECT or WHERE. Do not join tables you do not need (e.g. for "list of females" you need profiles only, or profiles + profile_locations if you want to show city).
4. JOINs: Every join ON p.profile_id = <alias>.profile_id only.
5. WHERE: One condition per criterion, combined with AND. Correct parentheses.
6. SELECT: For list/show/all/find → SELECT p.first_name, p.last_name, p.gender, and other useful columns from joined tables so the UI can display a table of profiles. End with LIMIT 50. For how many/count → SELECT COUNT(DISTINCT p.profile_id) only.

COLUMN AND TABLE RULES (accuracy)
- Use only columns that exist in CONTEXT for that table. profiles has no religion column → use sb.religion. profile_locations (pl) has city, state, country; profile_languages has language_name, proficiency_level only (no city/state/country). If you need both location and languages, use pl for profile_locations and a different alias for profile_languages.
- education_details (ed): degree_type, specialization, college_university, passing_year. No education_level, no education.
- social_background (sb): religion, caste, sub_caste. Religion and caste are here, not in profiles.
- user_horoscopes (e.g. uh): place_of_birth (born in X), manglik_status (Manglik / non-Manglik). Join ON p.profile_id = uh.profile_id.
- family_details (fd): family_type, family_values, family_status. Marital status is only p.marital_status.
- career_details (c): profession, etc. profile_locations (pl): city, state, country. Join every table on profile_id only.

FILTER MAPPING (only for values the user mentioned; do not invent values)
- gender / female / male / women / men → p.gender (never first_name or last_name).
- marital status / never married / divorced / single → p.marital_status.
- Person name (only when user asks for one person by name) → p.first_name, p.last_name.
- city / state / country (current location) → pl.city, pl.state, pl.country. Born in / place of birth → user_horoscopes.place_of_birth.
- profession / job → c.profession. education / degree / PG / UG → ed.degree_type, ed.specialization.
- religion → sb.religion. caste / community / Rajput / Brahmin → sb.caste or sb.sub_caste (not first_name/last_name).
- Manglik / non-Manglik → user_horoscopes.manglik_status.
- diet / lifestyle → lh.diet, lh.smoking, lh.drinking. family → fd.family_type, fd.family_values. income → c.annual_income.

OUTPUT FORMAT
- Exactly one SQL statement. No markdown, no backticks, no explanation. Non-aggregate list queries: end with LIMIT 50.
`.trim();

  const text = await generateText(prompt);
  return text.replace(/^```\w*\n?|```\s*$/g, '').trim();
}