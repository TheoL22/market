// ---- CONFIG ----
const ID_ANALYZER_KEY = "NKyuAk7Ki0p7TpIv43aMorPEM0omHLze";
const FACE_API_MODELS = 'https://justadudewhohacks.github.io/face-api.js/models';
const MATCH_THRESHOLD = 0.80; // 80% — industry standard for eKYC/marketplace

// ---- DOM REFERENCES ----
const video       = document.getElementById('video');
const statusEl    = document.getElementById('status');
const choicePanel = document.getElementById('choice-panel');
const scannerBox  = document.getElementById('scannerBox');
const idGuide     = document.getElementById('idGuide');
const idPreview   = document.getElementById('id-preview');

// ---- STATE ----
let liveFaceBlob = null;

// ---- UTILITY: Update Status ----
function setStatus(text, color = '#00d2ff') {
    statusEl.innerText   = text;
    statusEl.style.color = color;
}

// ---- UTILITY: Countdown Beeps (Web Audio API) ----
// Plays short beeps like a scanner: beep beep beep BEEEP
function playCountdownBeeps(count = 3, onDone) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) { if (onDone) onDone(); return; }

    const ctx = new AudioCtx();
    let delay = 0;

    for (let i = 0; i < count; i++) {
        const isLast = (i === count - 1);
        const startAt = delay;

        setTimeout(() => {
            const osc      = ctx.createOscillator();
            const gainNode = ctx.createGain();

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.frequency.value = isLast ? 1200 : 880;
            osc.type = 'sine';

            const duration = isLast ? 0.35 : 0.12;
            gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);

            if (isLast && onDone) {
                setTimeout(onDone, duration * 1000 + 100);
            }
        }, startAt);

        delay += isLast ? 0 : 400;
    }
}

// ---- STEP 0: Init — Load face-api Models ----
async function init() {
    try {
        setStatus("LOADING AI MODELS (Please Wait)...");
        await faceapi.nets.ssdMobilenetv1.loadFromUri(FACE_API_MODELS);
        await faceapi.nets.faceLandmark68Net.loadFromUri(FACE_API_MODELS);
        await faceapi.nets.faceRecognitionNet.loadFromUri(FACE_API_MODELS);
        startCamera();
    } catch (err) {
        setStatus("Error loading AI: " + err, '#f44336');
        console.error("face-api.js load error:", err);
    }
}

// ---- STEP 1a: Start Camera ----
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        setStatus("STEP 1: POSITION YOUR FACE");
    } catch (e) {
        setStatus("Camera Error: Please allow camera access.", '#f44336');
        console.error("Camera error:", e);
    }
}

// ---- STEP 1b: Face Detection & Capture ----
video.addEventListener('play', () => {
    let stableFrames = 0;

    const detector = setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks();

        if (detections.length > 0) {
            stableFrames++;
            const percent = Math.min(stableFrames * 10, 100);
            setStatus(`BIOMETRIC SCANNING: ${percent}%`);

            if (stableFrames >= 10) {
                clearInterval(detector);
                setStatus("FACE DATA SECURED ✓", '#00ff88');
                captureLiveFace();
            }
        }
    }, 200);
});

function captureLiveFace() {
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    // Flip canvas to match the un-mirrored display (scaleX -1 in CSS)
    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
        liveFaceBlob              = blob;
        scannerBox.style.display  = 'none';
        choicePanel.style.display = 'block';
    }, 'image/jpeg', 1.0);
}

// ---- STEP 2a: Upload ID ----
window.triggerUpload = function () {
    document.getElementById('fileInput').click();
};

window.processUpload = function (event) {
    const file = event.target.files[0];
    if (!file) return;
    idPreview.src           = URL.createObjectURL(file);
    idPreview.style.display = 'block';
    verifyIdentity(file);
};

