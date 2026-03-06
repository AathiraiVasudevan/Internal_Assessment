const mongoose = require("mongoose");

const INTERNAL_ASSESSMENT_DB_NAME = process.env.INTERNAL_ASSESSMENT_DB_NAME || "internal_assessment";

let internalConnection = null;
let internalConnectionPromise = null;

const buildInternalAssessmentUri = () => {
  if (process.env.INTERNAL_ASSESSMENT_MONGO_URI) {
    return process.env.INTERNAL_ASSESSMENT_MONGO_URI;
  }

  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI. Set MONGO_URI or INTERNAL_ASSESSMENT_MONGO_URI.");
  }

  try {
    const url = new URL(process.env.MONGO_URI);
    url.pathname = `/${INTERNAL_ASSESSMENT_DB_NAME}`;
    return url.toString();
  } catch (error) {
    // Fallback: keep existing URI if parsing fails.
    return process.env.MONGO_URI;
  }
};

const getInternalAssessmentConnection = () => {
  if (internalConnection) {
    return internalConnection;
  }

  const internalUri = buildInternalAssessmentUri();
  internalConnection = mongoose.createConnection(internalUri);
  return internalConnection;
};

const connectInternalAssessmentDB = async () => {
  if (internalConnection && internalConnection.readyState === 1) {
    return internalConnection;
  }

  if (internalConnectionPromise) {
    return internalConnectionPromise;
  }

  const connection = getInternalAssessmentConnection();
  internalConnectionPromise = connection.asPromise();
  await internalConnectionPromise;

  console.log("Internal Assessment MongoDB Connected");
  console.log("Internal Assessment Mongo Host:", connection.host);
  console.log("Internal Assessment Mongo Port:", connection.port);
  console.log("Internal Assessment Mongo DB Name:", connection.name);

  return connection;
};

module.exports = {
  connectInternalAssessmentDB,
  getInternalAssessmentConnection
};
