const express = require("express");
const router = express.Router();

const controller = require("../controllers/attempt.controller");
const asyncHandler = require("../middleware/asyncHandler");

router.patch(
  "/:id/start",
  asyncHandler(controller.startAttempt)
);

router.patch(
  "/:id/submit",
  asyncHandler(controller.submitAttempt)
);

router.get("/", asyncHandler(controller.getAllAttempts));
router.get("/:id", asyncHandler(controller.getAttemptById));
router.put("/:id", asyncHandler(controller.updateAttempt));
router.delete("/:id", asyncHandler(controller.deleteAttempt));

module.exports = router;