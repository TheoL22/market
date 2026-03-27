const ID_ANALYZER_KEY = "NKyuAk7Ki0p7TpIv43aMorPEM0omHLze"; 
const video = document.getElementById('video');
const status = document.getElementById('status');
const choicePanel = document.getElementById('choice-panel');
const scannerBox = document.getElementById('scannerBox');
const idPreview = document.getElementById('id-preview');
const beep = document.getElementById('beepSound');

let liveFaceBlob = null; 
const MODEL_URL = 'https://justadudewhohacks.github.io/face-api.js/models';

async function init() {
    try {
        status.innerText = "LOADING AI MODELS (Please Wait)...";
        await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
        await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
        await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        
        startCamera();
    } catch (err) {
        status.innerText = "Error loading AI: " + err;
        console.error(err);
    }
}

async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        status.innerText = "STEP 1: POSITION YOUR FACE";
    } catch (e) {
        status.innerText = "Camera Error: Please allow camera access.";
    }
}

// STEP 1: Biometric Face Scan (Selfie)
video.addEventListener('play', () => {
    let stableFrames = 0; 
    const detector = setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks();
        if (detections.length > 0) {
            stableFrames++;
            status.innerText = `BIOMETRIC SCANNING: ${stableFrames * 10}%`;
            
            if (stableFrames >= 10) {
                clearInterval(detector); 
                status.innerText = "FACE DATA SECURED ✓";
                
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth; canvas.height = video.videoHeight;
                canvas.getContext('2d').drawImage(video, 0, 0);
                canvas.toBlob((blob) => {
                    liveFaceBlob = blob; 
                    scannerBox.style.display = 'none';
                    choicePanel.style.display = 'block'; 
                }, 'image/jpeg', 1.0); 
            }
        }
    }, 200);
});

// FUNCTIONS BINDING
window.triggerUpload = function() { document.getElementById('fileInput').click(); };

window.processUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    idPreview.src = URL.createObjectURL(file);
    idPreview.style.display = 'block';
    verifyIdentity(file);
};

// STEP 2: Smart ID Scan (Slow and Steady)
window.startLiveIDScan = async function() {
    scannerBox.style.display = 'block';
    choicePanel.style.display = 'none';
    
    // Ipakita ang green box overlay mula sa HTML/CSS
    const guide = document.getElementById('idGuide');
    if(guide) guide.style.display = 'block';

    status.innerText = "ALIGN ID WITHIN THE FRAME & HOLD STEADY";
    status.style.color = "#ffeb3b";
    
    let stabilityCounter = 0; 

    const idDetector = setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks();
        
        if (detections.length > 0) {
            const face = detections[0].detection.box;
            
            // Check if ID is somewhat centered (Avoiding edges)
            const isCentered = (face.x > (video.videoWidth * 0.15) && face.x < (video.videoWidth * 0.65));

            if (isCentered) {
                stabilityCounter++;
                status.innerText = `HOLDING STEADY... ${Math.round((stabilityCounter / 6) * 100)}%`;
                status.style.color = "#00d2ff";

                // If steady for 3 seconds (6 checks * 500ms)
                if (stabilityCounter >= 6) {
                    clearInterval(idDetector);
                    if(beep) beep.play(); // Play the Beep!

                    status.innerText = "ID CAPTURED! ANALYZING...";
                    status.style.color = "#00ff88";

                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.filter = 'contrast(1.1) brightness(1.05)'; 
                    ctx.drawImage(video, 0, 0);

                    canvas.toBlob((blob) => {
                        idPreview.src = URL.createObjectURL(blob);
                        idPreview.style.display = 'block';
                        scannerBox.style.display = 'none';
                        if(guide) guide.style.display = 'none';
                        verifyIdentity(blob);
                    }, 'image/jpeg', 1.0);
                }
            } else {
                stabilityCounter = 0; // Reset pag ginalaw
                status.innerText = "CENTER THE ID IN THE BOX";
                status.style.color = "#ffeb3b";
            }
        }
    }, 500); // Binagalan ang detection rate para hindi tarantarot
};

// FINAL STEP: High Security Verification
async function verifyIdentity(idFileBlob) {
    if (!liveFaceBlob) return;

    status.innerText = "VERIFYING IDENTITY (75% THRESHOLD)...";
    status.style.color = "#00d2ff";

    const formData = new FormData();
    formData.append('apikey', ID_ANALYZER_KEY);
    formData.append('file', idFileBlob);
    formData.append('face', liveFaceBlob);
    formData.append('verify_face', 'true'); 
    formData.append('accuracy', '2'); // Max Accuracy level

    try {
        const response = await fetch('https://api.idanalyzer.com/', { method: 'POST', body: formData });
        const data = await response.json();
        console.log("Security Audit Log:", data);

        const faceScore = (data.face && data.face.confidence) ? data.face.confidence : 0;
        const isMatch = (data.face && data.face.isMatch === true);
        const hasIDData = data.result && (data.result.firstName || data.result.documentNumber);

        // --- CALIBRATED TO 75% FOR SECURITY ---
        const minThreshold = 0.75; 

        if (faceScore >= minThreshold && isMatch && hasIDData) {
            status.innerText = `ACCESS GRANTED: ${Math.round(faceScore * 100)}% Match ✓`;
            status.style.color = "#00ff88";
            setTimeout(() => { goToMarketplace(); }, 2000);
        } else {
            status.style.color = "#f44336";
            if (!hasIDData) {
                status.innerText = "REJECTED: ID blurry or unreadable.";
            } else if (faceScore < minThreshold) {
                status.innerText = `REJECTED: Match Only ${Math.round(faceScore * 100)}% (Needs 75%)`;
            } else {
                status.innerText = "REJECTED: Security Protocol Failed.";
            }
        }
    } catch (error) {
        status.innerText = "System Timeout. Check Connection.";
    }
}

// EMERGENCY BYPASS (Press 'V')
window.addEventListener('keydown', (e) => {
    if (e.key === 'v' || e.key === 'V') {
        status.innerText = "OVERRIDE: IDENTITY VERIFIED ✓";
        status.style.color = "#00ff88";
        setTimeout(() => { goToMarketplace(); }, 1500);
    }
});

function goToMarketplace() {
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
    document.getElementById('login-flow').style.display = 'none';
    document.getElementById('marketplace').style.display = 'block';
}

init();