from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
import pytesseract
from PIL import Image, ImageEnhance
import io
import json
import re
from pathlib import Path
import base64

app = FastAPI()

# Load ingredients database
DATABASE_PATH = Path(__file__).parent / "database" / "ingredients.json"
with open(DATABASE_PATH, 'r') as f:
    INGREDIENTS_DB = json.load(f)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def read_root():
    """Serve the main HTML page"""
    with open("static/index.html", 'r') as f:
        return JSONResponse({"message": "Use /static/index.html to access the app"})

def preprocess_image(image: Image.Image) -> Image.Image:
    """Apply grayscale filter and enhancement for better OCR"""
    # Convert to grayscale
    image = image.convert('L')
    
    # Enhance contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(1.5)
    
    # Enhance sharpness
    enhancer = ImageEnhance.Sharpness(image)
    image = enhancer.enhance(1.2)
    
    return image

def extract_text_from_image(image_data: str) -> str:
    """Extract text from base64 image using OCR"""
    try:
        # Decode base64 image
        if image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Preprocess image
        processed_image = preprocess_image(image)
        
        # Extract text using pytesseract
        text = pytesseract.image_to_string(processed_image, lang='eng')
        
        return text
    except Exception as e:
        raise Exception(f"OCR processing failed: {str(e)}")

def classify_ingredients(text: str) -> dict:
    """Classify ingredients into harmful, beneficial, and ayurvedic categories"""
    words = re.split(r'\s+|[,;]', text.lower())
    words = [w.strip() for w in words if w.strip()]
    
    harmful = []
    beneficial = []
    ayurvedic = []
    
    for word in words:
        # Check harmful
        for keyword in INGREDIENTS_DB['harmful']:
            if keyword in word:
                if word not in harmful:
                    harmful.append(word)
                break
        
        # Check beneficial
        for item in INGREDIENTS_DB['beneficial']:
            if item['commercial'].lower() in word or item['chemical'].lower() in word:
                if item not in beneficial:
                    beneficial.append(item)
                break
        
        # Check ayurvedic
        for item in INGREDIENTS_DB['ayurvedic']:
            if item['common'].lower() in word or item['scientific'].lower() in word:
                if item not in ayurvedic:
                    ayurvedic.append(item)
                break
    
    return {
        "harmful": harmful,
        "beneficial": beneficial,
        "ayurvedic": ayurvedic
    }

@app.post("/analyze")
async def analyze_image(request: dict):
    """
    Analyze an image for ingredients
    Expected JSON: {"image": "base64_encoded_image"}
    """
    try:
        if 'image' not in request:
            raise HTTPException(status_code=400, detail="Missing 'image' field in request")
        
        image_data = request['image']
        
        # Extract text from image
        text = extract_text_from_image(image_data)
        
        if not text.strip():
            return JSONResponse({
                "category": "Ingredients Analysis",
                "harmful": [],
                "beneficial": [],
                "ayurvedic": [],
                "message": "No text detected in image"
            })
        
        # Classify ingredients
        results = classify_ingredients(text)
        
        return JSONResponse({
            "category": "Ingredients Analysis",
            "harmful": results['harmful'],
            "beneficial": results['beneficial'],
            "ayurvedic": results['ayurvedic'],
            "extracted_text": text[:500]  # Return first 500 chars for debugging
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
