const winston = require("winston");
const path = require("path");

const logFilePath = path.join(__dirname, "logs", "app.log");

const logger = winston.createLogger({
  transports: [
    new winston.transports.File({
      level: "info",
      filename: logFilePath,
      handleExceptions: true,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }),
    new winston.transports.Console({
      level: "info",
      handleExceptions: true,
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
  exitOnError: false,
});

module.exports = logger;
