const Candidate = require("../models/Candidate");
const Attempt = require("../models/Attempt");
const candidateService = require("../services/candidate.service");
const CandidatePool = require("../models/CandidatePool");
const Assessment = require("../models/Assessment");
const InternalAssessment = require("../models/internalAssessment/Assessment");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { parseDetailedAnalysisFromPdf } = require("../utils/reportParser");

const normalizeFileName = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const findPdfForCandidate = (candidateName, directories = []) => {
  const normalizedCandidateName = normalizeFileName(candidateName);
  if (!normalizedCandidateName) return null;

  let bestMatch = null;

  for (const directory of directories) {
    if (!directory || !fs.existsSync(directory)) continue;

    const files = fs
      .readdirSync(directory)
      .filter((name) => name.toLowerCase().endsWith(".pdf"))
      .map((name) => {
        const filePath = path.join(directory, name);
        return {
          path: filePath,
          normalizedName: normalizeFileName(name),
          modifiedAt: fs.statSync(filePath).mtimeMs
        };
      })
      .filter((file) => file.normalizedName.includes(normalizedCandidateName));

    for (const file of files) {
      if (!bestMatch || file.modifiedAt > bestMatch.modifiedAt) {
        bestMatch = file;
      }
    }
  }

  return bestMatch ? bestMatch.path : null;
};

const resolveReportPath = (candidate, attempt) => {
  if (attempt?.reportPath && fs.existsSync(attempt.reportPath)) {
    return attempt.reportPath;
  }

  const configuredDir = process.env.CANDIDATE_REPORTS_DIR;
  const directoriesToScan = [
    configuredDir,
    path.join(process.cwd(), "reports"),
    path.join(process.cwd(), "uploads"),
    path.join(os.homedir(), "Downloads")
  ];

  return findPdfForCandidate(candidate?.name, directoriesToScan);
};

const getAssessmentCategoryRules = (assessmentInfo) => {
  const { assessment } = assessmentInfo || {};

  if (Array.isArray(assessment?.allowedCategories) && assessment.allowedCategories.length > 0) {
    return assessment.allowedCategories;
  }

  const type = String(assessment?.assessmentType || "").toLowerCase();
  if (type.includes("campus")) return ["Student"];
  if (type.includes("lateral")) return ["Lateral"];
  if (type.includes("employee")) return ["Employee"];

  return [];
};

const resolveAssessmentById = async (assessmentId) => {
  if (!assessmentId) return null;

  const mainAssessment = await Assessment.findById(assessmentId);
  if (mainAssessment) return { assessment: mainAssessment, source: "main" };

  const internalAssessment = await InternalAssessment.findById(assessmentId);
  if (internalAssessment) return { assessment: internalAssessment, source: "internal" };

  return null;
};

const isCandidateEligibleForAssessment = (assessmentInfo, candidateCategory) => {
  const allowed = getAssessmentCategoryRules(assessmentInfo);
  if (!allowed.length) return true;
  return allowed.includes(candidateCategory);
};

// @desc    Create a single candidate and initial attempt
exports.createCandidate = async (req, res) => {
  const { name, email, assignedAssessment } = req.body;
  const existingEmail = await Candidate.findOne({ email });

  if (existingEmail) {
    res.status(400);
    throw new Error("Email already exists");
  }

  const candidate = await Candidate.create({
    name,
    email,
    assignedAssessment,
    reassignedAt: null
  });

  await Attempt.create({
    candidate: candidate._id,
    assessment: assignedAssessment,
    status: "pending",
    isReassignedAttempt: false
  });

  res.status(201).json(candidate);
};

// @desc    Assign one candidate from the pool
exports.assignCandidateFromPool = async (req, res) => {
  const { poolId, assignedAssessment } = req.body;

  const poolCandidate = await CandidatePool.findById(poolId);
  if (!poolCandidate) {
    res.status(404);
    throw new Error("Pool candidate not found");
  }

  const assessmentInfo = await resolveAssessmentById(assignedAssessment);
  if (!assessmentInfo) {
    res.status(404);
    throw new Error("Assessment not found");
  }

  if (!poolCandidate.is_active) {
    res.status(400);
    throw new Error("Candidate is inactive");
  }

  if (!isCandidateEligibleForAssessment(assessmentInfo, poolCandidate.category)) {
    res.status(400);
    throw new Error(`${poolCandidate.category} candidates are not allowed for this assessment`);
  }

  const existing = await Candidate.findOne({ email: poolCandidate.email });
  if (existing) {
    res.status(400);
    throw new Error("Candidate already assigned");
  }

  const candidate = await Candidate.create({
    name: poolCandidate.name,
    email: poolCandidate.email,
    category: poolCandidate.category,
    assignedAssessment,
    reassignedAt: null
  });

  await Attempt.create({
    candidate: candidate._id,
    assessment: assignedAssessment,
    status: "pending",
    isReassignedAttempt: false
  });

  res.status(201).json({ message: "Candidate assigned successfully", candidate });
};

