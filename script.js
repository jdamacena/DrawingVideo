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
  // Auto-start recording if not already
  if (!recording) {
    recording = true;
    setPlayButtonVisible(false);
    document.getElementById("reproduce").disabled = true;
  }
  let x =
    e.offsetX ||
    (e.touches && e.touches[0].clientX - canvas.getBoundingClientRect().left);
  let y =
    e.offsetY ||
    (e.touches && e.touches[0].clientY - canvas.getBoundingClientRect().top);
  lastX = x;
  lastY = y;
  undoStack.push(strokes.slice()); // Save current strokes to undo stack
  redoStack = []; // Clear redo stack
  strokes.push({
    type: "start",
    x: x,
    y: y,
    color: color,
    size: size,
    timestamp: new Date().getTime(),
  });
  updateUndoRedoButtons();
}

// Function to draw
function draw(e) {
  if (!recording || lastX === undefined || lastY === undefined) return;
  var x =
    e.offsetX || e.touches[0].clientX - canvas.getBoundingClientRect().left;
  var y =
    e.offsetY || e.touches[0].clientY - canvas.getBoundingClientRect().top;

  // Draw multiple circles for smoother effect
  const distance = Math.sqrt((x - lastX) ** 2 + (y - lastY) ** 2);
  const steps = Math.ceil(distance / (size / 2)); // Number of circles to draw based on distance

  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    const drawX = lastX + (x - lastX) * ratio;
    const drawY = lastY + (y - lastY) * ratio;

    ctx.beginPath();
    ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2); // Draw a circle
    ctx.fillStyle = color; // Set the fill color
    ctx.fill(); // Fill the circle
    ctx.closePath();
  }

  // Store the stroke data
  strokes.push({
    type: "draw",
    x: lastX,
    y: lastY,
    newX: x,
    newY: y,
    color: color,
    size: size,
    timestamp: new Date().getTime(),
  });

  lastX = x;
  lastY = y;
}

// Function to stop drawing
function stopDrawing() {
  lastX = undefined;
  lastY = undefined;
  // Only add a stop stroke if recording
  if (recording) {
    strokes.push({
      type: "stop",
      color: color,
      size: size,
      timestamp: new Date().getTime(),
    });
    updateUndoRedoButtons();
    // Stop recording after each stroke
    recording = false;
    setPlayButtonVisible(strokes.length > 0);
    document.getElementById("reproduce").disabled = strokes.length === 0;
  }
}

// Function to reproduce the drawing
function reproduceDrawing() {
  if (recording || strokes.length === 0) return; // Only play if not recording and there is something to play
  var interval = 10; // Adjust the speed of reproduction
  var index = 0;
  fillCanvasBackground();
  lastX = undefined;
  lastY = undefined;

  function animate() {
    if (index >= strokes.length) return;
    var stroke = strokes[index];

    switch (stroke.type) {
      case "start":
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.size;
        lastX = stroke.x;
        lastY = stroke.y;
        break;
      case "draw":
        const distance = Math.sqrt(
          (stroke.newX - stroke.x) ** 2 + (stroke.newY - stroke.y) ** 2
        );
        const steps = Math.ceil(distance / (stroke.size / 2));
        for (let i = 0; i <= steps; i++) {
          const ratio = i / steps;
          const drawX = stroke.x + (stroke.newX - stroke.x) * ratio;
          const drawY = stroke.y + (stroke.newY - stroke.y) * ratio;
          ctx.beginPath();
          ctx.arc(drawX, drawY, stroke.size / 2, 0, Math.PI * 2);
          ctx.fillStyle = stroke.color;
          ctx.fill();
          ctx.closePath();
        }
        lastX = stroke.newX;
        lastY = stroke.newY;
        break;
      case "stop":
        lastX = undefined;
        lastY = undefined;
        break;
    }
    index++;
    setTimeout(animate, interval);
  }
  animate();
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

// Function to redraw the canvas based on the current strokes
function redrawCanvas() {
  fillCanvasBackground();
  strokes.forEach((stroke) => {
    if (stroke.type === "draw") {
      const distance = Math.sqrt(
        (stroke.newX - stroke.x) ** 2 + (stroke.newY - stroke.y) ** 2
      );
      const steps = Math.ceil(distance / (stroke.size / 2)); // Number of circles to draw based on distance

      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        const drawX = stroke.x + (stroke.newX - stroke.x) * ratio;
        const drawY = stroke.y + (stroke.newY - stroke.y) * ratio;

        ctx.beginPath();
        ctx.arc(drawX, drawY, stroke.size / 2, 0, Math.PI * 2); // Draw a circle
        ctx.fillStyle = stroke.color; // Set the fill color
        ctx.fill(); // Fill the circle
        ctx.closePath();
      }
    }
  });
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
