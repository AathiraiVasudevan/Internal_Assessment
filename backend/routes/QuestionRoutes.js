const express = require("express");

const controller = require("../controllers/QuestionController");



const { createQuestion, getQuestions } = controller;

const router = express.Router();

router.post("/", createQuestion);
router.get("/", getQuestions);

module.exports = router;