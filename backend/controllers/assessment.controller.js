const Assessment = require("../models/Assessment");
const Candidate = require("../models/Candidate");
const Attempt = require("../models/Attempt");

exports.createAssessment = async (req, res) => {
  const { title } = req.body;

  const existing = await Assessment.findOne({ title });

  if (existing) {
    res.status(400);
    throw new Error("Assessment title already exists");
  }

  const assessment = await Assessment.create(req.body);

  res.status(201).json(assessment);
};

exports.getAllAssessments = async (req, res) => {
  const data = await Assessment.find();
  res.json(data);
};

exports.getAssessmentById = async (req, res) => {
  const data = await Assessment.findById(req.params.id);
  res.json(data);
};

exports.updateAssessment = async (req, res) => {
  const data = await Assessment.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(data);
};

exports.deleteAssessment = async (req, res) => {
  const assessmentId = req.params.id;

  const assessment = await Assessment.findById(assessmentId);
  if (!assessment) {
    res.status(404);
    throw new Error("Assessment not found");
  }

  const assignedCandidates = await Candidate.find(
    { assignedAssessment: assessmentId },
    { _id: 1 }
  );
  const candidateIds = assignedCandidates.map((candidate) => candidate._id);

  await Candidate.updateMany(
    { assignedAssessment: assessmentId },
    { $set: { assignedAssessment: null, reassignedAt: new Date() } }
  );

  if (candidateIds.length > 0) {
    await Attempt.deleteMany({
      candidate: { $in: candidateIds },
      assessment: assessmentId,
    });
  } else {
    await Attempt.deleteMany({ assessment: assessmentId });
  }

  await assessment.deleteOne();

  res.json({
    message: "Assessment deleted",
    unassignedCandidates: candidateIds.length,
  });
};
