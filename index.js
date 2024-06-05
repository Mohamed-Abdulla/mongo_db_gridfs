const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const { GridFSBucket } = require("mongodb");
const ObjectId = require("mongoose").Types.ObjectId;

//allow cross origin requests

const app = express();
const port = 5000;
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Connect to MongoDB
mongoose.connect("mongodb://localhost:27017/f50");

// Initialize GridFS storage engine
const storage = new GridFsStorage({
  url: "mongodb://localhost:27017/f50",
  file: (req, file) => {
    return {
      filename: file.originalname,
      bucketName: "uploads",
    };
  },
});

// Initialize multer middleware
const upload = multer({ storage });

// Route for uploading video
app.post("/upload", upload.single("video"), (req, res) => {
  console.log("File uploaded successfully");
  res.send("File uploaded successfully");
});

app.get("/video/:id", (req, res) => {
  const fileId = new ObjectId(req.params.id);

  // Get native MongoDB database object
  const db = mongoose.connection.getClient().db();

  // Create GridFSBucket instance
  const bucket = new GridFSBucket(db, {
    bucketName: "uploads", // Change this if you used a different bucket name
  });

  // Open download stream
  const downloadStream = bucket.openDownloadStream(fileId);

  // Set response headers
  res.set("Content-Type", "video/mp4");

  // Pipe download stream to response
  downloadStream.pipe(res);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
