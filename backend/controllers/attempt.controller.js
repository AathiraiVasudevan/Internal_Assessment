const Assessment = require("../models/Assessment");
const Candidate = require("../models/Candidate");
const Attempt = require("../models/Attempt");

// @desc    Create a new attempt
exports.createAttempt = async (req, res) => {
  const { candidate, assessment, score, status } = req.body;

  const candidateDoc = await Candidate.findById(candidate);
  if (!candidateDoc) {
    res.status(404);
    throw new Error("Candidate not found");
  }

  const assessmentDoc = await Assessment.findById(assessment);
  if (!assessmentDoc) {
    res.status(404);
    throw new Error("Assessment not found");
  }

  if (score && score > assessmentDoc.totalMarks) {
    res.status(400);
    throw new Error("Score cannot exceed total marks");
  }

  if (status === "completed") {
    const existingCompleted = await Attempt.findOne({
      candidate,
      assessment,
      status: "completed"
    });

    if (existingCompleted) {
      res.status(400);
      throw new Error("Candidate already has a completed attempt");
    }
  }

  const attempt = await Attempt.create(req.body);
  res.status(201).json(attempt);
};

// @desc    Mark attempt as in-progress and set start time
exports.startAttempt = async (req, res) => {
  const attempt = await Attempt.findById(req.params.id);

  if (!attempt) {
    res.status(404);
    throw new Error("Attempt not found");
  }

  if (attempt.status === "completed") {
    res.status(400);
    throw new Error("Cannot start a completed attempt");
  }

  if (attempt.status === "in-progress") {
    res.status(400);
    throw new Error("Test already started");
  }

  attempt.status = "in-progress";
  attempt.startedAt = new Date();

  await attempt.save();

  res.json({
    message: "Test started successfully",
    attempt
  });
};

// @desc    Submit attempt, calculate scores, and PERSIST timeTaken
exports.submitAttempt = async (req, res) => {
  const attempt = await Attempt.findById(req.params.id).populate("assessment");

  if (!attempt) {
    res.status(404);
    throw new Error("Attempt not found");
  }

  if (attempt.status !== "in-progress") {
    res.status(400);
    throw new Error("Test is not in progress");
  }

  if (!attempt.assessment) {
    res.status(400);
    throw new Error("Associated assessment not found");
  }

  const totalMarks = attempt.assessment.totalMarks;
  const passMark = attempt.assessment.passMark;

  // 1. Calculate Section Scores
  const mcqTotal = Math.floor(totalMarks * 0.3);
  const codingTotal = Math.floor(totalMarks * 0.5);
  const descriptiveTotal = totalMarks - mcqTotal - codingTotal;

  const mcqScore = Math.floor(Math.random() * mcqTotal);
  const codingScore = Math.floor(Math.random() * codingTotal);
  const descriptiveScore = Math.floor(Math.random() * descriptiveTotal);

  const totalScore = mcqScore + codingScore + descriptiveScore;
  const percentage = Math.round((totalScore / totalMarks) * 100);
  const result = percentage >= passMark ? "pass" : "fail";

  // 2. Set Basic Data
  attempt.score = totalScore;
  attempt.status = "completed";
  attempt.completedAt = new Date();
  attempt.result = result;

  // 3. CALCULATE AND PERSIST TIME TAKEN (Crucial Fix)
  if (attempt.startedAt && attempt.completedAt) {
    const diffMs = attempt.completedAt - attempt.startedAt;
    // We save this into the DB field 'timeTaken'
    attempt.timeTaken = Math.max(0, Math.round(diffMs / 60000)); 
  }

  attempt.sectionBreakdown = {
    mcq: { score: mcqScore, total: mcqTotal },
    coding: { score: codingScore, total: codingTotal },
    descriptive: { score: descriptiveScore, total: descriptiveTotal }
  };

  // 4. Save to MongoDB
  await attempt.save();

  res.json({
    message: "Test submitted successfully",
    score: totalScore,
    totalMarks,
    percentage,
    passMark,
    result,
    timeTaken: attempt.timeTaken, // Now pulls from DB
    sectionBreakdown: attempt.sectionBreakdown
  });
};

// @desc    Get all attempts
exports.getAllAttempts = async (req, res) => {
  const data = await Attempt.find()
    .populate("candidate")
    .populate("assessment");
  res.json(data);
};

// @desc    Get single attempt by ID
exports.getAttemptById = async (req, res) => {
  const data = await Attempt.findById(req.params.id)
    .populate("candidate")
    .populate("assessment");

  if (!data) {
    res.status(404);
    throw new Error("Attempt not found");
  }
  res.json(data);
};

// @desc    Update attempt data
exports.updateAttempt = async (req, res) => {
  const attempt = await Attempt.findById(req.params.id);

  if (!attempt) {
    res.status(404);
    throw new Error("Attempt not found");
  }

  const assessmentDoc = await Assessment.findById(attempt.assessment);

  if (req.body.score && req.body.score > assessmentDoc.totalMarks) {
    res.status(400);
    throw new Error("Score cannot exceed total marks");
  }

  const updated = await Attempt.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );

  res.json(updated);
};

// @desc    Delete attempt
exports.deleteAttempt = async (req, res) => {
  const attempt = await Attempt.findById(req.params.id);

  if (!attempt) {
    res.status(404);
    throw new Error("Attempt not found");
  }

  await attempt.deleteOne();
  res.json({ message: "Attempt deleted" });
};