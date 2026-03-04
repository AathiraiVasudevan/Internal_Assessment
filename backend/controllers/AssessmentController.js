const Assessment = require("../models/Assessment");
const Question = require("../models/Question");

// CREATE ASSESSMENT (basic info only)
const createAssessment = async (req, res) => {
  try {
    const assessment = await Assessment.create(req.body);
    res.status(201).json(assessment);
  } catch (err) {
    res.status(400).json({ error: err.message });
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

    const questions = await Question.find({ _id: { $in: questionIds } });

    // calculate total marks only
    const totalMarks = questions.reduce(
      (sum, q) => sum + (q.marks || 0),
      0
    );

    assessment.questions = questionIds;
    assessment.totalMarks = totalMarks;

    await assessment.save();

    res.json(assessment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createAssessment,
  addQuestionsToAssessment
};