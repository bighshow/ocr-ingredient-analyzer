// Function to convert canvas to grayscale before transmission
function applyGrayscaleFilter(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = r * 0.299 + g * 0.587 + b * 0.114;
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }
    
    ctx.putImageData(imageData, 0, 0);
}

// Function to analyze image via FastAPI backend
async function analyzeImage(imageData) {
    try {
        console.log('Sending image to backend for analysis...');
        
        const response = await fetch('/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: imageData
            })
        });
        
        if (!response.ok) {
            throw new Error(`Backend error: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Backend response:', result);
        
        return {
            category: result.category,
            harmful: result.harmful,
            ayurvedic: result.ayurvedic,
            beneficial: result.beneficial
        };
    } catch (error) {
        console.error('Error in analyzeImage:', error);
        throw new Error(`Image analysis failed: ${error.message}`);
    }
}

// Function to display results
function displayResults(result) {
    const harmfulList = document.getElementById('harmfulList');
    const ayurvedicList = document.getElementById('ayurvedicList');
    const beneficialList = document.getElementById('beneficialList');
    
    // Clear previous results
    harmfulList.innerHTML = '';
    ayurvedicList.innerHTML = '';
    beneficialList.innerHTML = '';
    
    // Display harmful ingredients
    if (result.harmful && result.harmful.length > 0) {
        document.getElementById('harmfulResults').style.display = 'block';
        result.harmful.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            harmfulList.appendChild(li);
        });
    } else {
        document.getElementById('harmfulResults').style.display = 'none';
    }
    
    // Display ayurvedic ingredients
    if (result.ayurvedic && result.ayurvedic.length > 0) {
        document.getElementById('ayurvedicResults').style.display = 'block';
        result.ayurvedic.forEach(item => {
            const li = document.createElement('li');
            if (typeof item === 'object') {
                li.textContent = `${item.common} (${item.scientific})`;
            } else {
                li.textContent = item;
            }
            ayurvedicList.appendChild(li);
        });
    } else {
        document.getElementById('ayurvedicResults').style.display = 'none';
    }
    
    // Display beneficial chemicals
    if (result.beneficial && result.beneficial.length > 0) {
        document.getElementById('beneficialResults').style.display = 'block';
        result.beneficial.forEach(item => {
            const li = document.createElement('li');
            if (typeof item === 'object') {
                li.textContent = `${item.commercial} (${item.chemical})`;
            } else {
                li.textContent = item;
            }
            beneficialList.appendChild(li);
        });
    } else {
        document.getElementById('beneficialResults').style.display = 'none';
    }
    
    // Show no results message if all empty
    if (!result.harmful.length && !result.ayurvedic.length && !result.beneficial.length) {
        const resultDiv = document.getElementById('result');
        resultDiv.innerHTML = '<h3>Analysis Results</h3><p>No specific ingredients detected in the image.</p>';
    }
}

// DOM Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const captureButton = document.getElementById('captureButton');
const resultDiv = document.getElementById('result');
const fileInput = document.getElementById('imageUpload');
const fileNameSpan = document.getElementById('fileName');
const analyzeUploadButton = document.getElementById('analyzeUploadButton');
const consentButton = document.getElementById('consentButton');
const stopCameraButton = document.getElementById('stopCameraButton');

let stream = null;

// Function to request webcam access
async function requestWebcamAccess() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        captureButton.disabled = false;
        stopCameraButton.disabled = false;
        consentButton.disabled = true;
    } catch (err) {
        console.error("Error accessing the webcam", err);
        resultDiv.innerHTML = '<h3>Analysis Results</h3><p>Error accessing the webcam. Please make sure you have given permission and your camera is connected.</p>';
    }
}

// Function to stop webcam access
function stopWebcam() {
    if (stream) {
        const tracks = stream.getTracks();
        tracks.forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
        captureButton.disabled = true;
        stopCameraButton.disabled = true;
        consentButton.disabled = false;
    }
}

// Event listener for consent button
consentButton.addEventListener('click', () => {
    const consent = confirm("This application requires access to your camera for ingredient analysis. Do you consent to camera access? Your privacy is important to us, and the camera will only be activated when you choose to capture an image.");
    if (consent) {
        requestWebcamAccess();
    }
});

// Event listener for stop camera button
stopCameraButton.addEventListener('click', stopWebcam);

// Capture and analyze from webcam
captureButton.addEventListener('click', async () => {
    if (!stream) {
        alert("Please enable camera access first.");
        return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Apply grayscale filter
    applyGrayscaleFilter(canvas);
    
    const imageData = canvas.toDataURL('image/png');
    
    resultDiv.innerHTML = '<h3>Analysis Results</h3><p>Analyzing...</p>';
    
    try {
        const result = await analyzeImage(imageData);
        displayResults(result);
    } catch (error) {
        resultDiv.innerHTML = `<h3>Analysis Results</h3><p>Error analyzing image: ${error.message}</p>`;
        console.error(error);
    }
});

// File upload handling
fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
        fileNameSpan.textContent = file.name;
        analyzeUploadButton.disabled = false;
    } else {
        fileNameSpan.textContent = 'No file chosen';
        analyzeUploadButton.disabled = true;
    }
});

// Analyze uploaded image
analyzeUploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        resultDiv.innerHTML = '<h3>Analysis Results</h3><p>Please select an image file first.</p>';
        return;
    }

    resultDiv.innerHTML = '<h3>Analysis Results</h3><p>Analyzing...</p>';

    try {
        const imageData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });

        const result = await analyzeImage(imageData);
        displayResults(result);
    } catch (error) {
        console.error('Detailed error:', error);
        resultDiv.innerHTML = `<h3>Analysis Results</h3><p>Error analyzing image: ${error.message}</p>`;
    }
});

// Ensure the page is served over HTTPS (in production)
if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    console.warn('This application should be accessed over HTTPS for security reasons.');
}

// Initially disable capture and stop buttons
captureButton.disabled = true;
stopCameraButton.disabled = true;
