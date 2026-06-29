const btnCamera = document.getElementById('btnCamera');
const btnUpload = document.getElementById('btnUpload');
const btnCapture = document.getElementById('btnCapture');
const btnReset = document.getElementById('btnReset');
const fileInput = document.getElementById('fileInput');

const cameraFeed = document.getElementById('cameraFeed');
const imagePreview = document.getElementById('imagePreview');
const scannerOverlay = document.getElementById('scannerOverlay');
const placeholderContent = document.getElementById('placeholderContent');
const loadingOverlay = document.getElementById('loadingOverlay');
const resultsArea = document.getElementById('resultsArea');

let stream = null;
let currentImageBlob = null;

// API URL (adjust if hosted elsewhere)
const API_URL = 'https://spoilcheck-ai-production.up.railway.app/api/analyze';

// --- Event Listeners ---

btnCamera.addEventListener('click', async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        cameraFeed.srcObject = stream;

        // UI updates
        placeholderContent.classList.add('hidden');
        imagePreview.classList.add('hidden');
        cameraFeed.classList.remove('hidden');
        scannerOverlay.classList.remove('hidden');

        btnCapture.classList.remove('hidden');
        btnCamera.classList.add('hidden');
        btnUpload.classList.add('hidden');
        resultsArea.classList.add('hidden');

    } catch (err) {
        alert("Tidak dapat mengakses kamera. Pastikan browser memiliki izin.");
        console.error(err);
    }
});

btnUpload.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        currentImageBlob = file;

        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.src = e.target.result;

            // UI updates
            placeholderContent.classList.add('hidden');
            cameraFeed.classList.add('hidden');
            imagePreview.classList.remove('hidden');
            scannerOverlay.classList.add('hidden'); // No scanner animation for upload, or we can show it briefly

            // Stop camera if running
            stopCamera();

            btnCapture.classList.add('hidden');
            resultsArea.classList.add('hidden');

            // Automatically analyze
            analyzeFood();
        }
        reader.readAsDataURL(file);
    }
});

btnCapture.addEventListener('click', () => {
    if (!stream) return;

    // Create a canvas to capture the frame
    const canvas = document.createElement('canvas');
    canvas.width = cameraFeed.videoWidth;
    canvas.height = cameraFeed.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);

    // Show preview
    imagePreview.src = canvas.toDataURL('image/jpeg');
    imagePreview.classList.remove('hidden');
    cameraFeed.classList.add('hidden');

    // Convert to blob for upload
    canvas.toBlob((blob) => {
        currentImageBlob = blob;
        stopCamera();

        btnCapture.classList.add('hidden');
        btnCamera.classList.add('hidden');
        btnUpload.classList.add('hidden');

        analyzeFood();
    }, 'image/jpeg');
});

btnReset.addEventListener('click', () => {
    // Reset UI
    resultsArea.classList.add('hidden');
    imagePreview.classList.add('hidden');
    placeholderContent.classList.remove('hidden');
    scannerOverlay.classList.add('hidden');

    btnCamera.classList.remove('hidden');
    btnUpload.classList.remove('hidden');
    btnCapture.classList.add('hidden');

    // Reset score bar
    document.getElementById('scoreBar').style.width = '0%';
    currentImageBlob = null;
    fileInput.value = '';
});

// --- Helper Functions ---

function stopCamera() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
}

async function analyzeFood() {
    if (!currentImageBlob) return;

    // Show loading
    loadingOverlay.classList.remove('hidden');
    scannerOverlay.classList.remove('hidden'); // Show scanner during analysis

    const formData = new FormData();
    formData.append('file', currentImageBlob, 'food.jpg');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();

        // Hide loading
        loadingOverlay.classList.add('hidden');
        scannerOverlay.classList.add('hidden');

        // Display Results
        displayResults(data);

    } catch (err) {
        console.error(err);
        alert("Gagal menghubungi server. Pastikan backend Python sudah berjalan (localhost:8000).");
        loadingOverlay.classList.add('hidden');
        scannerOverlay.classList.add('hidden');
        btnReset.click(); // Reset state
    }
}

function displayResults(data) {
    resultsArea.classList.remove('hidden');

    // Status text & colors
    const statusText = document.getElementById('statusText');
    const statusIcon = document.getElementById('statusIcon');
    const statusCard = document.getElementById('statusCard');

    statusText.textContent = data.status;

    // Reset classes
    statusCard.className = 'p-4 rounded-xl border flex items-center space-x-4 transition-all';
    statusIcon.className = 'w-12 h-12 rounded-full flex items-center justify-center text-white text-xl';

    if (data.status_color === 'green') {
        statusCard.classList.add('bg-green-50', 'border-green-200', 'text-green-800');
        statusIcon.classList.add('bg-green-500');
        statusIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
    } else if (data.status_color === 'yellow') {
        statusCard.classList.add('bg-yellow-50', 'border-yellow-200', 'text-yellow-800');
        statusIcon.classList.add('bg-yellow-500');
        statusIcon.innerHTML = '<i class="fa-solid fa-exclamation"></i>';
    } else {
        statusCard.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
        statusIcon.classList.add('bg-red-500');
        statusIcon.innerHTML = '<i class="fa-solid fa-skull-crossbones"></i>';
    }

    // Score Bar animation
    const scoreText = document.getElementById('scoreText');
    const scoreBar = document.getElementById('scoreBar');

    scoreText.textContent = `${data.score}%`;

    // Slight delay to allow CSS transition to happen after un-hiding
    setTimeout(() => {
        scoreBar.style.width = `${data.score}%`;

        // Colorize bar
        if (data.score >= 80) {
            scoreBar.className = 'bg-green-500 h-3 rounded-full transition-all duration-1000 ease-out';
        } else if (data.score >= 50) {
            scoreBar.className = 'bg-yellow-500 h-3 rounded-full transition-all duration-1000 ease-out';
        } else {
            scoreBar.className = 'bg-red-500 h-3 rounded-full transition-all duration-1000 ease-out';
        }
    }, 100);

    // Explanation
    document.getElementById('explanationText').textContent = data.explanation;

    // Calculus Insight
    const calcEl = document.getElementById('calculusText');
    calcEl.innerHTML = data.calculus_insight;

    // Tell MathJax to re-render the newly inserted LaTeX math
    if (window.MathJax) {
        window.MathJax.typesetPromise([calcEl]).catch((err) => console.error(err));
    }
}
