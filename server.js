require("dotenv").config();
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
// app.use(apiKeyMiddleware);
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

// app.get("/storage/api/v1/video/:filename", async (req, res) => {
//   const filename = req.params.filename;

//   // Get native MongoDB database object
//   const db = mongoose.connection.getClient().db();

//   // Create GridFSBucket instance
//   const bucket = new GridFSBucket(db, {
//     bucketName: "uploads", // Change this if you used a different bucket name
//   });

//   try {
//     const filesCollection = db.collection("uploads.files");
//     const file = await filesCollection.findOne({ filename: filename });

//     if (!file) {
//       return res.status(404).send("File not found");
//     }

//     // Open download stream
//     const downloadStream = bucket.openDownloadStream(file._id);

//     // res.set("Content-Type", "video/mp4");
// res.set({
//       'Content-Type': 'video/mp4',
//       'Cache-Control': 'no-cache',
//       'Accept-Ranges': 'bytes',
//       'Access-Control-Allow-Origin': '*',
//       'Access-Control-Allow-Headers': 'Content-Type, Authorization',
//       'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
//     });

//     // Pipe download stream to response
//     downloadStream.pipe(res);
//   } catch (error) {
//     console.error("Error retrieving file:", error);
//     res.status(500).send("Error retrieving file");
//   }
// });
app.get("/storage/api/v1/video/:filename", async (req, res) => {
  const filename = req.params.filename;

  // Get native MongoDB database object
  const db = mongoose.connection.getClient().db();

  // Create GridFSBucket instance
  const bucket = new GridFSBucket(db, {
    bucketName: "uploads",
  });

  try {
    const filesCollection = db.collection("uploads.files");
    const file = await filesCollection.findOne({ filename: filename });

    if (!file) {
      return res.status(404).send("File not found");
    }

    const fileSize = file.length;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).send("Requested range not satisfiable\n" + start + " >= " + fileSize);
        return;
      }

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": "video/mp4",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      });

      const downloadStream = bucket.openDownloadStream(file._id, { start, end: end + 1 });
      downloadStream.pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "video/mp4",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      });

      const downloadStream = bucket.openDownloadStream(file._id);
      downloadStream.pipe(res);
    }
  } catch (error) {
    console.error("Error retrieving file:", error);
    res.status(500).send("Error retrieving file");
  }
});
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
