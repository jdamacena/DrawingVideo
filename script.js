// --- App Metadata ---
const APP_METADATA = {
  version: "1.0.0",
  app: "Whiteboard Recorder",
  background: "#FFFFFF",
};
// --------------------

// Get the canvas element
let canvas = document.getElementById("canvas");
let ctx = canvas.getContext("2d");

// Set the canvas dimensions
canvas.width = 800;
canvas.height = 600;

// Fill the canvas with a white background
ctx.fillStyle = "#FFFFFF"; // White background
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Set the drawing variables
let recording = false;
let lastX, lastY;
let strokes = [];
let undoStack = [];
let redoStack = [];
let color = document.getElementById("color").value; // Set initial color from input
let size = 5;

const colorPicker = new ColorPicker("#color", {
  swatches: [
    "#FF6F61",
    "#FF8C42",
    "#F6EB61",
    "#A8D600",
    "#00BFFF",
    "#008C8C",
    "#D5006D",
  ],
  enableAlpha: false,
  enableEyedropper: true,
  formats: [],
  defaultFormat: "hex",
  submitMode: "instant",
  showClearButton: false,
  dismissOnOutsideClick: true,
});

colorPicker.on("pick", (newColor) => {
  if (!newColor) {
    color = "#000000";
  }

  color = newColor.toString();
  console.log(color);
  updateBrushPreview();
});

// Add event listeners for drawing
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mousemove", draw);
canvas.addEventListener("touchstart", startDrawing);
canvas.addEventListener("touchend", stopDrawing);
canvas.addEventListener("touchmove", function (e) {
  e.preventDefault();
  draw(e.touches[0]);
});

// Helper to show/hide play button
function setPlayButtonVisible(visible) {
  document.getElementById("reproduce").style.display = visible
    ? "inline-block"
    : "none";
}

// Function to start a new drawing
function newDrawing() {
  recording = false;
  strokes = [];
  fillCanvasBackground();
  document.getElementById("reproduce").disabled = true;
  setPlayButtonVisible(false);
  lastX = undefined;
  lastY = undefined;
  updateUndoRedoButtons();
  resetVideoRecording();
}

// --- Video Recording State ---
let mediaRecorder = null;
let recordedChunks = [];
let allVideoChunks = [];
let isRecordingVideo = false;

function startVideoRecording() {
  if (isRecordingVideo) return;
  mediaRecorder = new MediaRecorder(canvas.captureStream(30));
  recordedChunks = [];
  mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data && event.data.size > 0) {
      recordedChunks.push(event.data);
      allVideoChunks.push(event.data);
    }
  });
  mediaRecorder.start(200); // 200ms timeslice
  isRecordingVideo = true;
}

function stopVideoRecording() {
  if (mediaRecorder && isRecordingVideo) {
    mediaRecorder.stop();
    isRecordingVideo = false;
  }
}

function resetVideoRecording() {
  stopVideoRecording();
  recordedChunks = [];
  allVideoChunks = [];
  mediaRecorder = null;
  isRecordingVideo = false;
}

function downloadVideo() {
  if (!isRecordingVideo || allVideoChunks.length === 0) return;
  // Request the latest chunk
  mediaRecorder.requestData();
  setTimeout(() => {
    const validChunks = allVideoChunks.filter(
      (chunk) => chunk && chunk.size > 1000
    );
    if (validChunks.length === 0) return;
    const blob = new Blob(validChunks, { type: "video/mp4" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "drawing.mp4";
    link.click();
  }, 200); // Wait for the chunk to be flushed
}

// Function to start drawing
function startDrawing(e) {
  // Auto-start recording on first stroke
  if (!recording) {
    recording = true;
    setPlayButtonVisible(false);
    document.getElementById("reproduce").disabled = true;
  }
  // Start video recording if not already
  startVideoRecording();
  let x =
    e.offsetX || e.touches[0].clientX - canvas.getBoundingClientRect().left;
  let y =
    e.offsetY || e.touches[0].clientY - canvas.getBoundingClientRect().top;
  lastX = x;
  lastY = y;
  undoStack.push(strokes.slice()); // Save current strokes to undo stack
  redoStack = []; // Clear redo stack
  // Start a new stroke as an array of points
  strokes.push({
    type: "stroke",
    points: [{ x, y }],
    color: color,
    size: size,
    timestamp: new Date().getTime(),
  });
  updateUndoRedoButtons();
}

// Function to draw
function draw(e) {
  if (!recording || lastX === undefined || lastY === undefined) return;
  const x =
    e.offsetX || e.touches[0].clientX - canvas.getBoundingClientRect().left;
  const y =
    e.offsetY || e.touches[0].clientY - canvas.getBoundingClientRect().top;

  // Add the new point to the current stroke
  const curr = strokes[strokes.length - 1];
  if (curr && curr.type === "stroke") {
    curr.points.push({ x, y });
    // Redraw all strokes and current stroke
    redrawCanvas();
    drawTaperedStroke(curr);
  }

  lastX = x;
  lastY = y;
}

// Function to stop drawing
function stopDrawing() {
  lastX = undefined;
  lastY = undefined;
  // After finishing stroke, redraw to apply taper
  redrawCanvas();
  // Show play button now that at least one stroke exists
  setPlayButtonVisible(strokes.length > 0);
  document.getElementById("reproduce").disabled = strokes.length === 0;
  updateUndoRedoButtons();
}

// Draw a tapered stroke given a stroke object
function drawTaperedStroke(stroke) {
  if (!stroke || !stroke.points || stroke.points.length < 2) return;
  const pts = stroke.points;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  // If eraser (white), do not taper
  const isEraser =
    stroke.color === "#FFFFFF" || stroke.color.toLowerCase() === "white";
  const taperFraction = 0.15;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    let w = stroke.size;
    if (!isEraser) {
      const t = i / (pts.length - 1);
      if (t < taperFraction) {
        w = stroke.size * ((t / taperFraction) * 0.7 + 0.3);
      } else if (t > 1 - taperFraction) {
        w = stroke.size * (((1 - t) / taperFraction) * 0.7 + 0.3);
      }
    }
    ctx.lineWidth = Math.max(w, 1);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
  }
  ctx.restore();
}

// Override redrawCanvas to use tapered strokes
function redrawCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // fill background white
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  strokes.forEach((stroke) => {
    if (stroke.type === "stroke") {
      drawTaperedStroke(stroke);
    }
  });
}

