const express = require("express");
const router = express.Router();
const controller = require("../controllers/candidate.controller");

const validate = require("../middleware/validate.middleware");
const { candidateSchema } = require("../validators/candidate.validator");
const asyncHandler = require("../middleware/asyncHandler");

// Listings
router.get("/list", asyncHandler(controller.getCandidateListing));

// Single Candidate Operations
router.post(
  "/",
  validate(candidateSchema),
  asyncHandler(controller.createCandidate)
);

router.get(
  "/:id/detail",
  asyncHandler(controller.getCandidateDetail)
);
router.get(
  "/:id/report",
  asyncHandler(controller.downloadCandidateReport)
);

// Pool & Assignment Operations
router.post(
  "/assign",
  asyncHandler(controller.assignCandidateFromPool)
);

router.post(
  "/bulk-assign",
  asyncHandler(controller.bulkAssignFromPool)
);

//Bulk Reassign Route
router.post(
  "/bulk-reassign",
  asyncHandler(controller.bulkReassignCandidates)
);

// Standard CRUD
router.get("/", asyncHandler(controller.getAllCandidates));
router.get("/:id", asyncHandler(controller.getCandidateById));
router.put("/:id", asyncHandler(controller.updateCandidate));
router.delete("/:id", asyncHandler(controller.deleteCandidate));

module.exports = router;
