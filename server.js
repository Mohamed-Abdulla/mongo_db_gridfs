const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const { GridFSBucket } = require("mongodb");
const logger = require("./logger");

// Allow cross-origin requests
const app = express();
const port = process.env.PORT || 5080;

console.log = logger.info.bind(logger);
console.error = logger.error.bind(logger);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

// Initialize GridFS storage engine
const storage = new GridFsStorage({
  url: process.env.MONGO_URI,
  file: (req, file) => {
    return {
      filename: file.originalname,
      bucketName: "uploads",
    };
  },
});

// Initialize multer middleware
const upload = multer({ storage });

//home route

app.get("/storage", (req, res) => {
  res.send("Welcome to the video storage API");
});

// Route for uploading video
app.post("/storage/api/v1/upload", upload.single("video"), (req, res) => {
  console.log("File uploaded successfully");
  res.send("File uploaded successfully");
});

app.get("/storage/api/v1/video/:filename", async (req, res) => {
  const filename = req.params.filename;

  // Get native MongoDB database object
  const db = mongoose.connection.getClient().db();

  // Create GridFSBucket instance
  const bucket = new GridFSBucket(db, {
    bucketName: "uploads", // Change this if you used a different bucket name
  });

  try {
    const filesCollection = db.collection("uploads.files");
    const file = await filesCollection.findOne({ filename: filename });

    if (!file) {
      return res.status(404).send("File not found");
    }

    // Open download stream
    const downloadStream = bucket.openDownloadStream(file._id);

    res.set("Content-Type", "video/mp4");

    // Pipe download stream to response
    downloadStream.pipe(res);
  } catch (error) {
    console.error("Error retrieving file:", error);
    res.status(500).send("Error retrieving file");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
