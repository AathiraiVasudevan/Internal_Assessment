const { MongoClient } = require('mongodb');

// --- CONFIGURATION ---
const uri = "mongodb://localhost:27017"; 
const dbName = "internal_assessment"; 
const collectionName = "candidates_pool"; 

// --- DATA GENERATOR ---
function generateData() {
    const skillsPool = ['JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'AWS', 'Docker'];
    const universities = ['MIT', 'Stanford', 'IIT', 'Oxford', 'NSUT', 'BITS Pilani'];
    const companies = ['Google', 'Meta', 'Amazon', 'Startup X', 'FinTech Corp', 'Global Solutions'];
    
    let allCandidates = [];

    const createCandidate = (index, type) => {
        const isStudent = type === 'Student';
        return {
            candidate_id: `${type.toUpperCase()}_${1000 + index}`,
            name: `${type} Candidate ${index}`,
            email: `${type.toLowerCase()}${index}@assessment.io`,
            category: type,
            experience_years: isStudent ? 0 : Math.floor(Math.random() * 8) + 2,
            background: isStudent 
                ? universities[Math.floor(Math.random() * universities.length)] 
                : companies[Math.floor(Math.random() * companies.length)],
            skills: skillsPool.sort(() => 0.5 - Math.random()).slice(0, 3),
            is_active: true,
            created_at: new Date()
        };
    };

    for (let i = 1; i <= 50; i++) allCandidates.push(createCandidate(i, 'Student'));
    for (let i = 1; i <= 50; i++) allCandidates.push(createCandidate(i, 'Lateral'));
    for (let i = 1; i <= 30; i++) allCandidates.push(createCandidate(i, 'Employee'));

    return allCandidates;
}

// --- PUSH TO DATABASE ---
async function pushToDB() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log(`Connected to MongoDB. Using DB: ${dbName}`);

        const db = client.db(dbName);
        const collection = db.collection(collectionName);

        const data = generateData();
        const result = await collection.insertMany(data);

        // Indexing for faster searching in your portal
        await collection.createIndex({ candidate_id: 1 }, { unique: true });
        await collection.createIndex({ category: 1 });

        console.log(`---`);
        console.log(`✅ Success: ${result.insertedCount} clean profiles added to '${collectionName}'`);
        console.log(`🚀 (Note: All score-related fields have been removed)`);

    } catch (err) {
        console.error("❌ Database Error:", err);
    } finally {
        await client.close();
    }
}

pushToDB();