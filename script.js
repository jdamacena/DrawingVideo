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

// Initialize color history
let colorHistory = [];

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

// Function to start drawing
function startDrawing(e) {
  if (recording) {
    let x =
      e.offsetX || e.touches[0].clientX - canvas.getBoundingClientRect().left;
    let y =
      e.offsetY || e.touches[0].clientY - canvas.getBoundingClientRect().top;
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
  if (recording) {
    lastX = undefined;
    lastY = undefined;
    strokes.push({
      type: "stop",
      color: color,
      size: size,
      timestamp: new Date().getTime(),
    });
    updateUndoRedoButtons();
  }
}

// Function to toggle recording
function toggleRecord() {
  recording = !recording;

  if (recording) {
    document.getElementById("record").innerText = "Stop";
    strokes = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas on new recording
    document.getElementById("reproduce").disabled = true; // Disable reproduce button while recording
  } else {
    document.getElementById("record").innerText = "Record";
    document.getElementById("reproduce").disabled = false; // Enable reproduce button when not recording
  }
  updateUndoRedoButtons();
}

// Function to reproduce the drawing
function reproduceDrawing() {
  if (recording) return; // Ensure reproduction only works when not recording
  var interval = 10; // Adjust the speed of reproduction
  var index = 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

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

// Function to change color
function changeColor() {
  color = document.getElementById("color").value; // Update the color variable
  addToColorHistory(color);
  updateColorHistoryDisplay();
  updateBrushPreview(); // Update brush preview
}

// Function to add color to history
function addToColorHistory(newColor) {
  // Remove the color if it already exists
  colorHistory = colorHistory.filter((c) => c !== newColor);
  // Add the new color to the front of the array
  colorHistory.unshift(newColor);
  // Keep only the last 3 colors
  if (colorHistory.length > 3) {
    colorHistory.pop();
  }
}

// Function to update the color history display
function updateColorHistoryDisplay() {
  let historyDiv = document.getElementById("history");
  historyDiv.innerHTML = ""; // Clear existing history
  colorHistory.forEach((color) => {
    let swatch = document.createElement("div");
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.dataset.color = color;
    swatch.addEventListener("click", () => {
      document.getElementById("color").value = color; // Update color picker
      changeColor(); // Update the drawing color
    });
    historyDiv.appendChild(swatch);
  });
}

// Add event listeners for common colors
document.querySelectorAll(".color-swatch").forEach((swatch) => {
  swatch.addEventListener("click", function () {
    document.getElementById("color").value = this.dataset.color; // Update color picker
    changeColor(); // Update the drawing color
  });
});

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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
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
  if (color === "#FFFFFF") {
    // Assuming white is the background color
    color = document.getElementById("color").value; // Switch back to the selected color
  } else {
    color = "#FFFFFF"; // Set color to white for erasing
  }
  document.getElementById("color").value = color; // Update color picker
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes = [];
  undoStack = [];
  redoStack = [];
  updateUndoRedoButtons();
}

// Add event listeners for buttons
document.getElementById("record").addEventListener("click", toggleRecord);
document
  .getElementById("reproduce")
  .addEventListener("click", reproduceDrawing);
document.getElementById("color").addEventListener("input", changeColor);
document.getElementById("size").addEventListener("input", changeSize);
document.getElementById("undo").addEventListener("click", undo);
document.getElementById("redo").addEventListener("click", redo);
document.getElementById("eraser").addEventListener("click", toggleEraser);
document.getElementById("save").addEventListener("click", saveDrawing);
document.getElementById("clear").addEventListener("click", clearCanvas);

// Initial state of undo and redo buttons
updateUndoRedoButtons();
updateBrushPreview(); // Initialize brush preview on load

// Function to toggle dark mode
document.getElementById("toggle-mode").addEventListener("click", function () {
  document.body.classList.toggle("dark-mode"); // Toggle the dark-mode class
});

// Function to save the drawing as a JSON file
function saveDrawingAsJSON() {
  const drawingData = {
    strokes: strokes,
    colorHistory: colorHistory,
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
    colorHistory = jsonData.colorHistory;
    size = jsonData.size;
    recording = jsonData.recording;
    updateUndoRedoButtons();
    updateBrushPreview();
    redrawCanvas();
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
