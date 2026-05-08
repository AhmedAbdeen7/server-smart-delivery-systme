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

app.post("/unlock", (req, res) =>
{
  pending_command = "unlock";
  console.log("[COMMAND] Unlock requested by mobile app");
  res.status(200).json({status : "unlock command queued"});

});

app.post("/lock", (req, res) =>
{
  pending_command = "lock";
  console.log("[COMMAND] Lock requested by mobile app");
  res.status(200).json({status : "lock command queued"});
});

app.get("/command", (req, res) =>
{
  if (pending_command) {
    const command_to_send = pending_command;
    pending_command = null;
    console.log(`[COMMAND] Sending command to ESP32-CAM: ${command_to_send}`);
    res.json({ command: command_to_send });
  }
});


app.post("/status", express.json(), (req, res) => {
  const { status } = req.body;
  if (status === "locked" || status === "unlocked") {
    lockStatus = status;
    console.log(`[STATUS] Lock is now: ${lockStatus}`);
    res.status(200).json({ received: true });
  } else {
    res.status(400).json({ error: "Invalid status value" });
  }
});


app.get("/status", (req, res) => {
  res.status(200).json({ status: lockStatus });
});


app.get("/gallery", (req, res) => {
  fs.readdir(IMAGES_DIR, (err, files) => {
    if (err) return res.status(500).send("Could not read images directory");
 
    const host = req.headers.host;
    const protocol = req.headers["x-forwarded-proto"] || "http";
 
    const jpegFiles = files
      .filter((f) => f.endsWith(".jpg"))
      .sort()
      .reverse();
 
    const imageCards = jpegFiles.map((filename) => {
      const timestamp = filename.replace("image_", "").replace(".jpg", "");
      const url = `${protocol}://${host}/images/${filename}`;
 
      // Format timestamp for display
      let displayTime = timestamp;
      try {
        const [datePart, timePart] = timestamp.split("T");
        const [y, m, d] = datePart.split("-");
        const [hh, mm, ss] = timePart.split("-");
        const months = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        displayTime = `${months[parseInt(m)]} ${d}, ${y} — ${hh}:${mm}:${ss}`;
      } catch (_) {}
 
      return `
        <div class="card" onclick="openModal('${url}', '${displayTime}')">
          <img src="${url}" alt="${displayTime}" loading="lazy" />
          <div class="timestamp">${displayTime}</div>
        </div>`;
    }).join("");
 
    const empty = jpegFiles.length === 0
      ? `<div class="empty">📭 No images yet. Waiting for deliveries...</div>`
      : "";
 
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Smart Delivery Box — Gallery</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #f0f2f5; color: #222; }
    header {
      background: #3f51b5; color: white; padding: 16px 24px;
      display: flex; align-items: center; justify-content: space-between;
    }
    header h1 { font-size: 18px; font-weight: 600; }
    .badge {
      background: #4caf50; color: white; font-size: 12px;
      padding: 4px 10px; border-radius: 20px;
    }
    .count { color: rgba(255,255,255,0.7); font-size: 13px; margin-top: 2px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px; padding: 24px;
    }
    .card {
      background: white; border-radius: 12px; overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1); cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .card:hover { transform: translateY(-4px); box-shadow: 0 6px 16px rgba(0,0,0,0.15); }
    .card img { width: 100%; height: 200px; object-fit: cover; display: block; }
    .timestamp {
      padding: 10px 14px; font-size: 13px; color: #3f51b5; font-weight: 500;
    }
    .empty {
      text-align: center; padding: 80px 20px; color: #999; font-size: 18px;
    }
    /* Modal */
    .modal {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.85); z-index: 100;
      align-items: center; justify-content: center; flex-direction: column;
    }
    .modal.open { display: flex; }
    .modal img { max-width: 90vw; max-height: 80vh; border-radius: 8px; }
    .modal .caption { color: white; margin-top: 12px; font-size: 14px; }
    .modal .close {
      position: absolute; top: 16px; right: 20px;
      color: white; font-size: 28px; cursor: pointer; font-weight: bold;
    }
  </style>
</head>
<body>
  <header>
    <div>
      <h1>📦 Smart Delivery Box</h1>
      <div class="count">${jpegFiles.length} image${jpegFiles.length !== 1 ? "s" : ""} — auto-refreshes every 5s</div>
    </div>
    <div class="badge">● Live</div>
  </header>
 
  <div class="grid">${imageCards}${empty}</div>
 
  <div class="modal" id="modal" onclick="closeModal()">
    <span class="close">✕</span>
    <img id="modalImg" src="" alt="" />
    <div class="caption" id="modalCaption"></div>
  </div>
 
  <script>
    function openModal(url, caption) {
      document.getElementById('modalImg').src = url;
      document.getElementById('modalCaption').textContent = caption;
      document.getElementById('modal').classList.add('open');
    }
    function closeModal() {
      document.getElementById('modal').classList.remove('open');
    }
    // Auto-refresh every 5 seconds
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>`);
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
