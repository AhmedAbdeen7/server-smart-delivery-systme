const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 8080;
const IMAGES_DIR = path.join(__dirname, "received_images");

if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR);
}

app.post("/upload", (req, res) => {
  const timestamp = req.headers["x-timestamp"] || `no-timestamp-${Date.now()}`;
  const filename = `image_${timestamp}.jpg`;
  const filepath = path.join(IMAGES_DIR, filename);

  const chunks = [];

  req.on("data", (chunk) => chunks.push(chunk));

  req.on("end", () => {
    const imageBuffer = Buffer.concat(chunks);

    if (imageBuffer.length === 0) {
      console.warn(`[UPLOAD] Empty body received at ${timestamp}`);
      return res.status(400).send("Empty image body");
    }

    fs.writeFile(filepath, imageBuffer, (err) => {
      if (err) {
        console.error(`[UPLOAD] Failed to save image: ${err.message}`);
        return res.status(500).send("Failed to save image");
      }

      console.log(`[UPLOAD] Saved: ${filename} (${imageBuffer.length} bytes)`);
      res.status(200).send("Image received");
    });
  });

  req.on("error", (err) => {
    console.error(`[UPLOAD] Request error: ${err.message}`);
    res.status(500).send("Request error");
  });
});

app.get("/images", (req, res) => {
  fs.readdir(IMAGES_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: "Could not read images directory" });
    }

    const jpegFiles = files
      .filter((f) => f.endsWith(".jpg"))
      .sort()
      .reverse();

    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "http";

    const images = jpegFiles.map((filename) => {
      const timestamp = filename.replace("image_", "").replace(".jpg", "");
      return {
        filename,
        timestamp,
        url: `${protocol}://${host}/images/${filename}`,
      };
    });

    res.json(images);
  });
});

app.get("/images/:filename", (req, res) => {
  const filename = req.params.filename;

  if (filename.includes("/") || filename.includes("..")) {
    return res.status(400).send("Invalid filename");
  }

  const filepath = path.join(IMAGES_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).send("Image not found");
  }

  res.setHeader("Content-Type", "image/jpeg");
  res.sendFile(filepath);
});

app.get("/latest", (req, res) => {
  fs.readdir(IMAGES_DIR, (err, files) => {
    if (err) return res.status(500).send("Could not read images directory");

    const jpegFiles = files.filter((f) => f.endsWith(".jpg")).sort();

    if (jpegFiles.length === 0) {
      return res.status(404).send("No images yet");
    }

    const latest = jpegFiles[jpegFiles.length - 1];
    const filepath = path.join(IMAGES_DIR, latest);

    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("X-Filename", latest);
    res.sendFile(filepath);
  });
});

app.get("/", (req, res) => {
  res.send("Smart Delivery Lock Box Server is running ");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n=== Smart Delivery Lock Box Server`);
  console.log(`Listening on port ${PORT}`);
  console.log(`Images saved to: ${IMAGES_DIR}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /upload          <- ESP32-CAM sends images here`);
  console.log(`  GET  /images          <- list all images (JSON)`);
  console.log(`  GET  /images/:file    <- fetch a specific image`);
  console.log(`  GET  /latest          <- fetch the most recent image`);
  console.log(`  GET  /               <- health check`);
  console.log(`\nWaiting for images...\n`);
});
