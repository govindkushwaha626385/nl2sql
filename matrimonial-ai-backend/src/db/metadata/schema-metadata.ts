/**
 * Hardcoded schema metadata for the matrimonial database.
 * Complete list of tables, columns, and descriptions for NL2SQL context.
 * Excludes schema_registry and semantic_cache from NL2SQL retrieval (system tables).
 *
 * After editing descriptions, refresh embeddings so semantic search stays in sync:
 *   npx tsx src/scripts/seed-metadata-embeddings.ts
 */

export interface ColumnMeta {
  name: string;
  data_type: string;
  /** Short hint for NL2SQL: filter/display use, or "FK: join only". Optional. */
  description?: string;
}

export interface TableMeta {
  table_name: string;
  module_name: string;
  /** Detailed: purpose, join condition, when to use, example intents, key columns. Improves semantic search and planner accuracy. */
  description: string;
  /** Comma-separated user intent keywords (e.g. "first name, last name, height, weight") so embeddings match natural language. */
  intent_keywords?: string;
  columns: ColumnMeta[];
}

export const SCHEMA_METADATA: TableMeta[] = [
  {
    table_name: "users",
    module_name: "Core",
    description: "User accounts: created_at (when they registered), is_verified. For 'joined/registered in last X days' join users u ON p.user_id = u.user_id and WHERE u.created_at > NOW() - INTERVAL 'X days'. For 'verified' use u.is_verified = true or profile_contacts.is_mobile_verified. profiles has no created_at or is_verified.",
    intent_keywords: "registered, joined, signup, created at, verified, verification",
    columns: [
      { name: "user_id", data_type: "SERIAL" },
      { name: "email", data_type: "VARCHAR(255)" },
      { name: "password_hash", data_type: "TEXT" },
      { name: "created_at", data_type: "TIMESTAMP", description: "When user registered. Use for 'joined in last X days'." },
      { name: "last_login", data_type: "TIMESTAMP" },
      { name: "is_active", data_type: "BOOLEAN" },
      { name: "is_verified", data_type: "BOOLEAN", description: "Account verified. Join users u ON p.user_id = u.user_id." },
    ],
  },
  {
    table_name: "profiles",
    module_name: "Core",
    description: "Primary table for matrimonial profiles. Always use as base (FROM profiles p). Primary key is profile_id (there is NO column named 'id'—use p.profile_id or p.first_name, p.last_name, etc.). Key columns: first_name, last_name, gender, mother_tongue, date_of_birth, height_cm, weight_kg, marital_status. Mother tongue is in profiles.mother_tongue only (not in profile_languages). Join: ON p.profile_id = <alias>.profile_id only.",
    intent_keywords: "first name, last name, name, full name, gender, male, female, height, weight, age, date of birth, DOB, marital status, never married, divorced, single, widowed, mother tongue, profile, bio",
    columns: [
      { name: "profile_id", data_type: "SERIAL", description: "Primary key (use this, not 'id'). Use in JOIN ON p.profile_id = <alias>.profile_id only." },
      { name: "user_id", data_type: "INTEGER", description: "FK to users; rarely needed for profile listing." },
      { name: "first_name", data_type: "VARCHAR(100)", description: "Filter/display: LOWER(p.first_name) = LOWER('value') for name search." },
      { name: "last_name", data_type: "VARCHAR(100)", description: "Filter/display: same as first_name for surname." },
      { name: "gender", data_type: "VARCHAR(10)", description: "Filter/display: male, female. Use LOWER(p.gender) or ILIKE." },
      { name: "date_of_birth", data_type: "DATE", description: "Filter/display: age or DOB; can compute age from this." },
      { name: "height_cm", data_type: "INTEGER", description: "Filter/display: height in cm." },
      { name: "weight_kg", data_type: "INTEGER", description: "Filter/display: weight in kg." },
      { name: "marital_status", data_type: "VARCHAR(50)", description: "Filter/display: Divorced, Never Married, Widowed, etc. Use p.marital_status (not family_details)." },
      { name: "mother_tongue", data_type: "VARCHAR(100)", description: "Filter/display: language." },
    ],
  },
  {
    table_name: "profile_contacts",
    module_name: "Core",
    description: "Contact info per profile: mobile_number, alternate_number, whatsapp_number, is_mobile_verified. Join: ON p.profile_id = profile_contacts.profile_id. Use when question asks for phone, contact, or WhatsApp.",
    columns: [
      { name: "contact_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER", description: "FK to profiles. JOIN ON p.profile_id = profile_contacts.profile_id." },
      { name: "mobile_number", data_type: "VARCHAR(20)" },
      { name: "alternate_number", data_type: "VARCHAR(20)" },
      { name: "whatsapp_number", data_type: "VARCHAR(20)" },
      { name: "is_mobile_verified", data_type: "BOOLEAN" },
    ],
  },
  {
    table_name: "profile_photos",
    module_name: "Core",
    description: "Photos per profile: photo_url, is_profile_picture, is_approved, uploaded_at. Join: ON p.profile_id = profile_photos.profile_id. Use when question asks for photos or profile picture.",
    columns: [
      { name: "photo_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER" },
      { name: "photo_url", data_type: "TEXT" },
      { name: "is_profile_picture", data_type: "BOOLEAN" },
      { name: "is_approved", data_type: "BOOLEAN" },
      { name: "uploaded_at", data_type: "TIMESTAMP" },
    ],
  },
  {
    table_name: "physical_details",
    module_name: "Core",
    description: "Physical attributes per profile: body_type, complexion, blood_group, disability. Join: ON p.profile_id = physical_details.profile_id. Use for body type, complexion, blood group, or disability filters.",
    intent_keywords: "body type, complexion, blood group, disability, physical",
    columns: [
      { name: "detail_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER", description: "FK; JOIN ON p.profile_id = physical_details.profile_id." },
      { name: "body_type", data_type: "VARCHAR(50)" },
      { name: "complexion", data_type: "VARCHAR(50)" },
      { name: "blood_group", data_type: "VARCHAR(5)" },
      { name: "disability", data_type: "VARCHAR(255)" },
    ],
  },
  {
    table_name: "user_documents",
    module_name: "Core",
    description: "KYC documents per user (user_id, not profile_id): document_type, document_url, verification_status. Links to users table. Use for document or verification queries.",
    columns: [
      { name: "doc_id", data_type: "SERIAL" },
      { name: "user_id", data_type: "INTEGER" },
      { name: "document_type", data_type: "VARCHAR(50)" },
      { name: "document_url", data_type: "TEXT" },
      { name: "verification_status", data_type: "VARCHAR(20)" },
    ],
  },
  {
    table_name: "social_background",
    module_name: "Core",
    description: "Religion and caste per profile. Purpose: religion, caste, sub_caste, gothra, sect. Join: ON p.profile_id = sb.profile_id (integer=integer). When to use: questions about religion, caste, community. Example intents: Hindu profiles, Brahmin, by religion. Key columns: religion, caste (VARCHAR — filter/display). There is no religion_id; use sb.religion for religion value.",
    intent_keywords: "religion, caste, community, sub caste, Brahmin, Rajput, Hindu, Muslim, Christian, sect, gothra",
    columns: [
      { name: "social_id", data_type: "SERIAL", description: "PK of this table." },
      { name: "profile_id", data_type: "INTEGER", description: "FK to profiles. Use only in JOIN: ON p.profile_id = sb.profile_id." },
      { name: "religion", data_type: "VARCHAR(100)", description: "Filter/display: religion name. No religion_id column." },
      { name: "caste", data_type: "VARCHAR(100)", description: "Filter/display: caste." },
      { name: "sub_caste", data_type: "VARCHAR(100)", description: "Filter/display: sub-caste." },
      { name: "gothra", data_type: "VARCHAR(100)", description: "Display: gothra." },
      { name: "sect", data_type: "VARCHAR(100)", description: "Filter/display: sect." },
    ],
  },
  {
    table_name: "master_religions",
    module_name: "Core",
    description: "Lookup table: id, name. For profile religion use social_background.religion (VARCHAR) not this table.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "name", data_type: "VARCHAR(100)" },
    ],
  },
  {
    table_name: "master_castes",
    module_name: "Core",
    description: "Lookup: id, religion_id, name. For profile caste use social_background.caste not this table.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "religion_id", data_type: "INTEGER" },
      { name: "name", data_type: "VARCHAR(100)" },
    ],
  },
  {
    table_name: "religious_values",
    module_name: "Core",
    description: "Religious observance per profile: observance_level, hijab_preference, halal_preference. Join: ON p.profile_id = religious_values.profile_id.",
    columns: [
      { name: "val_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER", description: "FK; JOIN ON p.profile_id = religious_values.profile_id." },
      { name: "observance_level", data_type: "VARCHAR(50)" },
      { name: "hijab_preference", data_type: "VARCHAR(50)" },
      { name: "halal_preference", data_type: "BOOLEAN" },
    ],
  },
  {
    table_name: "career_details",
    module_name: "Core",
    description: "Job and career per profile. Purpose: profession, income, company, work location. Join: ON p.profile_id = c.profile_id (integer=integer). When to use: questions about lawyer, doctor, engineer, profession, income, job, work place. Example intents: lawyers in Pune, engineers, high income, list by profession. Key columns: profession (VARCHAR — use for filter/display, not in ON), annual_income, work_location, company_name. No column named position or job_title; use profession. Do not use master_professions for filtering profiles by profession; use this table.",
    intent_keywords: "profession, job, occupation, engineer, doctor, lawyer, teacher, salary, income, LPA, earning, annual income, company, work location",
    columns: [
      { name: "career_id", data_type: "SERIAL", description: "PK of this table." },
      { name: "profile_id", data_type: "INTEGER", description: "FK to profiles. Use only in JOIN: ON p.profile_id = c.profile_id." },
      { name: "profession", data_type: "VARCHAR(255)", description: "Filter/display: lawyer, doctor, engineer, teacher. LOWER(c.profession) or ILIKE." },
      { name: "company_name", data_type: "VARCHAR(255)", description: "Display: employer name." },
      { name: "annual_income", data_type: "NUMERIC(15,2)", description: "Filter/display: income amount." },
      { name: "currency", data_type: "VARCHAR(10)", description: "Display: INR, USD, etc." },
      { name: "work_location", data_type: "VARCHAR(255)", description: "Filter/display: where they work." },
    ],
  },
  {
    table_name: "education_details",
    module_name: "Core",
    description: "Education and qualifications per profile. Purpose: degree, specialization, college, year. Join: ON p.profile_id = ed.profile_id (integer=integer). When to use: questions about degree, education, college, qualification, UG/PG. Example intents: engineers, MBAs, from IIT. Key columns: degree_type, specialization, college_university, passing_year. There is no column education_level or education; use degree_type for degree level and specialization for field.",
    intent_keywords: "education, degree, qualification, UG, PG, MBA, college, university, specialization, passing year",
    columns: [
      { name: "edu_id", data_type: "SERIAL", description: "PK of this table." },
      { name: "profile_id", data_type: "INTEGER", description: "FK to profiles. Use only in JOIN: ON p.profile_id = ed.profile_id." },
      { name: "degree_type", data_type: "VARCHAR(255)", description: "Filter/display: UG, PG, Doctorate, etc. Not education_level." },
      { name: "specialization", data_type: "VARCHAR(255)", description: "Filter/display: field of study." },
      { name: "college_university", data_type: "VARCHAR(255)", description: "Filter/display: institution name." },
      { name: "passing_year", data_type: "INTEGER", description: "Filter/display: year passed." },
    ],
  },
  {
    table_name: "master_professions",
    module_name: "Core",
    description: "Lookup table: id, category, title. For listing or filtering profiles by profession do NOT join this table; use career_details and filter on career_details.profession (VARCHAR) instead.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "category", data_type: "VARCHAR(100)" },
      { name: "title", data_type: "VARCHAR(100)" },
    ],
  },
  {
    table_name: "master_degrees",
    module_name: "Core",
    description: "Lookup: id, degree_name. For profile education use education_details.degree_type, specialization, college_university.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "degree_name", data_type: "VARCHAR(100)" },
    ],
  },
  {
    table_name: "user_horoscopes",
    module_name: "Astrology",
    description: "Astrology per profile: place_of_birth, time_of_birth, rashi, nakshatra, manglik_status, horoscope_url. Join: ON p.profile_id = user_horoscopes.profile_id. Use for horoscope, rashi, nakshatra, manglik questions.",
    intent_keywords: "manglik, non manglik, horoscope, rashi, nakshatra, place of birth, born in",
    columns: [
      { name: "horo_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER", description: "FK; JOIN ON p.profile_id = user_horoscopes.profile_id." },
      { name: "place_of_birth", data_type: "VARCHAR(255)" },
      { name: "time_of_birth", data_type: "TIME" },
      { name: "rashi", data_type: "VARCHAR(100)" },
      { name: "nakshatra", data_type: "VARCHAR(100)" },
      { name: "manglik_status", data_type: "VARCHAR(50)" },
      { name: "horoscope_url", data_type: "TEXT" },
    ],
  },
  {
    table_name: "astro_compatibility",
    module_name: "Astrology",
    description: "Cached compatibility between two profiles: profile_id_1, profile_id_2, guna_score, compatibility_report. Use for match score or compatibility queries; join logic is profile-to-profile not profile_id to one table.",
    columns: [
      { name: "match_id", data_type: "SERIAL" },
      { name: "profile_id_1", data_type: "INTEGER" },
      { name: "profile_id_2", data_type: "INTEGER" },
      { name: "guna_score", data_type: "INTEGER" },
      { name: "compatibility_report", data_type: "TEXT" },
    ],
  },
  {
    table_name: "master_nakshatras",
    module_name: "Astrology",
    description: "Lookup: id, name. For profile nakshatra use user_horoscopes.nakshatra.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "name", data_type: "VARCHAR(100)" },
    ],
  },
  {
    table_name: "profile_locations",
    module_name: "Core",
    description: "Current residence and address per profile. Purpose: city, state, country, zip, residency. Join: ON p.profile_id = pl.profile_id (integer=integer). When to use: questions about city (Pune, Mumbai, Delhi), state, country, location, where they live. Example intents: profiles in Pune, from Maharashtra, living in India. Key columns: city, state, country (VARCHAR — filter/display only, not for ON). Do not use master_cities for filtering profiles by city; use this table's city column.",
    intent_keywords: "city, location, state, country, Mumbai, Pune, Delhi, Bangalore, Hyderabad, where they live, current residence, address",
    columns: [
      { name: "loc_id", data_type: "SERIAL", description: "PK of this table." },
      { name: "profile_id", data_type: "INTEGER", description: "FK to profiles. Use only in JOIN: ON p.profile_id = pl.profile_id." },
      { name: "country", data_type: "VARCHAR(100)", description: "Filter/display: country name." },
      { name: "state", data_type: "VARCHAR(100)", description: "Filter/display: state name." },
      { name: "city", data_type: "VARCHAR(100)", description: "Filter/display: city name (e.g. Pune, Mumbai). LOWER(pl.city) or ILIKE." },
      { name: "zip_code", data_type: "VARCHAR(20)", description: "Display: postal code." },
      { name: "residency_status", data_type: "VARCHAR(50)", description: "Filter/display: e.g. Citizen, residing." },
    ],
  },
  {
    table_name: "family_origin",
    module_name: "Core",
    description: "Native place and ancestral origin per profile. Join: ON p.profile_id = family_origin.profile_id. Columns: native_place, ancestral_origin. Use for 'originally from X', native place, where they are from.",
    intent_keywords: "originally from, native place, ancestral origin, from Mumbai, from Delhi",
    columns: [
      { name: "origin_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER", description: "FK; JOIN ON p.profile_id = family_origin.profile_id." },
      { name: "native_place", data_type: "VARCHAR(255)" },
      { name: "ancestral_origin", data_type: "VARCHAR(255)" },
    ],
  },
  {
    table_name: "master_cities",
    module_name: "Core",
    description: "Lookup table: id, city_name, state_name, country_name. For listing or filtering profiles by city do NOT join this table; use profile_locations and filter on profile_locations.city instead.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "city_name", data_type: "VARCHAR(100)" },
      { name: "state_name", data_type: "VARCHAR(100)" },
      { name: "country_name", data_type: "VARCHAR(100)" },
    ],
  },
  {
    table_name: "lifestyle_habits",
    module_name: "Core",
    description: "Lifestyle and habits per profile. Purpose: diet, smoking, drinking. Join: ON p.profile_id = lh.profile_id (integer=integer). When to use: questions about vegetarian, non-veg, vegan, smoking, drinking. Example intents: vegetarian profiles, non-smoker. Key columns: diet, smoking, drinking (VARCHAR — filter/display only, not for ON).",
    intent_keywords: "diet, vegetarian, non veg, vegan, smoking, drinking, lifestyle",
    columns: [
      { name: "life_id", data_type: "SERIAL", description: "PK of this table." },
      { name: "profile_id", data_type: "INTEGER", description: "FK to profiles. Use only in JOIN: ON p.profile_id = lh.profile_id." },
      { name: "diet", data_type: "VARCHAR(50)", description: "Filter/display: Vegetarian, Non-Vegetarian, Vegan, etc." },
      { name: "smoking", data_type: "VARCHAR(50)", description: "Filter/display: Yes, No, etc." },
      { name: "drinking", data_type: "VARCHAR(50)", description: "Filter/display: Yes, No, etc." },
    ],
  },
  {
    table_name: "hobbies",
    module_name: "Core",
    description: "Hobbies per profile (one row per hobby): hobby_name. Join: ON p.profile_id = hobbies.profile_id. Use for hobby or interest filters.",
    columns: [
      { name: "hobby_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER", description: "FK; JOIN ON p.profile_id = hobbies.profile_id." },
      { name: "hobby_name", data_type: "VARCHAR(100)" },
    ],
  },
  {
    table_name: "profile_languages",
    module_name: "Core",
    description: "Additional languages spoken per profile. Column is language_name (not lang_name). Use for 'languages spoken' or 'speaks X'. For mother tongue use profiles.mother_tongue only. Join: ON p.profile_id = profile_languages.profile_id; use alias plang to avoid confusion with profile_locations pl.",
    columns: [
      { name: "lang_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER", description: "FK; JOIN ON p.profile_id = profile_languages.profile_id." },
      { name: "language_name", data_type: "VARCHAR(100)", description: "Column name is language_name (not lang_name). For mother tongue use p.mother_tongue." },
      { name: "proficiency_level", data_type: "VARCHAR(50)" },
    ],
  },
  {
    table_name: "profile_interests",
    module_name: "Core",
    description: "Interest requests between profiles: sender_id, receiver_id, status (Accepted/Rejected), sent_at. No single profile_id; links two profiles. Use for interest, connection, or acceptance queries.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "sender_id", data_type: "INTEGER" },
      { name: "receiver_id", data_type: "INTEGER" },
      { name: "status", data_type: "VARCHAR(20)" },
      { name: "sent_at", data_type: "TIMESTAMP" },
    ],
  },
  {
    table_name: "profile_shortlists",
    module_name: "Core",
    description: "Shortlists: shortlisted_by (profile_id), shortlisted_profile_id, created_at. Use for shortlist or bookmark queries.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "shortlisted_by", data_type: "INTEGER" },
      { name: "shortlisted_profile_id", data_type: "INTEGER" },
      { name: "created_at", data_type: "TIMESTAMP" },
    ],
  },
  {
    table_name: "chat_messages",
    module_name: "Core",
    description: "Chat messages: sender_id, receiver_id, message_text, sent_at. Use for chat or message history; no profile_id column.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "sender_id", data_type: "INTEGER" },
      { name: "receiver_id", data_type: "INTEGER" },
      { name: "message_text", data_type: "TEXT" },
      { name: "sent_at", data_type: "TIMESTAMP" },
    ],
  },
  {
    table_name: "profile_views",
    module_name: "Core",
    description: "View tracking: viewer_id, viewed_id, viewed_at. For 'most viewed profiles' or 'top viewed this week' aggregate COUNT(*) per viewed_id, filter viewed_at >= date_trunc('week', CURRENT_DATE), ORDER BY count DESC LIMIT N. Join profiles p ON p.profile_id = viewed_id.",
    intent_keywords: "most viewed, top viewed, view count, viewed this week",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "viewer_id", data_type: "INTEGER" },
      { name: "viewed_id", data_type: "INTEGER" },
      { name: "viewed_at", data_type: "TIMESTAMP" },
    ],
  },
  {
    table_name: "user_subscriptions",
    module_name: "Finance",
    description: "Subscription per user: plan_name (Basic, Gold, Platinum), end_date, is_active. Join users u ON p.user_id = u.user_id, user_subscriptions us ON u.user_id = us.user_id. For 'Platinum members' filter LOWER(us.plan_name) LIKE '%platinum%'. For 'expires next month' filter us.end_date.",
    intent_keywords: "platinum, gold, subscription, plan, expires next month",
    columns: [
      { name: "sub_id", data_type: "SERIAL" },
      { name: "user_id", data_type: "INTEGER" },
      { name: "plan_name", data_type: "VARCHAR(100)" },
      { name: "start_date", data_type: "DATE" },
      { name: "end_date", data_type: "DATE" },
      { name: "is_active", data_type: "BOOLEAN" },
    ],
  },
  {
    table_name: "payment_transactions",
    module_name: "Finance",
    description: "Payments per user: user_id, amount, status, txn_date. Use for payment or transaction history.",
    columns: [
      { name: "txn_id", data_type: "SERIAL" },
      { name: "user_id", data_type: "INTEGER" },
      { name: "amount", data_type: "NUMERIC(10,2)" },
      { name: "status", data_type: "VARCHAR(20)" },
      { name: "txn_date", data_type: "TIMESTAMP" },
    ],
  },
  {
    table_name: "privacy_settings",
    module_name: "Core",
    description: "Privacy per profile: show_photo_to, show_phone_to. Join: ON p.profile_id = privacy_settings.profile_id. Use for privacy or visibility queries.",
    columns: [
      { name: "setting_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER" },
      { name: "show_photo_to", data_type: "VARCHAR(20)" },
      { name: "show_phone_to", data_type: "VARCHAR(20)" },
    ],
  },
  {
    table_name: "user_blocks",
    module_name: "Core",
    description: "Block list: blocker_id, blocked_id, blocked_at. Use for block or blocked-user queries.",
    columns: [
      { name: "id", data_type: "SERIAL" },
      { name: "blocker_id", data_type: "INTEGER" },
      { name: "blocked_id", data_type: "INTEGER" },
      { name: "blocked_at", data_type: "TIMESTAMP" },
    ],
  },
  {
    table_name: "family_details",
    module_name: "Core",
    description: "Family information per profile. Purpose: parents' occupation, siblings count, family type/values/status. Join: ON p.profile_id = fd.profile_id (integer=integer). When to use: questions about family type, joint/nuclear, family values. Example intents: joint family, traditional values. Key columns: family_type, family_values, family_status (VARCHAR). Marital status of the profile is in profiles.marital_status, not in this table.",
    intent_keywords: "family type, joint family, nuclear family, family values, family status",
    columns: [
      { name: "family_id", data_type: "SERIAL", description: "PK of this table." },
      { name: "profile_id", data_type: "INTEGER", description: "FK to profiles. Use only in JOIN: ON p.profile_id = fd.profile_id." },
      { name: "father_occupation", data_type: "VARCHAR(255)", description: "Display: father's job." },
      { name: "mother_occupation", data_type: "VARCHAR(255)", description: "Display: mother's job." },
      { name: "number_of_brothers", data_type: "INTEGER", description: "Display: count." },
      { name: "number_of_sisters", data_type: "INTEGER", description: "Display: count." },
      { name: "brothers_married", data_type: "INTEGER", description: "Display: count." },
      { name: "sisters_married", data_type: "INTEGER", description: "Display: count." },
      { name: "family_type", data_type: "VARCHAR(50)", description: "Filter/display: e.g. Joint, Nuclear. Not marital_status." },
      { name: "family_values", data_type: "VARCHAR(50)", description: "Filter/display: traditional, moderate, etc." },
      { name: "family_status", data_type: "VARCHAR(50)", description: "Filter/display: Middle Class, Upper Middle, etc." },
    ],
  },
  {
    table_name: "partner_preferences",
    module_name: "Core",
    description: "What each profile seeks in a partner: min_age, max_age, min_height, max_height, preferred_religions, preferred_castes, preferred_education, preferred_income_min, expectation_notes. Join: ON p.profile_id = partner_preferences.profile_id. Use for preference-based questions.",
    columns: [
      { name: "pref_id", data_type: "SERIAL" },
      { name: "profile_id", data_type: "INTEGER" },
      { name: "min_age", data_type: "INTEGER" },
      { name: "max_age", data_type: "INTEGER" },
      { name: "min_height", data_type: "INTEGER" },
      { name: "max_height", data_type: "INTEGER" },
      { name: "preferred_religions", data_type: "TEXT" },
      { name: "preferred_castes", data_type: "TEXT" },
      { name: "preferred_education", data_type: "TEXT" },
      { name: "preferred_income_min", data_type: "NUMERIC(15,2)" },
      { name: "expectation_notes", data_type: "TEXT" },
    ],
  },
  {
    table_name: "success_stories",
    module_name: "Core",
    description: "Marriage success stories: partner_1_id, partner_2_id, wedding_date, testimonial, story_image_url, is_published. Use for success story or wedding queries.",
    columns: [
      { name: "story_id", data_type: "SERIAL" },
      { name: "partner_1_id", data_type: "INTEGER" },
      { name: "partner_2_id", data_type: "INTEGER" },
      { name: "wedding_date", data_type: "DATE" },
      { name: "testimonial", data_type: "TEXT" },
      { name: "story_image_url", data_type: "TEXT" },
      { name: "is_published", data_type: "BOOLEAN" },
    ],
  },
  {
    table_name: "notifications",
    module_name: "Core",
    description: "Notifications per user (user_id): title, message, notif_type, is_read, created_at. Use for notification queries.",
    columns: [
      { name: "notif_id", data_type: "SERIAL" },
      { name: "user_id", data_type: "INTEGER" },
      { name: "title", data_type: "VARCHAR(255)" },
      { name: "message", data_type: "TEXT" },
      { name: "notif_type", data_type: "VARCHAR(50)" },
      { name: "is_read", data_type: "BOOLEAN" },
      { name: "created_at", data_type: "TIMESTAMP" },
    ],
  },
  {
    table_name: "user_activity_logs",
    module_name: "Core",
    description: "Activity logs per user: user_id, action, ip_address, user_agent, created_at. Use for audit or activity queries.",
    columns: [
      { name: "log_id", data_type: "SERIAL" },
      { name: "user_id", data_type: "INTEGER" },
      { name: "action", data_type: "VARCHAR(100)" },
      { name: "ip_address", data_type: "VARCHAR(45)" },
      { name: "user_agent", data_type: "TEXT" },
      { name: "created_at", data_type: "TIMESTAMP" },
    ],
  },
  {
    table_name: "support_tickets",
    module_name: "Core",
    description: "Support tickets per user (user_id): subject, description, status, priority, created_at. Use for support or ticket queries. No profile_id; links to users.",
    columns: [
      { name: "ticket_id", data_type: "SERIAL" },
      { name: "user_id", data_type: "INTEGER" },
      { name: "subject", data_type: "VARCHAR(255)" },
      { name: "description", data_type: "TEXT" },
      { name: "status", data_type: "VARCHAR(20)" },
      { name: "priority", data_type: "VARCHAR(20)" },
      { name: "created_at", data_type: "TIMESTAMP" },
    ],
  },
];

/** Tables used for NL2SQL context (exclude system tables). */
export const NL2SQL_TABLE_NAMES = new Set(
  SCHEMA_METADATA.map((t) => t.table_name)
);