// @desc    Bulk assign multiple candidates from the pool
exports.bulkAssignFromPool = async (req, res) => {
  const { poolIds, assignedAssessment } = req.body;

  if (!Array.isArray(poolIds) || poolIds.length === 0) {
    res.status(400);
    throw new Error("No candidates selected");
  }

  const assessmentInfo = await resolveAssessmentById(assignedAssessment);
  if (!assessmentInfo) {
    res.status(404);
    throw new Error("Assessment not found");
  }

  const results = [];
  const errors = [];

  for (const poolId of poolIds) {
    try {
      const poolCandidate = await CandidatePool.findById(poolId);
      
      if (!poolCandidate) {
        errors.push({ id: poolId, reason: "Not found in pool" });
        continue;
      }

      // 1. Server-Side Eligibility Check
      if (!isCandidateEligibleForAssessment(assessmentInfo, poolCandidate.category)) {
        errors.push({ email: poolCandidate.email, reason: `Category ${poolCandidate.category} not allowed` });
        continue;
      }

      // 2. Avoid Duplicates
      const exists = await Candidate.findOne({ email: poolCandidate.email });
      if (exists) {
        errors.push({ email: poolCandidate.email, reason: "Already assigned" });
        continue;
      }

      // 3. Create Candidate & Attempt
      const candidate = await Candidate.create({
        name: poolCandidate.name,
        email: poolCandidate.email,
        category: poolCandidate.category,
        assignedAssessment,
        reassignedAt: null
      });

      await Attempt.create({
        candidate: candidate._id,
        assessment: assignedAssessment,
        status: "pending",
        isReassignedAttempt: false
      });

      results.push(candidate);
    } catch (err) {
      errors.push({ id: poolId, reason: err.message });
    }
  }

  res.json({ 
    message: "Bulk assignment completed", 
    assignedCount: results.length,
    failedCount: errors.length,
    errors 
  });
};

// @desc   Bulk Reassign existing candidates to a new assessment
exports.bulkReassignCandidates = async (req, res) => {
  const { candidateIds, newAssessmentId } = req.body;

  if (!candidateIds?.length || !newAssessmentId) {
    res.status(400);
    throw new Error("candidateIds and newAssessmentId are required");
  }

  const assessmentInfo = await resolveAssessmentById(newAssessmentId);
  if (!assessmentInfo) {
    res.status(404);
    throw new Error("Assessment not found");
  }

  let reassigned = 0;
  const skipped = [];

  for (const id of candidateIds) {
    const candidate = await Candidate.findById(id);
    if (!candidate) {
      skipped.push({ id, reason: "Candidate not found" });
      continue;
    }

    // 1. Final Category Validation
    if (!isCandidateEligibleForAssessment(assessmentInfo, candidate.category)) {
      skipped.push({ name: candidate.name, reason: `${candidate.category} not allowed for this assessment` });
      continue;
    }

    // 2. Update Candidate Target
    candidate.assignedAssessment = newAssessmentId;
    candidate.reassignedAt = new Date();
    await candidate.save();

    // 3. Progress Reset: Delete any non-completed attempts for this candidate
    // This enforces the "Warning" shown in your UI screenshot
    await Attempt.deleteMany({
      candidate: candidate._id,
      status: { $ne: "completed" }
    });

    // 4. Initialize New Attempt
    await Attempt.create({
      candidate: candidate._id,
      assessment: newAssessmentId,
      status: "pending",
      isReassignedAttempt: true
    });

    reassigned++;
  }

  res.json({ 
    success: true,
    message: "Bulk reassignment completed", 
    reassigned, 
    skipped 
  });
};

