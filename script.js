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
}

// Function to start drawing
function startDrawing(e) {
  // Auto-start recording on first stroke
  if (!recording) {
    recording = true;
    setPlayButtonVisible(false);
    document.getElementById("reproduce").disabled = true;
  }
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
  if (recording || strokes.length === 0) return;
  let interval = 4; // ms per frame (for pause between strokes)
  let strokeIndex = 0;
  let pointIndex = 2;
  let isPlaying = true;

  // Helper to draw all previous strokes fully
  function drawPreviousStrokes() {
    for (let i = 0; i < strokeIndex; i++) {
      if (strokes[i].type === "stroke") {
        drawTaperedStroke(strokes[i]);
      }
    }
  }

  function drawCurrentStrokeUpTo(stroke, ptIdx) {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;
    ctx.save();
    ctx.strokeStyle = stroke.color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const isEraser =
      stroke.color === "#FFFFFF" || stroke.color.toLowerCase() === "white";
    const taperFraction = 0.15;
    for (let i = 0; i < Math.min(ptIdx - 1, stroke.points.length - 1); i++) {
      const p0 = stroke.points[i];
      const p1 = stroke.points[i + 1];
      let w = stroke.size;
      if (!isEraser) {
        const t = i / (stroke.points.length - 1);
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

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawPreviousStrokes();
    if (strokeIndex < strokes.length) {
      const stroke = strokes[strokeIndex];
      if (stroke.type === "stroke") {
        drawCurrentStrokeUpTo(stroke, pointIndex);
        pointIndex++;
        if (pointIndex <= stroke.points.length) {
          requestAnimationFrame(animate);
        } else {
          strokeIndex++;
          pointIndex = 2;
          setTimeout(animate, interval * 4); // Small pause between strokes
        }
      } else {
        strokeIndex++;
        pointIndex = 2;
        setTimeout(animate, interval);
      }
    }
  }
  animate();
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
    document.getElementById("reproduce").disabled = !(strokes && strokes.length > 0);
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

// Function to download the video
function downloadVideo() {
  // Create a temporary canvas to draw the white background
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  // Set the dimensions of the temporary canvas
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;

  // Fill the temporary canvas with a white background
  tempCtx.fillStyle = "#FFFFFF"; // White background
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Create a new MediaRecorder instance
  const mediaRecorder = new MediaRecorder(canvas.captureStream(30));

  // Create an array to store the recorded video chunks
  let recordedChunks = [];

  // Add an event listener for dataavailable events
  mediaRecorder.addEventListener("dataavailable", (event) => {
    recordedChunks.push(event.data);
  });

  // Add an event listener for stop events
  mediaRecorder.addEventListener("stop", () => {
    // Create a blob from the recorded chunks
    const blob = new Blob(recordedChunks, { type: "video/mp4" });

    // Create a link to download the video
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "drawing.mp4";
    link.click();
  });

  // Function to capture the canvas and record it
  let recording = true;
  function captureAndRecord() {
    if (recording) {
      // Clear the temporary canvas
      tempCtx.clearRect(0, 0, tempCanvas.width, tempCanvas.height);

      // Draw the entire stroke stack onto the temporary canvas
      tempCtx.fillStyle = "#FFFFFF"; // White background
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      strokes.forEach((stroke, index) => {
        if (stroke.type === "start") {
          tempCtx.beginPath();
          tempCtx.arc(stroke.x, stroke.y, 5, 0, Math.PI * 2);
          tempCtx.fillStyle = stroke.color;
          tempCtx.fill();
        } else if (stroke.type === "draw") {
          const x = stroke.newX;
          const y = stroke.newY;
          const lastX = stroke.x;
          const lastY = stroke.y;
          const distance = Math.sqrt((x - lastX) ** 2 + (y - lastY) ** 2);
          const steps = Math.ceil(distance / (5 / 2)); // Number of circles to draw based on distance
          for (let i = 0; i <= steps; i++) {
            const ratio = i / steps;
            const drawX = lastX + (x - lastX) * ratio;
            const drawY = lastY + (y - lastY) * ratio;
            tempCtx.beginPath();
            tempCtx.arc(drawX, drawY, 5 / 2, 0, Math.PI * 2);
            tempCtx.fillStyle = stroke.color;
            tempCtx.fill();
          }
        }
      });

      // Request the next frame
      requestAnimationFrame(captureAndRecord);
    }
  }

  // Start capturing and recording
  captureAndRecord();

  // Add an event listener for the stop button
  document.getElementById("download-video").addEventListener("click", () => {
    // Stop recording
    recording = false;
    mediaRecorder.stop();
  });

  // Start recording
  mediaRecorder.start();
}

document
  .getElementById("download-video")
  .addEventListener("click", downloadVideo);

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
