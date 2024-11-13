require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const { GridFSBucket } = require("mongodb");
const cors = require("cors");

const logger = require("./logger");

// Allow cross-origin requests
const app = express();
const port = process.env.PORT || 5080;

console.log = logger.info.bind(logger);
console.error = logger.error.bind(logger);
// Apply CORS middleware
app.use(cors());

// app.use((req, res, next) => {
//   res.header("Access-Control-Allow-Origin", "*");
//   res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//   next();
// });

app.use(express.json());
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

app.post("/storage/api/v1/upload", async (req, res) => {
  try {
    const db = mongoose.connection.getClient().db();
    const filesCollection = db.collection("uploads.files");

    // Check for existing file with the same name
    const existingFile = await filesCollection.findOne({ filename: req.headers["x-file-name"] });

    if (existingFile) {
      return res.status(400).json({ message: "File with the same name already exists" });
    }

    // Dynamically apply multer middleware after duplicate check passes
    upload.single("video")(req, res, (err) => {
      if (err) {
        console.error("Error during file upload:", err);
        return res.status(500).json({ message: "An error occurred while uploading the file." });
      }

      console.log("File uploaded successfully");
      res.json({ message: "File uploaded successfully" });
    });
  } catch (error) {
    console.error("Error during file upload:", error);
    res.status(500).json({ message: "An error occurred while uploading the file." });
  }
});

//list all videos
app.get("/storage/api/v1/videos", async (req, res) => {
  const db = mongoose.connection.getClient().db();
  const collection = db.collection("uploads.files");
  const files = await collection.find().toArray();
  res.json(files);
});

// delete video by id
app.delete("/storage/api/v1/videos", async (req, res) => {
  try {
    const db = mongoose.connection.getClient().db();
    const collection = db.collection("uploads.files");
    const ids = req.body.ids; // Expecting an array of ids in the request body

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).send("Invalid request: ids should be a non-empty array");
    }

    // Validate that all ids are valid ObjectId strings
    const objectIds = ids.map((id) => {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        throw new Error(`Invalid ObjectId: ${id}`);
      }
      return new mongoose.Types.ObjectId(id);
    });

    const result = await collection.deleteMany({ _id: { $in: objectIds } });

    res.send(`${result.deletedCount} files deleted successfully`);
  } catch (error) {
    console.error("Error during deletion:", error);
    if (error.message.includes("Invalid ObjectId")) {
      return res.status(400).send(error.message);
    }
    res.status(500).send("An error occurred while deleting files.");
  }
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