// @desc    Get detailed view for a single candidate's result
exports.getCandidateDetail = async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);

  if (!candidate) {
    res.status(404);
    throw new Error("Candidate not found");
  }

  const assessmentInfo = await resolveAssessmentById(candidate.assignedAssessment);
  const assignedAssessment = assessmentInfo?.assessment;
  if (!assignedAssessment) {
    res.status(404);
    throw new Error("Assigned assessment not found for candidate");
  }

  // Find the attempt linked to the current assigned assessment
  const attempt = await Attempt.findOne({ 
    candidate: candidate._id,
    assessment: candidate.assignedAssessment 
  }).sort({ createdAt: -1, _id: -1 });

  if (!attempt) {
    res.status(404);
    throw new Error("Attempt not found");
  }

  const totalMarks = assignedAssessment.totalMarks || 100;
  const score = attempt.score || 0;
  const percentage = Math.round((score / totalMarks) * 100);
  const isSubmitted = attempt.status === "completed" || Boolean(attempt.completedAt);
  const startTime = attempt.startedAt || attempt.createdAt;
  const endTime = attempt.completedAt;
  const computedTimeTakenSeconds =
    startTime && endTime
      ? Math.max(
          0,
          Math.round(
            (new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000
          )
        )
      : null;
  const computedTimeTakenMinutes =
    computedTimeTakenSeconds !== null
      ? Math.round(computedTimeTakenSeconds / 60)
      : attempt.timeTaken ?? null;

  let reportPath = null;
  let detailedAnalysis = [];
  let questionStats = attempt.questionStats || { answered: null, total: null };

  try {
    if (isSubmitted) {
      reportPath = resolveReportPath(candidate, attempt);
    }
    if (isSubmitted && reportPath) {
      detailedAnalysis = parseDetailedAnalysisFromPdf(reportPath);
      const total = detailedAnalysis.length;
      const answered = detailedAnalysis.filter(
        (item) => item?.status === "accepted" || item?.status === "rejected"
      ).length;

      questionStats = { answered, total };

      const shouldPersistStats =
        attempt?.questionStats?.answered !== answered ||
        attempt?.questionStats?.total !== total;

      if (shouldPersistStats) {
        attempt.questionStats = questionStats;
        await attempt.save();
      }
    }
  } catch (error) {
    console.error("Detailed analysis parsing failed:", error.message);
  }

  res.json({
    candidate: {
      id: candidate._id,
      name: candidate.name,
      email: candidate.email,
      reassignedAt: candidate.reassignedAt
    },
    assessment: {
      id: assignedAssessment._id,
      name: assignedAssessment.title,
      totalMarks,
      passMark: assignedAssessment.passMark ?? assignedAssessment.passingScore ?? 0
    },
    attempt: {
      id: attempt._id,
      score,
      percentage,
      status: attempt.status,
      completedAt: attempt.completedAt,
      timeTaken: computedTimeTakenMinutes,
      timeTakenSeconds: computedTimeTakenSeconds,
      result: attempt.result,
      sectionBreakdown: attempt.sectionBreakdown,
      questionStats,
      detailedAnalysis
    },
    report: {
      available: isSubmitted && Boolean(reportPath),
      downloadUrl: isSubmitted && reportPath ? `/api/candidates/${candidate._id}/report` : null
    }
  });
};

// @desc    Download candidate report PDF
exports.downloadCandidateReport = async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);

  if (!candidate) {
    res.status(404);
    throw new Error("Candidate not found");
  }

  const assessmentInfo = await resolveAssessmentById(candidate.assignedAssessment);
  const assignedAssessment = assessmentInfo?.assessment;
  if (!assignedAssessment) {
    res.status(404);
    throw new Error("Assigned assessment not found for candidate");
  }

  const attempt = await Attempt.findOne({
    candidate: candidate._id,
    assessment: assignedAssessment._id
  }).sort({ createdAt: -1, _id: -1 });

  if (!attempt) {
    res.status(404);
    throw new Error("Attempt not found");
  }

  const isSubmitted = attempt.status === "completed" || Boolean(attempt.completedAt);
  if (!isSubmitted) {
    res.status(400);
    throw new Error("Report can be downloaded only after test submission");
  }

  const reportPath = resolveReportPath(candidate, attempt);

  if (!reportPath || !fs.existsSync(reportPath)) {
    res.status(404);
    throw new Error("Report PDF not found");
  }

  const safeName = `${candidate.name || "candidate"}-report.pdf`
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-");

  res.download(reportPath, safeName);
};

// --- Standard CRUD ---

exports.getAllCandidates = async (req, res) => {
  const data = await Candidate.find();
  res.json(data);
};

exports.getCandidateById = async (req, res) => {
  const data = await Candidate.findById(req.params.id);
  if (!data) {
    res.status(404);
    throw new Error("Candidate not found");
  }
  res.json(data);
};

exports.updateCandidate = async (req, res) => {
  const data = await Candidate.findByIdAndUpdate(req.params.id, req.body, { new: true });
  if (!data) {
    res.status(404);
    throw new Error("Candidate not found");
  }
  res.json(data);
};

exports.deleteCandidate = async (req, res) => {
  const data = await Candidate.findById(req.params.id);
  if (!data) {
    res.status(404);
    throw new Error("Candidate not found");
  }
  await data.deleteOne();
  res.json({ message: "Candidate deleted" });
};

exports.getCandidateListing = async (req, res) => {
  const data = await candidateService.getCandidateListing();
  res.json(data);
};
