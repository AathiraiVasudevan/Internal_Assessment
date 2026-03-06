const express = require("express");
const router = express.Router();
const multer = require("multer");
const controller = require("../controllers/candidatePool.controller");
const asyncHandler = require("../middleware/asyncHandler");

const upload = multer({ dest: "uploads/" });

// REST: /api/pool
router.get("/", asyncHandler(controller.getPoolCandidates));
router.post("/", asyncHandler(controller.createManualCandidate)); // Handles Manual Mode
router.post("/upload", upload.single("file"), asyncHandler(controller.uploadPoolCandidates)); // Handles Bulk Mode

module.exports = router;