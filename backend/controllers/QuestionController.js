const Question = require("../models/Question");
const Assessment = require("../models/Assessment");
const csv = require("csv-parser");
const { Readable } = require("stream");

/* ===============================
   CREATE QUESTION
================================= */
const createQuestion = async (req, res) => {
  try {
    const question = await Question.create(req.body);

    res.status(201).json({
      success: true,
      message: "Question created successfully",
      data: question
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to create question",
      error: err.message
    });
  }
};

/* ===============================
   GET ALL QUESTIONS
================================= */
const getQuestions = async (req, res) => {
  try {
    const questions = await Question.find().collation({
      locale: "en",
      strength: 2
    });

    res.status(200).json({
      success: true,
      count: questions.length,
      data: questions
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch questions.",
      error: err.message
    });
  }
};

/* ===============================
   BULK UPLOAD QUESTIONS (CSV)
================================= */
const bulkUploadQuestions = async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({
      success: false,
      message: "CSV file is required. Use field name 'file'."
    });
  }

  const rows = [];
  const failed = [];

  const normalizeType = (value) => {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "mcq") return "MCQ";
    if (raw === "coding") return "Coding";
    if (raw === "descriptive") return "Descriptive";
    return null;
  };

  const parseList = (value) =>
    String(value || "")
      .split("|")
      .map((item) => item.trim())
      .filter(Boolean);

  const parseJsonSafe = (value, fallback) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const stream = Readable.from(req.file.buffer);

  await new Promise((resolve, reject) => {
    stream
      .pipe(csv())
      .on("data", (row) => rows.push(row))
      .on("end", resolve)
      .on("error", reject);
  });

  let inserted = 0;

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const title = String(row.title || "").trim();
    const type = normalizeType(row.type);
    const difficultyLevel = String(row.difficultyLevel || "Easy").trim();
    const marks = Number(row.marks || 1);

    if (!title || !type) {
      failed.push({
        row: index + 1,
        reason: "title and valid type are required"
      });
      continue;
    }

    const payload = {
      title,
      type,
      difficultyLevel: ["Easy", "Medium", "Hard"].includes(difficultyLevel)
        ? difficultyLevel
        : "Easy",
      marks: Number.isFinite(marks) && marks > 0 ? marks : 1,
      description: String(row.description || "").trim(),
      options: [],
      correctAnswer: undefined,
      starterCode: String(row.starterCode || "").trim(),
      programmingLanguage: parseList(row.programmingLanguage),
      testCases: parseJsonSafe(row.testCases, [])
    };

    if (type === "MCQ") {
      payload.options = parseList(row.options);
      payload.correctAnswer = String(row.correctAnswer || "").trim();

      if (payload.options.length < 2 || !payload.correctAnswer) {
        failed.push({
          row: index + 1,
          reason: "MCQ requires options and correctAnswer"
        });
        continue;
      }
    }

    try {
      await Question.create(payload);
      inserted++;
    } catch (err) {
      const reason =
        err?.code === 11000
          ? "Duplicate question (title + type)"
          : err.message;

      failed.push({
        row: index + 1,
        reason
      });
    }
  }

  return res.status(200).json({
    success: true,
    message: `Imported ${inserted} questions.`,
    inserted,
    failedCount: failed.length,
    failed
  });
};

module.exports = {
  createQuestion,
  getQuestions,
  bulkUploadQuestions
};