// Function to change size
function changeSize() {
  size = document.getElementById("size").value;
  document.getElementById("size-label").innerText = `Size: ${size}`; // Update size label
  updateBrushPreview(); // Update brush preview
}

// Function to update the brush preview
function updateBrushPreview() {
  const brushPreview = document.getElementById("brush-preview");
  brushPreview.style.backgroundColor = color; // Set the background color
  brushPreview.style.width = `${size}px`; // Set the width
  brushPreview.style.height = `${size}px`; // Set the height
}

// Function to undo the last action
function undo() {
  if (undoStack.length > 0) {
    redoStack.push(strokes.slice()); // Save current strokes to redo stack
    strokes = undoStack.pop(); // Restore the last strokes
    redrawCanvas();
    updateUndoRedoButtons();
  }
}

// Function to redo the last undone action
function redo() {
  if (redoStack.length > 0) {
    undoStack.push(strokes.slice()); // Save current strokes to undo stack
    strokes = redoStack.pop(); // Restore the last undone strokes
    redrawCanvas();
    updateUndoRedoButtons();
  }
}

// Function to reproduce the drawing
function reproduceDrawing() {
  if (strokes.length === 0) return;
  // Stop recording to allow playback
  recording = false;
  const interval = 4; // ms per frame pause between strokes
  let strokeIndex = 0;
  let pointIndex = 1; // start at second point for drawing segments

  // Clear and fill background once
  fillCanvasBackground();

  function drawNext() {
    // If all strokes done, stop
    if (strokeIndex >= strokes.length) return;
    const stroke = strokes[strokeIndex];
    // Skip if not a stroke or too few points
    if (stroke.type !== "stroke" || stroke.points.length < 2) {
      strokeIndex++;
      pointIndex = 1;
      setTimeout(drawNext, interval * 4);
      return;
    }
    // Draw segment from pointIndex-1 to pointIndex
    const i = pointIndex - 1;
    const p0 = stroke.points[i];
    const p1 = stroke.points[pointIndex];
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const isEraser =
      stroke.color === "#FFFFFF" || stroke.color.toLowerCase() === "white";
    let w = stroke.size;
    if (!isEraser) {
      const t = i / (stroke.points.length - 1);
      const taperFraction = 0.15;
      if (t < taperFraction) {
        w = stroke.size * ((t / taperFraction) * 0.7 + 0.3);
      } else if (t > 1 - taperFraction) {
        w = stroke.size * (((1 - t) / taperFraction) * 0.7 + 0.3);
      }
    }
    ctx.lineWidth = Math.max(w, 1);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(p1.x, p1.y);
    ctx.stroke();
    ctx.restore();
    // Advance
    pointIndex++;
    if (pointIndex < stroke.points.length) {
      requestAnimationFrame(drawNext);
    } else {
      // Move to next stroke
      strokeIndex++;
      pointIndex = 1;
      setTimeout(drawNext, interval * 4);
    }
  }

  drawNext();
}

// Function to toggle the eraser
function toggleEraser() {
  const colorInput = document.getElementById("color");
  if (color === "#FFFFFF") {
    // Assuming white is the background color
    color = colorInput.value; // Switch back to the selected color
  } else {
    color = "#FFFFFF"; // Set color to white for erasing
  }
  colorInput.jscolor.fromString(color); // Update jscolor instance
  updateBrushPreview(); // Update brush preview
}

