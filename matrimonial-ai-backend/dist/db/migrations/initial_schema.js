export async function up(knex) {
    await knex.raw('CREATE EXTENSION IF NOT EXISTS vector;');
    // Use raw SQL to execute the 38-table block you validated
    await knex.raw(`
    CREATE TABLE schema_registry (
    id SERIAL PRIMARY KEY,
    table_name TEXT UNIQUE,
    module_name TEXT, -- e.g., 'Astrology', 'Core'
    description TEXT,
    embedding vector(1536), -- Vector for semantic search
    full_ddl TEXT
);
 
-- 1. Base user accounts
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE
);

-- 2. Basic bio-data
CREATE TABLE profiles (
    profile_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    gender VARCHAR(10) CHECK (gender IN ('Male', 'Female', 'Other')),
    date_of_birth DATE NOT NULL,
    height_cm INTEGER,
    weight_kg INTEGER,
    marital_status VARCHAR(50),
    mother_tongue VARCHAR(100)
);

-- 3. Contact details
CREATE TABLE profile_contacts (
    contact_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    mobile_number VARCHAR(20),
    alternate_number VARCHAR(20),
    whatsapp_number VARCHAR(20),
    is_mobile_verified BOOLEAN DEFAULT FALSE
);

-- 4. Photos and Albums
CREATE TABLE profile_photos (
    photo_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    photo_url TEXT NOT NULL,
    is_profile_picture BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- 5. Physical Attributes
CREATE TABLE physical_details (
    detail_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    body_type VARCHAR(50), -- Athletic, Slim, Average, Heavy
    complexion VARCHAR(50),
    blood_group VARCHAR(5),
    disability VARCHAR(255) DEFAULT 'None'
);

-- 6. Identification Documents (KYC)
CREATE TABLE user_documents (
    doc_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    document_type VARCHAR(50), -- Passport, Aadhar, Driving License
    document_url TEXT,
    verification_status VARCHAR(20) DEFAULT 'Pending'
);

-- 7. Religion and Caste
CREATE TABLE social_background (
    social_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    religion VARCHAR(100),
    caste VARCHAR(100),
    sub_caste VARCHAR(100),
    gothra VARCHAR(100),
    sect VARCHAR(100)
);

-- 8. Master Religion List
CREATE TABLE master_religions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE
);

-- 9. Master Caste List
CREATE TABLE master_castes (
    id SERIAL PRIMARY KEY,
    religion_id INTEGER REFERENCES master_religions(id),
    name VARCHAR(100)
);

-- 10. Religious Values
CREATE TABLE religious_values (
    val_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    observance_level VARCHAR(50), -- Very religious, Liberal, etc.
    hijab_preference VARCHAR(50),
    halal_preference BOOLEAN
);

-- 11. Career Details
CREATE TABLE career_details (
    career_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    profession VARCHAR(255),
    company_name VARCHAR(255),
    annual_income NUMERIC(15, 2),
    currency VARCHAR(10) DEFAULT 'INR',
    work_location VARCHAR(255)
);

-- 12. Education Details
CREATE TABLE education_details (
    edu_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    degree_type VARCHAR(255), -- UG, PG, Doctorate
    specialization VARCHAR(255),
    college_university VARCHAR(255),
    passing_year INTEGER
);

-- 13. Master Professions
CREATE TABLE master_professions (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100),
    title VARCHAR(100)
);

-- 14. Master Education
CREATE TABLE master_degrees (
    id SERIAL PRIMARY KEY,
    degree_name VARCHAR(100)
);


-- 15. Horoscope Details
CREATE TABLE user_horoscopes (
    horo_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    place_of_birth VARCHAR(255),
    time_of_birth TIME,
    rashi VARCHAR(100),
    nakshatra VARCHAR(100),
    manglik_status VARCHAR(50) DEFAULT 'Not Specified',
    horoscope_url TEXT
);

-- 16. Astro Matches Cache
CREATE TABLE astro_compatibility (
    match_id SERIAL PRIMARY KEY,
    profile_id_1 INTEGER REFERENCES profiles(profile_id),
    profile_id_2 INTEGER REFERENCES profiles(profile_id),
    guna_score INTEGER,
    compatibility_report TEXT
);

-- 17. Master Nakshatras
CREATE TABLE master_nakshatras (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100)
); 

-- 18. Current Address
CREATE TABLE profile_locations (
    loc_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    country VARCHAR(100),
    state VARCHAR(100),
    city VARCHAR(100),
    zip_code VARCHAR(20),
    residency_status VARCHAR(50) -- Citizen, PR, H1B
);

-- 19. Family Origin
CREATE TABLE family_origin (
    origin_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    native_place VARCHAR(255),
    ancestral_origin VARCHAR(255)
);

-- 20. Master Cities
CREATE TABLE master_cities (
    id SERIAL PRIMARY KEY,
    city_name VARCHAR(100),
    state_name VARCHAR(100),
    country_name VARCHAR(100)
); 

-- 21. Dietary Habits
CREATE TABLE lifestyle_habits (
    life_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    diet VARCHAR(50), -- Veg, Non-Veg, Vegan
    smoking VARCHAR(50),
    drinking VARCHAR(50)
);

-- 22. Hobbies & Interests
CREATE TABLE hobbies (
    hobby_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    hobby_name VARCHAR(100)
);

-- 23. Language Proficiency
CREATE TABLE profile_languages (
    lang_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    language_name VARCHAR(100),
    proficiency_level VARCHAR(50) -- Fluent, Basic, Native
); 

-- 24. Expressed Interests
CREATE TABLE profile_interests (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES profiles(profile_id),
    receiver_id INTEGER REFERENCES profiles(profile_id),
    status VARCHAR(20) DEFAULT 'Pending', -- Accepted, Rejected
    sent_at TIMESTAMP DEFAULT NOW()
);

-- 25. Shortlists (Bookmarks)
CREATE TABLE profile_shortlists (
    id SERIAL PRIMARY KEY,
    shortlisted_by INTEGER REFERENCES profiles(profile_id),
    shortlisted_profile_id INTEGER REFERENCES profiles(profile_id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 26. User Chats
CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(user_id),
    receiver_id INTEGER REFERENCES users(user_id),
    message_text TEXT,
    sent_at TIMESTAMP DEFAULT NOW()
);

-- 27. Profile Views
CREATE TABLE profile_views (
    id SERIAL PRIMARY KEY,
    viewer_id INTEGER REFERENCES profiles(profile_id),
    viewed_id INTEGER REFERENCES profiles(profile_id),
    viewed_at TIMESTAMP DEFAULT NOW()
); 

-- 28. Subscriptions
CREATE TABLE user_subscriptions (
    sub_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    plan_name VARCHAR(100), -- Basic, Gold, Platinum
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN
);

-- 29. Payment History
CREATE TABLE payment_transactions (
    txn_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    amount NUMERIC(10, 2),
    status VARCHAR(20),
    txn_date TIMESTAMP DEFAULT NOW()
);

-- 30. Privacy Settings
CREATE TABLE privacy_settings (
    setting_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    show_photo_to VARCHAR(20) DEFAULT 'All', -- Premium Only, Contacts Only
    show_phone_to VARCHAR(20) DEFAULT 'Accepted Interests'
);

-- 31. Blocklist
CREATE TABLE user_blocks (
    id SERIAL PRIMARY KEY,
    blocker_id INTEGER REFERENCES users(user_id),
    blocked_id INTEGER REFERENCES users(user_id),
    blocked_at TIMESTAMP DEFAULT NOW()
); 

-- 32. Family Details (Crucial for Matrimonial Logic)
CREATE TABLE family_details (
    family_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    father_occupation VARCHAR(255),
    mother_occupation VARCHAR(255),
    number_of_brothers INTEGER DEFAULT 0,
    number_of_sisters INTEGER DEFAULT 0,
    brothers_married INTEGER DEFAULT 0,
    sisters_married INTEGER DEFAULT 0,
    family_type VARCHAR(50), -- Joint, Nuclear
    family_values VARCHAR(50), -- Orthodox, Moderate, Liberal
    family_status VARCHAR(50) -- Middle Class, Upper Middle, Rich
);

-- 33. Partner Preferences (Complex Search Logic)
-- This table allows NL2SQL to compare a user's requirements with other profiles
CREATE TABLE partner_preferences (
    pref_id SERIAL PRIMARY KEY,
    profile_id INTEGER REFERENCES profiles(profile_id),
    min_age INTEGER,
    max_age INTEGER,
    min_height INTEGER,
    max_height INTEGER,
    preferred_religions TEXT, -- Stored as comma-separated or JSON
    preferred_castes TEXT,
    preferred_education TEXT,
    preferred_income_min NUMERIC(15, 2),
    expectation_notes TEXT
);

-- 34. Success Stories (Marketing Data)
CREATE TABLE success_stories (
    story_id SERIAL PRIMARY KEY,
    partner_1_id INTEGER REFERENCES profiles(profile_id),
    partner_2_id INTEGER REFERENCES profiles(profile_id),
    wedding_date DATE,
    testimonial TEXT,
    story_image_url TEXT,
    is_published BOOLEAN DEFAULT FALSE
);

-- 35. Notification Logs (For engagement analysis)
CREATE TABLE notifications (
    notif_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    title VARCHAR(255),
    message TEXT,
    notif_type VARCHAR(50), -- Interest, Message, System
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 36. User Activity Logs (For Admin reasoning)
CREATE TABLE user_activity_logs (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    action VARCHAR(100), -- 'Profile Update', 'Search', 'Login'
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 37. Support Tickets (CRM Module)
CREATE TABLE support_tickets (
    ticket_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    subject VARCHAR(255),
    description TEXT,
    status VARCHAR(20) DEFAULT 'Open', -- Open, Resolved, Closed
    priority VARCHAR(20) DEFAULT 'Medium',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 38. Semantic Cache (Crucial for NL2SQL Cost Reduction)
-- Stores previous natural language questions and their SQL to save LLM tokens
CREATE TABLE semantic_cache (
    id SERIAL PRIMARY KEY,
    question_text TEXT UNIQUE,
    question_embedding vector(1536),
    generated_sql TEXT,
    hit_count INTEGER DEFAULT 1,
    last_accessed TIMESTAMP DEFAULT NOW()
); 

  `);
}
export async function down(knex) {
    // Optional: Drop tables in reverse order if you need to roll back
    await knex.raw('DROP TABLE IF EXISTS schema_registry CASCADE;');
}
//# sourceMappingURL=initial_schema.js.map