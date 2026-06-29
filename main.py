import io
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

app = FastAPI(title="SpoilCheck AI Backend")

# Allow CORS for local frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for easy testing
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def analyze_image(image_bytes: bytes):
    # Convert bytes to numpy array for OpenCV
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise ValueError("Invalid image")

    # 1. Image Processing & Calculus (Gradients)
    # We use Sobel operator which computes the gradient (derivative) of the image intensity function.
    # Spoilage like mold or wrinkling increases high-frequency textures (higher gradients).
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Calculate gradients in x and y direction using Sobel
    # Calculus: G_x = \partial I / \partial x, G_y = \partial I / \partial y
    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    
    # Magnitude of gradient: |G| = sqrt(G_x^2 + G_y^2)
    magnitude = cv2.magnitude(sobelx, sobely)
    
    # Average gradient magnitude (roughness score)
    mean_gradient = np.mean(magnitude)
    
    # 2. Color Analysis
    # Dark spots or yellowish colors often indicate spoilage (simulated logic)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    # Define a range for 'spoiled' colors (e.g., brownish/dark or overly yellow/green depending on fruit)
    # For simulation, we'll just check overall brightness and saturation.
    v_channel = hsv[:, :, 2]
    mean_brightness = np.mean(v_channel)
    
    # 3. Decision Logic (Simulation)
    # We construct a mock score (100 = completely fresh, 0 = fully spoiled)
    # If gradient is too high (wrinkled/mold) or brightness is very low (rotten) -> spoiled.
    
    # This is a highly simplified heuristic for demonstration purposes.
    texture_penalty = min(50, mean_gradient / 2.0)
    color_penalty = 0
    if mean_brightness < 100:
        color_penalty = (100 - mean_brightness) * 0.5
        
    freshness_score = 100 - texture_penalty - color_penalty
    freshness_score = max(0, min(100, freshness_score))  # Clamp between 0 and 100
    
    # Determine status and explanation
    if freshness_score >= 80:
        status = "Aman Dikonsumsi"
        status_color = "green"
        explanation = "Makanan terlihat segar. Tekstur permukaan halus dan warnanya cerah alami."
    elif freshness_score >= 50:
        status = "Hampir Basi"
        status_color = "yellow"
        explanation = "Terdapat sedikit perubahan tekstur atau warna. Disarankan untuk segera dikonsumsi."
    else:
        status = "Basi / Berbahaya"
        status_color = "red"
        explanation = "Terdeteksi tekstur yang kasar (indikasi jamur/kerutan) atau warna yang tidak wajar. Jangan dikonsumsi!"
        
    # Generate Calculus Insight
    calculus_insight = (
        "<b>Calculus in Computer Vision:</b><br/>"
        "Sistem ini menggunakan operator Sobel untuk menghitung turunan parsial gambar: <br/>"
        "$\\nabla f(x,y) = \\begin{bmatrix} \\frac{\\partial f}{\\partial x} \\\\ \\frac{\\partial f}{\\partial y} \\end{bmatrix}$.<br/>"
        "Tingkat kebusukan (seperti jamur atau kerutan) menghasilkan perubahan drastis pada intensitas piksel (gradien tinggi). "
        f"Rata-rata magnitudo gradien yang terdeteksi pada gambar ini adalah <b>{mean_gradient:.2f}</b>. Semakin tinggi nilainya, semakin kasar permukaannya."
    )
    
    return {
        "status": status,
        "status_color": status_color,
        "score": round(freshness_score),
        "explanation": explanation,
        "calculus_insight": calculus_insight,
        "mean_gradient": round(mean_gradient, 2)
    }

@app.post("/api/analyze")
async def analyze_food(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        result = analyze_image(contents)
        return JSONResponse(content=result)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)

@app.get("/")
def read_root():
    return {"message": "SpoilCheck AI API is running. Send a POST request to /api/analyze."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
