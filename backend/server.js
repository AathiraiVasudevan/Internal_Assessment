const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const connectDB = require("./config/db");
const { connectInternalAssessmentDB } = require("./config/internalAssessmentDb");
const mongoose = require("mongoose");

dotenv.config();

const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
  console.log("Created 'uploads' directory for CSV processing.");
}

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/assessments", require("./routes/assessment.routes"));
app.use("/api/candidates", require("./routes/candidate.routes"));
app.use("/api/attempts", require("./routes/attempt.routes"));
app.use("/api/pool", require("./routes/candidatePool.routes"));

// Mount Internal_Assessment APIs under a namespaced prefix to avoid route/model collisions.
app.use(
  "/api/internal-assessment/assessments",
  require("./routes/internalAssessment/AssessmentRoutes")
);
app.use(
  "/api/internal-assessment/questions",
  require("./routes/internalAssessment/QuestionRoutes")
);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    await connectInternalAssessmentDB();

    console.log("Mongo Host:", mongoose.connection.host);
    console.log("Mongo Port:", mongoose.connection.port);
    console.log("Mongo DB Name:", mongoose.connection.name);

    const errorHandler = require("./middleware/error.middleware");
    app.use(errorHandler);

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error("Startup Error:", error);
  }
};

startServer();
