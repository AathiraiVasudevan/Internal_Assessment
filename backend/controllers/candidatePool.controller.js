const fs = require("fs");
const csv = require("csv-parser");
const CandidatePool = require("../models/CandidatePool");
const Candidate = require("../models/Candidate");

/**
 * Shared Helper: Normalizes data from either CSV or JSON
 */
const normalizeCandidate = (data) => {
  const clean = {};
  // Handle both flat objects (Manual) and potentially messy CSV headers
  Object.keys(data).forEach(key => {
    clean[key.trim().toLowerCase()] = data[key] ? String(data[key]).trim() : "";
  });

  return {
    candidate_id: clean.candidate_id || `CAN-${Math.random().toString(36).toUpperCase().substring(2, 10)}`,
    name: clean.name || data.name, // Fallback to original key if lowercase trim failed
    email: (clean.email || data.email)?.toLowerCase(),
    category: clean.category || data.category || "Student",
    experience_years: parseInt(clean.experience_years || data.experience_years) || 0,
    background: clean.background || data.background || "",
    skills: clean.skills 
      ? clean.skills.split(/[|,\,]/).map(s => s.trim()).filter(Boolean)
      : Array.isArray(data.skills) ? data.skills : [],
    is_active: true
  };
};

// GET: Fetch and Enrich Pool
exports.getPoolCandidates = async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const pool = await CandidatePool.find(filter).lean();

    const enriched = await Promise.all(
      pool.map(async (candidate) => {
        const existing = await Candidate.findOne({ email: candidate.email })
          .populate("assignedAssessment", "title")
          .lean();

        return {
          ...candidate,
          alreadyAssigned: !!existing,
          assignedAssessmentName: existing?.assignedAssessment?.title || null
        };
      })
    );
    res.json(enriched);
  } catch (error) {
    res.status(500).json([]); 
  }
};

// POST: Manual Single Creation (The missing function!)
exports.createManualCandidate = async (req, res) => {
  try {
    const sanitized = normalizeCandidate(req.body);
    if (!sanitized.name || !sanitized.email) {
      return res.status(400).json({ success: false, message: "Name and Email are required" });
    }
    const candidate = await CandidatePool.create(sanitized);
    res.status(201).json({ success: true, message: "Candidate added to pool", data: candidate });
  } catch (err) {
    const isDup = err.code === 11000;
    res.status(isDup ? 409 : 500).json({ 
      success: false, 
      message: isDup ? "Email already exists in pool" : err.message 
    });
  }
};

// POST: Bulk CSV Upload
exports.uploadPoolCandidates = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

  const rows = [];
  const failed = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => rows.push(data))
    .on("end", async () => {
      try {
        let insertedCount = 0;
        for (const row of rows) {
          try {
            const sanitized = normalizeCandidate(row);
            await CandidatePool.create(sanitized);
            insertedCount++;
          } catch (err) {
            failed.push({ 
              email: row.email || "Unknown", 
              error: err.code === 11000 ? "Duplicate Email" : err.message 
            });
          }
        }
        res.status(200).json({ 
            success: true, 
            message: `Imported ${insertedCount} candidates.`,
            inserted: insertedCount, 
            failedCount: failed.length,
            failed: failed.length > 0 ? failed : null // Renamed to 'failed' to match frontend
        });
      } catch (error) {
        res.status(500).json({ success: false, message: error.message });
      } finally {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      }
    });
};