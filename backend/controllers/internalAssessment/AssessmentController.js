const Assessment = require("../../models/internalAssessment/Assessment");
const Question = require("../../models/internalAssessment/Question");
const Candidate = require("../../models/Candidate");
const Attempt = require("../../models/Attempt");

const getAssessments = async (req, res) => {
  try {
    const assessments = await Assessment.find().sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: assessments.length,
      data: assessments
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assessments.",
      error: err.message
    });
  }
};

// CREATE ASSESSMENT (basic info only)
const createAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.create(req.body);
    res.status(201).json(assessment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const getAssessmentById = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const shouldPopulateQuestions = req.query.populateQuestions === "true";
    const query = Assessment.findById(assessmentId);
    if (shouldPopulateQuestions) {
      query.populate("questions");
    }
    const assessment = await query;
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }
    return res.status(200).json(assessment);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const assessment = await Assessment.findByIdAndUpdate(assessmentId, req.body, {
      new: true,
      runValidators: true,
    });
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }
    return res.status(200).json(assessment);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
};

const deleteAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
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

    return res.status(200).json({
      message: "Assessment deleted",
      unassignedCandidates: candidateIds.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// ADD QUESTIONS (no difficulty validation)
const addQuestionsToAssessment = async (req, res) => {
  try {
    const { assessmentId } = req.params;
    const { questionIds } = req.body;

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const normalizedIncomingIds = Array.isArray(questionIds)
      ? questionIds.map((id) => String(id))
      : [];

    const existingIds = (assessment.questions || []).map((id) => String(id));

    // Append new questions without removing already linked ones.
    const mergedIds = [
      ...existingIds,
      ...normalizedIncomingIds.filter((id) => !existingIds.includes(id))
    ];

    const questions = await Question.find({ _id: { $in: mergedIds } });

    // calculate total marks only
    const totalMarks = questions.reduce(
      (sum, q) => sum + (q.marks || 0),
      0
    );

    assessment.questions = mergedIds;
    assessment.totalMarks = totalMarks;
    assessment.totalQuestions = mergedIds.length;

    await assessment.save();

    res.json(assessment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const unlinkQuestionFromAssessment = async (req, res) => {
  try {
    const { assessmentId, questionId } = req.params;

    const assessment = await Assessment.findById(assessmentId);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found" });
    }

    const existingIds = (assessment.questions || []).map((id) => String(id));
    const remainingIds = existingIds.filter((id) => id !== String(questionId));

    const questions = await Question.find({ _id: { $in: remainingIds } });
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

    assessment.questions = remainingIds;
    assessment.totalMarks = totalMarks;
    assessment.totalQuestions = remainingIds.length;

    await assessment.save();

    return res.status(200).json({
      message: "Question unlinked from assessment.",
      data: assessment,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAssessments,
  createAssessment,
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  addQuestionsToAssessment,
  unlinkQuestionFromAssessment,
};
