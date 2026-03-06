const fs = require("fs");
const csv = require("csv-parser");
const CandidatePool = require("../models/CandidatePool");

/**
 * Helper: Normalizes CSV Row Data
 */
const normalizeRow = (row) => ({
  candidate_id: row.candidate_id?.trim() || `CAN-${Math.random().toString(36).substring(7).toUpperCase()}`,
  name: row.name?.trim(),
  email: row.email?.trim()?.toLowerCase(),
  category: ["Student", "Lateral", "Employee"].includes(row.category?.trim()) ? row.category.trim() : "Student",
  experience_years: parseInt(row.experience_years) || 0,
  background: row.background?.trim() || "",
  skills: row.skills ? row.skills.split(/[|,]+/).map(s => s.trim()).filter(Boolean) : [],
  is_active: true
});

/**
 * WORKFLOW: CSV Bulk Ingestion
 */
exports.uploadPoolCandidates = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No CSV file provided" });

  const results = [];
  const failed = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("error", () => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return res.status(500).json({ success: false, message: "Stream processing failed" });
    })
    .on("end", async () => {
      try {
        const operations = results.map(async (row) => {
          const data = normalizeRow(row);
          if (!data.name || !data.email) throw new Error("Missing Name/Email");
          return await CandidatePool.create(data);
        });

        const settled = await Promise.allSettled(operations);
        
        settled.forEach((res, index) => {
          if (res.status === "rejected") {
            failed.push({
              email: results[index].email || "Unknown",
              error: res.reason.code === 11000 ? "Duplicate Entry" : res.reason.message
            });
          }
        });

        res.status(200).json({
          success: true,
          inserted: results.length - failed.length,
          failedCount: failed.length,
          failed: failed.length > 0 ? failed : null,
          message: `Processed ${results.length} records.`
        });
      } catch (err) {
        res.status(500).json({ success: false, message: "Database write failure" });
      } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    });
};

/**
 * WORKFLOW: Manual Single Creation
 */
exports.createManualCandidate = async (req, res) => {
  try {
    const data = normalizeRow(req.body);
    const candidate = await CandidatePool.create(data);
    res.status(201).json({ success: true, data: candidate, message: "Candidate added to pool" });
  } catch (err) {
    const isDup = err.code === 11000;
    res.status(isDup ? 409 : 400).json({ 
      success: false, 
      message: isDup ? "Email already exists in pool" : err.message 
    });
  }
};

/**
 * WORKFLOW: Fetch Pool
 */
exports.getPoolCandidates = async (req, res) => {
  try {
    const candidates = await CandidatePool.find().sort({ created_at: -1 });
    res.json(candidates);
  } catch (err) {
    res.status(500).json([]);
  }
};