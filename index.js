const express = require("express");
const multer = require("multer");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { createCanvas } = require("canvas");

const createTextWatermark = (text) => {
  const width = 400;
  const height = 50;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, width, height);

  ctx.font = "bold 25px Arial";
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)"; // White color with transparency
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.lineWidth = 2;
  ctx.strokeStyle = "white";
  ctx.strokeText(text, width / 2, height / 2);

  ctx.fillStyle = "black";

  ctx.fillText(text, width / 2, height / 2);

  return canvas.toBuffer();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const app = express();
const PORT = process.env.PORT || 3000;

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}
if (!fs.existsSync("processed")) {
  fs.mkdirSync("processed");
}

app.use("/files", express.static(path.join(__dirname, "processed")));

app.get("/files", (req, res) => {
  const directoryPath = path.join(__dirname, "processed");

  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).send("Unable to scan directory: " + err);
    }

    let fileList = "<h1>Files and Folders</h1><ul>";

    files.forEach((file) => {
      fileList += `<li><a href="${file}">${file}</a></li>`;
    });

    fileList += "</ul>";
    res.send(fileList);
  });
});

app.get("/files/:filepath", (req, res) => {
  if (req.params.filepath !== "" || req.params.filepath !== "/") {
    res.sendFile(path.join(__dirname, "files", req.params.filepath));
  }
});

app.post("/upload", upload.single("image"), async (req, res) => {
  const imagePath = req.file.path;
  const outputPath = `processed/${Date.now()}.jpg`;

  try {
    if (!fs.existsSync("processed")) {
      fs.mkdirSync("processed");
    }

    await sharp(imagePath)
      .resize(800, 600)
      .composite([
        { input: createTextWatermark("Imager.com"), gravity: "southeast" },
      ])
      .toFormat("jpeg")
      .jpeg({ quality: 80 })
      .toFile(outputPath);

    res.download(outputPath, (err) => {
      if (err) {
        console.log(err);
      }

      fs.unlinkSync(outputPath);
    });
  } catch (error) {
    console.error("Error processing image", error);
    res.status(500).send("Error processing image");
  }
});

app.post("/upload-multiple", upload.array("images", 10), async (req, res) => {
  const files = req.files;
  const processedFiles = [];

  try {
    await Promise.all(
      files.map(async (file) => {
        const outputPath = `processed/${path.basename(file.filename)}`;

        await sharp(file.path)
          .resize(800, 600) // Resize image
          .composite([
            { input: createTextWatermark("Imager.com"), gravity: "southeast" },
          ])
          .toFormat("jpeg")
          .jpeg({ quality: 80 })
          .toFile(outputPath);

        processedFiles.push(outputPath);
      })
    );

    res.json({ message: "Images processed", files: processedFiles });

    res.on("finish", () => {
      try {
        files.forEach((file, index) => {
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path); // Delete uploaded file
          }
        });
      } catch (cleanupError) {
        console.error("Error cleaning up files:", cleanupError);
      }
    });
  } catch (error) {
    console.error("Error processing images", error);
    res.status(500).send("Error processing images");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