// Update the undo and redo buttons
function updateUndoRedoButtons() {
  document.getElementById("undo").disabled = undoStack.length === 0;
  document.getElementById("redo").disabled = redoStack.length === 0;
}

// Function to save the drawing as an image with a white background
function saveDrawing() {
  // Create a temporary canvas
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  // Set the dimensions of the temporary canvas
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;

  // Fill the temporary canvas with a white background
  tempCtx.fillStyle = "#FFFFFF"; // White background
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Draw the original canvas onto the temporary canvas
  tempCtx.drawImage(canvas, 0, 0);

  // Create a link to download the image
  const link = document.createElement("a");
  link.download = "drawing.png";
  link.href = tempCanvas.toDataURL(); // Get the image data URL
  link.click(); // Trigger the download
}

// Function to clear the canvas
function clearCanvas() {
  fillCanvasBackground();
  strokes = [];
  undoStack = [];
  redoStack = [];
  updateUndoRedoButtons();
  resetVideoRecording();
}

// Add event listeners for buttons
document.getElementById("new-drawing").addEventListener("click", newDrawing);
document
  .getElementById("reproduce")
  .addEventListener("click", reproduceDrawing);
document.getElementById("size").addEventListener("input", changeSize);
document.getElementById("undo").addEventListener("click", undo);
document.getElementById("redo").addEventListener("click", redo);
document.getElementById("eraser").addEventListener("click", toggleEraser);
document.getElementById("save").addEventListener("click", saveDrawing);
document.getElementById("clear").addEventListener("click", clearCanvas);
document
  .getElementById("download-video")
  .addEventListener("click", downloadVideo);

// Initial state of undo and redo buttons
updateUndoRedoButtons();
updateBrushPreview(); // Initialize brush preview on load

// Function to get theme from URL
function getThemeFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("theme");
}

// Function to set theme in URL
function setThemeInURL(theme) {
  const params = new URLSearchParams(window.location.search);
  params.set("theme", theme);
  const newUrl = window.location.pathname + "?" + params.toString();
  window.history.replaceState({}, "", newUrl);
}

// Function to apply theme
function applyTheme(theme) {
  if (theme === "dark") {
    document.body.classList.add("dark-mode");
  } else {
    document.body.classList.remove("dark-mode");
  }
}

// On load, apply theme from URL if present
const urlTheme = getThemeFromURL();
if (urlTheme) {
  applyTheme(urlTheme);
}

// Function to toggle dark mode
function toggleDarkMode() {
  const isDark = document.body.classList.toggle("dark-mode");
  setThemeInURL(isDark ? "dark" : "light");
}

document
  .getElementById("toggle-mode")
  .addEventListener("click", toggleDarkMode);

// Function to save the drawing as a JSON file
function saveDrawingAsJSON() {
  const drawingData = {
    version: APP_METADATA.version,
    app: APP_METADATA.app,
    exportedAt: new Date().toISOString(),
    canvas: {
      width: canvas.width,
      height: canvas.height,
    },
    background: APP_METADATA.background,
    userAgent: navigator.userAgent,
    strokes: strokes,
    size: size,
    recording: recording,
  };

  const jsonData = JSON.stringify(drawingData, null, 2);

  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([jsonData], { type: "application/json" })
  );
  a.download = "drawing.json";
  a.click();
}

// Function to load a drawing from a JSON file
function loadDrawingFromJSON(file) {
  const fileReader = new FileReader();
  fileReader.onload = function (event) {
    const jsonData = JSON.parse(event.target.result);
    strokes = jsonData.strokes;
    size = jsonData.size;
    recording = jsonData.recording;
    updateUndoRedoButtons();
    updateBrushPreview();
    redrawCanvas();
    setPlayButtonVisible(strokes && strokes.length > 0); // Show play button if strokes exist
    document.getElementById("reproduce").disabled = !(
      strokes && strokes.length > 0
    );
  };
  fileReader.readAsText(file);
}

// Add event listener for saving drawing as JSON
document
  .getElementById("save-json")
  .addEventListener("click", saveDrawingAsJSON);

// Add event listener for loading drawing from JSON
document
  .getElementById("load-json")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    loadDrawingFromJSON(file);
  });

// User Guide Modal Logic
const helpBtn = document.getElementById("help-btn");
const userGuideModal = document.getElementById("user-guide-modal");
const closeGuide = document.getElementById("close-guide");

helpBtn.addEventListener("click", () => {
  userGuideModal.style.display = "block";
});

closeGuide.addEventListener("click", () => {
  userGuideModal.style.display = "none";
});

window.addEventListener("click", (event) => {
  if (event.target === userGuideModal) {
    userGuideModal.style.display = "none";
  }
});

// Ensure play button is hidden initially
setPlayButtonVisible(false);

// Function to fill the canvas background
function fillCanvasBackground() {
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Set the initial background
fillCanvasBackground();