// ---- STEP 2b: Live ID Scan ----
window.startLiveIDScan = async function () {
    scannerBox.style.display  = 'block';
    choicePanel.style.display = 'none';
    idGuide.style.display     = 'block';

    setStatus("ALIGN ID WITHIN THE FRAME & HOLD STEADY", '#ffeb3b');

    let stabilityCounter = 0;

    const idDetector = setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks();

        if (detections.length > 0) {
            const faceBox = detections[0].detection.box;
            const isCentered = (
                faceBox.x > (video.videoWidth * 0.15) &&
                faceBox.x < (video.videoWidth * 0.65)
            );

            if (isCentered) {
                stabilityCounter++;
                const percent = Math.round((stabilityCounter / 6) * 100);
                setStatus(`HOLDING STEADY... ${percent}%`, '#00d2ff');

                if (stabilityCounter >= 6) {
                    clearInterval(idDetector);
                    playCountdownBeeps(3, () => {
                        captureIDFrame();
                    });
                }
            } else {
                stabilityCounter = 0;
                setStatus("CENTER THE ID IN THE BOX", '#ffeb3b');
            }
        }
    }, 500);
};

function captureIDFrame() {
    setStatus("ID CAPTURED! ANALYZING...", '#00ff88');

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.filter = 'contrast(1.1) brightness(1.05)';
    ctx.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
        idPreview.src            = URL.createObjectURL(blob);
        idPreview.style.display  = 'block';
        scannerBox.style.display = 'none';
        idGuide.style.display    = 'none';
        verifyIdentity(blob);
    }, 'image/jpeg', 1.0);
}

// ---- STEP 3: Verify via ID Analyzer API ----
async function verifyIdentity(idFileBlob) {
    if (!liveFaceBlob) {
        setStatus("Error: No face data. Please restart.", '#f44336');
        return;
    }

    setStatus(`VERIFYING IDENTITY (${Math.round(MATCH_THRESHOLD * 100)}% THRESHOLD)...`);

    const formData = new FormData();
    formData.append('apikey',      ID_ANALYZER_KEY);
    formData.append('file',        idFileBlob);
    formData.append('face',        liveFaceBlob);
    formData.append('verify_face', 'true');
    formData.append('accuracy',    '2');

    try {
        const response = await fetch('https://api.idanalyzer.com/', {
            method: 'POST',
            body:   formData
        });

        const data = await response.json();
        console.log("[FaceBuko] Security Audit Log:", data);

        const faceScore = (data.face && data.face.confidence) ? data.face.confidence : 0;
        const isMatch   = (data.face && data.face.isMatch === true);
        const hasIDData = data.result && (data.result.firstName || data.result.documentNumber);

        if (faceScore >= MATCH_THRESHOLD && isMatch && hasIDData) {
            setStatus(`ACCESS GRANTED: ${Math.round(faceScore * 100)}% Match ✓`, '#00ff88');
            setTimeout(goToMarketplace, 2000);
        } else {
            if (!hasIDData) {
                setStatus("REJECTED: ID blurry or unreadable. Try again.", '#f44336');
            } else if (faceScore < MATCH_THRESHOLD) {
                setStatus(`REJECTED: ${Math.round(faceScore * 100)}% Match — Needs ${Math.round(MATCH_THRESHOLD * 100)}%`, '#f44336');
            } else {
                setStatus("REJECTED: Security Protocol Failed.", '#f44336');
            }
        }

    } catch (error) {
        setStatus("System Timeout. Check Connection.", '#f44336');
        console.error("[FaceBuko] API Error:", error);
    }
}

// ---- TRANSITION: Go to Marketplace ----
function goToMarketplace() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    document.getElementById('login-flow').style.display  = 'none';
    document.getElementById('marketplace').style.display = 'block';
}

// ---- DEV BYPASS: Press 'V' to skip (REMOVE BEFORE PRODUCTION) ----
window.addEventListener('keydown', (e) => {
    if (e.key === 'v' || e.key === 'V') {
        setStatus("OVERRIDE: IDENTITY VERIFIED ✓", '#00ff88');
        setTimeout(goToMarketplace, 1500);
    }
});

// ---- ENTRY POINT ----
init();