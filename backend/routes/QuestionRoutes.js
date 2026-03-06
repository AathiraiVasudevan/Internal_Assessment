const express = require("express");
const controller = require("../controllers/QuestionController");

const { createQuestion, getQuestions, bulkUploadQuestions } = controller;

const router = express.Router();

router.post("/", createQuestion);
router.get("/", getQuestions);
router.post("/bulk-upload", bulkUploadQuestions);

module.exports = router;