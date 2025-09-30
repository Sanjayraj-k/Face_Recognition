import streamlit as st
import torch
from transformers import AutoProcessor, AutoModel
from PIL import Image
import numpy as np
import os
from sklearn.metrics.pairwise import cosine_similarity
import pickle

# --- Configuration ---
st.set_page_config(layout="wide", page_title="CLIP Image Retrieval")

# Use a more powerful CLIP model
MODEL_NAME = "openai/clip-vit-large-patch14" 
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DATASET_DIR = "./dataset"
EMBEDDINGS_CACHE_FILE = "dataset_embeddings_clip.pkl" # Use a new cache file for the new model

# Create dataset directory if it doesn't exist
if not os.path.exists(DATASET_DIR):
    os.makedirs(DATASET_DIR)

# --- Model Loading (Cached for performance) ---
@st.cache_resource
def load_models():
    """Loads the specified CLIP model and processor."""
    try:
        # We use AutoModel for CLIP, as it's a more general class
        processor = AutoProcessor.from_pretrained(MODEL_NAME)
        model = AutoModel.from_pretrained(MODEL_NAME).to(DEVICE)
        model.eval()
        return processor, model
    except Exception as e:
        st.error(f"Failed to load CLIP model '{MODEL_NAME}': {e}")
        st.stop()

with st.spinner(f"Loading {MODEL_NAME} model..."):
    processor, model = load_models()
st.sidebar.success(f"Model loaded successfully on: {DEVICE}")

# --- Core Functions for Image & Text Processing ---
def encode_image(image: Image.Image) -> np.ndarray:
    """Encodes a single PIL image into a numpy embedding."""
    inputs = processor(images=image, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
        # Normalize the features
        image_features /= image_features.norm(dim=-1, keepdim=True)
    return image_features.squeeze().cpu().numpy()

def encode_text(text: str) -> np.ndarray:
    """Encodes a text string into a numpy embedding."""
    inputs = processor(text=text, return_tensors="pt", padding=True, truncation=True).to(DEVICE)
    with torch.no_grad():
        text_features = model.get_text_features(**inputs)
        # Normalize the features
        text_features /= text_features.norm(dim=-1, keepdim=True)
    return text_features.squeeze().cpu().numpy()

def compute_and_cache_embeddings():
    """Compute and cache image embeddings for the entire dataset."""
    st.info(f"Cache file not found or invalid. Computing new embeddings for '{MODEL_NAME}'...")
    
    image_paths = [os.path.join(DATASET_DIR, f) for f in os.listdir(DATASET_DIR)
                   if f.lower().endswith(('.png', '.jpg', '.jpeg'))]

    if not image_paths:
        st.error(f"Dataset directory '{DATASET_DIR}' is empty. Please upload images.")
        return None, None

    embeddings = []
    progress_bar = st.progress(0, text=f"Processing {len(image_paths)} images...")

    for i, path in enumerate(image_paths):
        try:
            image = Image.open(path).convert("RGB")
            emb = encode_image(image)
            embeddings.append(emb)
        except Exception as e:
            st.warning(f"Could not process image '{os.path.basename(path)}': {e}")
        
        progress_bar.progress((i + 1) / len(image_paths), text=f"Processing {os.path.basename(path)}...")
    
    progress_bar.empty()

    if not embeddings:
        st.error("Failed to generate any embeddings from the dataset.")
        return None, None

    embeddings = np.vstack(embeddings)
    
    with open(EMBEDDINGS_CACHE_FILE, 'wb') as f:
        pickle.dump((embeddings, image_paths), f)
        
    st.success("Dataset embeddings computed and cached successfully!")
    return embeddings, image_paths

# --- Load or Compute Embeddings ---
dataset_embs, dataset_paths = None, None
if os.path.exists(EMBEDDINGS_CACHE_FILE):
    try:
        with open(EMBEDDINGS_CACHE_FILE, 'rb') as f:
            dataset_embs, dataset_paths = pickle.load(f)
        
        # Validation: Check if embedding dimension matches the current model
        expected_dim = model.config.projection_dim
        if dataset_embs.shape[1] != expected_dim:
            st.warning(f"Cached embeddings have wrong dimension ({dataset_embs.shape[1]}) for the current model ({expected_dim}). Recomputing...")
            dataset_embs, dataset_paths = compute_and_cache_embeddings()

    except Exception as e:
        st.warning(f"Failed to load cache, recomputing embeddings. Error: {e}")
        dataset_embs, dataset_paths = compute_and_cache_embeddings()
else:
    dataset_embs, dataset_paths = compute_and_cache_embeddings()

# Stop the app if data loading fails
if dataset_embs is None:
    st.stop()

# --- Streamlit UI ---
st.title("🖼️ Text-to-Image Retrieval with CLIP")
st.markdown("Use the power of OpenAI's CLIP to search your image dataset with natural language. Try queries like 'a photo of a dog in a field of flowers' or 'a watercolor painting of a cityscape at night'.")

col1, col2 = st.columns([3, 1])
with col1:
    text_query = st.text_input("Enter your image description:", value="A green car parked near a red brick wall")
with col2:
    k = st.slider("Number of results:", 1, min(20, len(dataset_paths)), 5)

if st.button("🔍 Search", type="primary", use_container_width=True):
    if not text_query.strip():
        st.warning("Please enter a text description to search.")
    else:
        with st.spinner("Embedding your query and finding matches..."):
            # Encode the text query
            text_emb = encode_text(text_query)
            
            # Compute cosine similarities
            # Since both text and image embeddings are already normalized, this is equivalent to a dot product.
            similarities = cosine_similarity([text_emb], dataset_embs)[0]
            
            # Get top k results
            top_indices = np.argsort(similarities)[::-1][:k]

        st.subheader(f"Top {k} matches for '{text_query}':")
        
        # Display results in a flexible grid
        cols = st.columns(min(k, 5))
        for i, idx in enumerate(top_indices):
            with cols[i % len(cols)]:
                st.image(dataset_paths[idx],
                         caption=f"Score: {similarities[idx]:.3f}",
                         use_column_width=True)

# Sidebar
st.sidebar.title("How it Works")
st.sidebar.markdown(f"""
This app uses the **{MODEL_NAME}** model to perform text-to-image retrieval.

1.  **Indexing:** When the app starts, it converts every image in the `dataset` folder into a numerical representation (an embedding) that captures its visual content. These are then cached in `{EMBEDDINGS_CACHE_FILE}` for speed.
2.  **Querying:** When you type a text query, the model converts your text into a similar embedding.
3.  **Matching:** The app calculates the [cosine similarity](https://en.wikipedia.org/wiki/Cosine_similarity) between your text embedding and all the image embeddings to find the best visual matches.
4.  **Delete the `.pkl` file** if you add/remove images from the dataset to force a re-scan.
""")