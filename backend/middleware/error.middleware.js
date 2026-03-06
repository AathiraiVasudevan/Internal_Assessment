const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.message);

  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  if (err.name === "CastError") {
    statusCode = 400;
    err.message = "Invalid ID format";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
  }

  res.status(statusCode).json({
    success: false,
    message: err.message
  });

  if (err.code === 11000) {
    return res.status(400).json({
        success: false,
        message: "Duplicate field value entered"
    });
    }
};

module.exports = errorHandler;