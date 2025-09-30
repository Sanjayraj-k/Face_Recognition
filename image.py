import flask
from flask import Flask, request, jsonify
import torch
from transformers import AutoProcessor, AutoModel
from PIL import Image
import numpy as np
import os
from sklearn.metrics.pairwise import cosine_similarity
import pickle
import base64
from io import BytesIO
from flask_cors import CORS

# --- Configuration ---
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

MODEL_NAME = "openai/clip-vit-large-patch14"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DATASET_DIR = "./dataset"
EMBEDDINGS_CACHE_FILE = "dataset_embeddings_clip.pkl"

# Create dataset directory if it doesn't exist
if not os.path.exists(DATASET_DIR):
    os.makedirs(DATASET_DIR)

# --- Model Loading ---
def load_models():
    """Loads the specified CLIP model and processor."""
    try:
        processor = AutoProcessor.from_pretrained(MODEL_NAME)
        model = AutoModel.from_pretrained(MODEL_NAME).to(DEVICE)
        model.eval()
        return processor, model, None
    except Exception as e:
        return None, None, f"Failed to load CLIP model '{MODEL_NAME}': {e}"

processor, model, error = load_models()
if error:
    print(error)
    exit(1)

# --- Core Functions for Image & Text Processing ---
def encode_image(image: Image.Image) -> np.ndarray:
    """Encodes a single PIL image into a numpy embedding."""
    inputs = processor(images=image, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        image_features /= image_features.norm(dim=-1, keepdim=True)
    return image_features.squeeze().cpu().numpy()

def encode_text(text: str) -> np.ndarray:
    """Encodes a text string into a numpy embedding."""
    inputs = processor(text=text, return_tensors="pt", padding=True, truncation=True).to(DEVICE)
    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
        text_features /= text_features.norm(dim=-1, keepdim=True)
    return text_features.squeeze().cpu().numpy()

def compute_and_cache_embeddings():
    """Compute and cache image embeddings for the entire dataset."""
    image_paths = [os.path.join(DATASET_DIR, f) for f in os.listdir(DATASET_DIR)
                   if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

    if not image_paths:
        return None, None, "Dataset directory is empty. Please upload images."

    embeddings = []
    for path in image_paths:
        try:
            image = Image.open(path).convert("RGB")
            emb = encode_image(image)
            embeddings.append(emb)
        except Exception as e:
            print(f"Could not process image '{os.path.basename(path)}': {e}")

    if not embeddings:
        return None, None, "Failed to generate any embeddings from the dataset."

    embeddings = np.vstack(embeddings)
    
    with open(EMBEDDINGS_CACHE_FILE, 'wb') as f:
        pickle.dump((embeddings, image_paths), f)
        
    return embeddings, image_paths, None

# --- Load or Compute Embeddings ---
dataset_embs, dataset_paths, error = None, None, None
if os.path.exists(EMBEDDINGS_CACHE_FILE):
    try:
        with open(EMBEDDINGS_CACHE_FILE, 'rb') as f:
            dataset_embs, dataset_paths = pickle.load(f)
        
        expected_dim = model.config.projection_dim
        if dataset_embs.shape[1] != expected_dim:
            dataset_embs, dataset_paths, error = compute_and_cache_embeddings()
    except Exception as e:
        dataset_embs, dataset_paths, error = compute_and_cache_embeddings()
else:
    dataset_embs, dataset_paths, error = compute_and_cache_embeddings()

if dataset_embs is None:
    print(error or "Failed to load dataset embeddings.")
    exit(1)

# --- Helper Function to Convert Image to Base64 ---
def image_to_base64(image_path):
    """Convert an image file to a base64 string."""
    try:
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            buffered = BytesIO()
            img.save(buffered, format="JPEG")
            img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{img_str}"
    except Exception as e:
        print(f"Error converting image {image_path} to base64: {e}")
        return None

# --- Flask Routes ---
@app.route("/search", methods=["POST"])
def search():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON data provided"}), 400

        text_query = data.get("text_query", "").strip()
        k = int(data.get("k", 5))

        if not text_query:
            return jsonify({"error": "Please provide a text description to search."}), 400

        if k < 1 or k > len(dataset_paths):
            return jsonify({"error": f"Number of results must be between 1 and {len(dataset_paths)}."}), 400

        # Encode the text query
        text_emb = encode_text(text_query)
        
        # Compute cosine similarities
        similarities = cosine_similarity([text_emb], dataset_embs)[0]
        
        # Get top k results
        top_indices = np.argsort(similarities)[::-1][:k]

        # Prepare results
        results = []
        for idx in top_indices:
            img_base64 = image_to_base64(dataset_paths[idx])
            if img_base64:
                results.append({
                    "image": img_base64,
                    "score": float(similarities[idx]),
                    "path": os.path.basename(dataset_paths[idx])
                })

        return jsonify({
            "query": text_query,
            "results": results,
            "model": MODEL_NAME,
            "device": DEVICE
        })

    except Exception as e:
        return jsonify({"error": f"Error processing query: {str(e)}"}), 500

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "message": "CLIP Image Retrieval API",
        "model": MODEL_NAME,
        "device": DEVICE,
        "dataset_size": len(dataset_paths),
        "instructions": "Send a POST request to /search with JSON payload {'text_query': 'your query', 'k': number_of_results}"
    })

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)