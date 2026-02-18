const FIRST_NAMES_M = [
    "Aryan", "Rohan", "Arjun", "Vikram", "Rahul", "Aditya", "Karan", "Siddharth",
    "Akash", "Varun", "Rishabh", "Ankit", "Nikhil", "Prashant", "Vivek", "Rajesh",
];
const FIRST_NAMES_F = [
    "Saanvi", "Ananya", "Priya", "Kavya", "Neha", "Pooja", "Divya", "Shreya",
    "Riya", "Ishita", "Aarti", "Meera", "Kriti", "Tanvi", "Anjali", "Sneha",
];
const LAST_NAMES = [
    "Sharma", "Mehta", "Patel", "Singh", "Kumar", "Reddy", "Iyer", "Nair",
    "Gupta", "Joshi", "Desai", "Pillai", "Rao", "Khan", "Verma", "Agarwal",
];
const CITIES = [
    "Mumbai", "Delhi", "Bangalore", "Chennai", "Hyderabad", "Kolkata", "Pune", "Ahmedabad",
];
const STATES = {
    Mumbai: "Maharashtra", Delhi: "Delhi", Bangalore: "Karnataka", Chennai: "Tamil Nadu",
    Hyderabad: "Telangana", Kolkata: "West Bengal", Pune: "Maharashtra", Ahmedabad: "Gujarat",
};
const PROFESSIONS = [
    "Doctor", "Engineer", "Software Developer", "Teacher", "CA", "Architect", "Lawyer",
    "Data Scientist", "Business Analyst", "Marketing Manager", "Government Officer",
];
const RELIGIONS = ["Hindu", "Muslim", "Christian", "Sikh", "Jain"];
const CASTES = {
    Hindu: ["Brahmin", "Rajput", "Vaishya", "Kayastha", "Khatri"],
    Muslim: ["Sunni", "Shia"],
    Christian: ["Roman Catholic", "Protestant"],
    Sikh: ["Jat", "Khatri"],
    Jain: ["Digambar", "Shwetambar"],
};
const DEGREES = ["B.Tech", "MBBS", "B.Com", "MBA", "MCA", "B.Sc", "M.Sc", "PhD"];
const DIET = ["Veg", "Non-Veg", "Vegan"];
const RASHI = ["Mesh", "Vrishabh", "Mithun", "Karka", "Simha", "Kanya", "Tula", "Vrishchik", "Dhanu", "Makar", "Kumbh", "Meen"];
const MANGLIK = ["Yes", "No", "Not Specified"];
const MOTHER_TONGUES = ["Hindi", "Marathi", "Tamil", "Telugu", "Bengali", "Gujarati", "Punjabi", "English"];
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}
function pickN(arr, n) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}
export async function seed(knex) {
    // Clear in reverse dependency order (child tables first)
    const tables = [
        "profile_interests", "profile_shortlists", "profile_views", "chat_messages",
        "partner_preferences", "family_details", "privacy_settings", "profile_languages",
        "hobbies", "lifestyle_habits", "family_origin", "profile_locations", "user_horoscopes",
        "education_details", "career_details", "religious_values", "social_background",
        "user_documents", "physical_details", "profile_photos", "profile_contacts",
        "profiles", "user_subscriptions", "payment_transactions", "user_blocks",
        "notifications", "user_activity_logs", "support_tickets",
    ];
    for (const table of tables) {
        try {
            await knex(table).del();
        }
        catch {
            // table might not exist in older migrations
        }
    }
    await knex("users").del();
    const TOTAL = 500;
    console.log(`Seeding ${TOTAL} realistic matrimonial profiles...`);
    // 1. Users
    const userRows = Array.from({ length: TOTAL }, (_, i) => ({
        email: `member${i + 1}@match.com`,
        password_hash: "hashed_password",
        is_verified: true,
    }));
    const users = await knex("users").insert(userRows).returning("user_id");
    // 2. Profiles – varied gender, names, DOB, height, marital_status, mother_tongue
    const profiles = [];
    for (let i = 0; i < TOTAL; i++) {
        const isMale = i % 2 === 0;
        const first = isMale ? pick(FIRST_NAMES_M) : pick(FIRST_NAMES_F);
        const last = pick(LAST_NAMES);
        const birthYear = 1988 + (i % 15);
        profiles.push({
            user_id: users[i].user_id,
            first_name: first,
            last_name: last,
            gender: isMale ? "Male" : "Female",
            date_of_birth: `${birthYear}-${String(1 + (i % 12)).padStart(2, "0")}-15`,
            marital_status: i % 10 === 0 ? "Divorced" : "Never Married",
            height_cm: 155 + (i % 35),
            weight_kg: 50 + (i % 35),
            mother_tongue: pick(MOTHER_TONGUES),
        });
    }
    const profileRows = await knex("profiles").insert(profiles).returning("profile_id");
    // 3. Profile contacts
    await knex("profile_contacts").insert(profileRows.map((p, i) => ({
        profile_id: p.profile_id,
        mobile_number: `98765${String(10000 + i).slice(-5)}`,
        is_mobile_verified: i % 3 !== 0,
    })));
    // 4. Profile photos (one per profile)
    await knex("profile_photos").insert(profileRows.map((p) => ({
        profile_id: p.profile_id,
        photo_url: `https://example.com/photos/${p.profile_id}.jpg`,
        is_profile_picture: true,
        is_approved: true,
    })));
    // 5. Physical details
    await knex("physical_details").insert(profileRows.map((p, i) => ({
        profile_id: p.profile_id,
        body_type: pick(["Slim", "Average", "Athletic", "Heavy"]),
        complexion: pick(["Fair", "Wheatish", "Dark"]),
        blood_group: pick(["A+", "B+", "O+", "AB+", "A-", "B-"]),
        disability: "None",
    })));
    // 6. Social background – religion, caste
    await knex("social_background").insert(profileRows.map((p, i) => {
        const religion = pick(RELIGIONS);
        const castes = CASTES[religion];
        const caste = castes ? pick(castes) : null;
        return {
            profile_id: p.profile_id,
            religion,
            caste: caste ?? undefined,
            sub_caste: null,
            gothra: religion === "Hindu" && i % 3 === 0 ? "Bharadwaj" : null,
            sect: null,
        };
    }));
    // 7. Religious values
    await knex("religious_values").insert(profileRows.map((p) => ({
        profile_id: p.profile_id,
        observance_level: pick(["Liberal", "Moderate", "Very religious"]),
        hijab_preference: null,
        halal_preference: null,
    })));
    // 8. Career details – profession, income, work_location (city)
    await knex("career_details").insert(profileRows.map((p, i) => ({
        profile_id: p.profile_id,
        profession: pick(PROFESSIONS),
        company_name: `Company ${(i % 20) + 1}`,
        annual_income: 600000 + (i % 30) * 100000,
        currency: "INR",
        work_location: pick(CITIES),
    })));
    // 9. Education details
    await knex("education_details").insert(profileRows.map((p, i) => ({
        profile_id: p.profile_id,
        degree_type: pick(["UG", "PG", "Doctorate"]),
        specialization: pick(["Computer Science", "Medicine", "Commerce", "Engineering", "Arts"]),
        college_university: `University ${(i % 15) + 1}`,
        passing_year: 2010 + (i % 14),
    })));
    // 10. User horoscopes
    await knex("user_horoscopes").insert(profileRows.map((p) => ({
        profile_id: p.profile_id,
        place_of_birth: pick(CITIES),
        rashi: pick(RASHI),
        nakshatra: "Rohini",
        manglik_status: pick(MANGLIK),
        horoscope_url: null,
    })));
    // 11. Profile locations – city, state, country
    await knex("profile_locations").insert(profileRows.map((p, i) => {
        const city = pick(CITIES);
        return {
            profile_id: p.profile_id,
            country: "India",
            state: STATES[city] ?? "Maharashtra",
            city,
            zip_code: String(400000 + (i % 99999)).slice(0, 6),
            residency_status: "Citizen",
        };
    }));
    // 12. Family origin
    await knex("family_origin").insert(profileRows.map((p) => ({
        profile_id: p.profile_id,
        native_place: pick(CITIES),
        ancestral_origin: pick(["North India", "South India", "West India", "East India"]),
    })));
    // 13. Lifestyle habits – diet
    await knex("lifestyle_habits").insert(profileRows.map((p) => ({
        profile_id: p.profile_id,
        diet: pick(DIET),
        smoking: pick(["No", "Occasionally", "No"]),
        drinking: pick(["No", "Socially", "No"]),
    })));
    // 14. Hobbies (1–2 per profile)
    const hobbyList = ["Reading", "Travel", "Music", "Cooking", "Photography", "Yoga", "Dancing", "Cricket"];
    for (let i = 0; i < profileRows.length; i++) {
        const chosen = pickN(hobbyList, 1 + (i % 2));
        for (const h of chosen) {
            await knex("hobbies").insert({
                profile_id: profileRows[i].profile_id,
                hobby_name: h,
            });
        }
    }
    // 15. Profile languages
    for (let i = 0; i < profileRows.length; i++) {
        const langs = pickN(MOTHER_TONGUES, 1 + (i % 3));
        for (const lang of langs) {
            await knex("profile_languages").insert({
                profile_id: profileRows[i].profile_id,
                language_name: lang,
                proficiency_level: pick(["Native", "Fluent", "Basic"]),
            });
        }
    }
    // 16. Family details
    await knex("family_details").insert(profileRows.map((p, i) => ({
        profile_id: p.profile_id,
        father_occupation: pick(["Retired", "Business", "Government Job", "Private Job"]),
        mother_occupation: pick(["Homemaker", "Teacher", "Doctor", "Business"]),
        number_of_brothers: i % 4,
        number_of_sisters: i % 3,
        brothers_married: Math.floor((i % 4) / 2),
        sisters_married: Math.floor((i % 3) / 2),
        family_type: pick(["Nuclear", "Joint"]),
        family_values: pick(["Liberal", "Moderate", "Orthodox"]),
        family_status: pick(["Middle Class", "Upper Middle", "Rich"]),
    })));
    // 17. Partner preferences
    await knex("partner_preferences").insert(profileRows.map((p, i) => ({
        profile_id: p.profile_id,
        min_age: 25,
        max_age: 35,
        min_height: 155,
        max_height: 185,
        preferred_religions: null,
        preferred_castes: null,
        preferred_education: null,
        preferred_income_min: 500000,
        expectation_notes: "Looking for a compatible match.",
    })));
    // 18. Privacy settings
    await knex("privacy_settings").insert(profileRows.map((p) => ({
        profile_id: p.profile_id,
        show_photo_to: "All",
        show_phone_to: "Accepted Interests",
    })));
    // 19. Some profile views (sample activity)
    for (let i = 0; i < Math.min(200, profileRows.length - 1); i++) {
        await knex("profile_views").insert({
            viewer_id: profileRows[i].profile_id,
            viewed_id: profileRows[(i + 1) % profileRows.length].profile_id,
            viewed_at: new Date(Date.now() - i * 3600000),
        });
    }
    // 20. Some subscriptions
    const subPlans = ["Basic", "Gold", "Platinum"];
    for (let i = 0; i < 100; i++) {
        const uid = users[i].user_id;
        const plan = subPlans[i % 3];
        await knex("user_subscriptions").insert({
            user_id: uid,
            plan_name: plan,
            start_date: new Date(Date.now() - 30 * 24 * 3600000),
            end_date: new Date(Date.now() + 335 * 24 * 3600000),
            is_active: true,
        });
    }
    console.log("✅ Seeding complete. Profiles:", TOTAL);
}
//# sourceMappingURL=seed_data.js.map