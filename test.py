
import streamlit as st
import torch
from transformers import AutoProcessor, GroupViTModel
from PIL import Image
import numpy as np
import os
from sklearn.metrics.pairwise import cosine_similarity
import pickle

# Check PyTorch version
if torch.__version__ < "2.6":
    st.error(f"PyTorch version {torch.__version__} is too old. Please upgrade to 2.6 or higher.")
    st.stop()

st.set_page_config(layout="wide", page_title="GroupViT Image Retrieval")

# --- Configuration ---
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DATASET_DIR = "./dataset"
EMBEDDINGS_CACHE_FILE = "dataset_embeddings.pkl"

# Create dataset directory if it doesn't exist
if not os.path.exists(DATASET_DIR):
    os.makedirs(DATASET_DIR)

# --- Model Loading ---
@st.cache_resource
def load_models():
    """Loads GroupViT model and processor onto the correct device."""
    try:
        processor = AutoProcessor.from_pretrained("nvidia/groupvit-gcc-yfcc")
        model = GroupViTModel.from_pretrained("nvidia/groupvit-gcc-yfcc").to(DEVICE)
        model.eval()
        return processor, model
    except Exception as e:
        st.error(f"Failed to load GroupViT model: {e}")
        st.stop()

with st.spinner("Loading GroupViT models..."):
    processor, model = load_models()
st.sidebar.success(f"Models loaded on: {DEVICE}")

# --- Data Loading ---
def compute_and_cache_embeddings():
    """Compute and cache image embeddings from dataset."""
    st.info("No cache found. Computing dataset embeddings...")
    if not os.path.exists(DATASET_DIR) or not os.listdir(DATASET_DIR):
        st.error(f"Dataset directory '{DATASET_DIR}' is empty or missing. Please upload images.")
        return None, None

    dataset_paths = [os.path.join(DATASET_DIR, f) for f in os.listdir(DATASET_DIR)
                     if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    if not dataset_paths:
        st.error("No valid images found in dataset.")
        return None, None

    embeddings = []
    progress_bar = st.progress(0, text=f"Processing {len(dataset_paths)} images...")

    for i, path in enumerate(dataset_paths):
        try:
            image = Image.open(path).convert("RGB")
            # Include dummy text to provide input_ids
            inputs = processor(images=image, text="dummy", return_tensors="pt", padding=True, truncation=True).to(DEVICE)
            with torch.no_grad():
                outputs = model(**inputs)
                image_emb = outputs.image_embeds.squeeze().cpu().numpy()  # 384-dim
            embeddings.append(image_emb)
        except Exception as e:
            st.warning(f"Could not process image '{os.path.basename(path)}': {e}")
        progress_bar.progress((i + 1) / len(dataset_paths),
                             text=f"Processing {os.path.basename(path)}...")
    progress_bar.empty()

    if not embeddings:
        st.error("No embeddings were generated.")
        return None, None

    embeddings = np.vstack(embeddings)  # (N, 384)
    with open(EMBEDDINGS_CACHE_FILE, 'wb') as f:
        pickle.dump((embeddings, dataset_paths), f)
    st.success("Embeddings computed and cached successfully!")
    return embeddings, dataset_paths

# --- Load or Compute Embeddings ---
dataset_embs, dataset_paths = None, None
if os.path.exists(EMBEDDINGS_CACHE_FILE):
    try:
        with open(EMBEDDINGS_CACHE_FILE, 'rb') as f:
            dataset_embs, dataset_paths = pickle.load(f)
        # Validate embedding dimensions (GroupViT uses 384-dim)
        if dataset_embs.shape[1] != model.config.vision_config.hidden_size:
            st.warning(f"Cache has wrong dimensions ({dataset_embs.shape[1]}). Recomputing...")
            dataset_embs, dataset_paths = compute_and_cache_embeddings()
    except Exception as e:
        st.warning(f"Cache load failed, recomputing. Error: {e}")
        dataset_embs, dataset_paths = compute_and_cache_embeddings()
else:
    dataset_embs, dataset_paths = compute_and_cache_embeddings()

if dataset_embs is None:
    st.stop()

# --- Streamlit UI ---
st.title("Text-to-Image Retrieval with GroupViT")
st.markdown("Search your dataset using text queries (e.g., 'green background near tree').")

if dataset_embs is not None:
    text_query = st.text_input("Describe the image:", value="green background near tree")
    k = st.slider("Number of matches:", 1, min(20, len(dataset_paths)), 5)

    if st.button("Search", type="primary"):
        if not text_query.strip():
            st.warning("Enter a valid text description.")
        else:
            with st.spinner("Searching..."):
                try:
                    # Use dummy pixel_values for text encoding
                    dummy_image = torch.zeros(1, 3, 224, 224).to(DEVICE)  # Dummy 224x224 RGB image
                    text_inputs = processor(text=text_query, images=dummy_image, return_tensors="pt", padding=True, truncation=True).to(DEVICE)
                    with torch.no_grad():
                        outputs = model(**text_inputs)
                        text_emb = outputs.text_embeds.squeeze().cpu().numpy()  # 384-dim
                    text_emb_norm = text_emb / np.linalg.norm(text_emb)
                except Exception as e:
                    st.error(f"Failed to encode text query: {e}")
                    st.stop()

                # Normalize image embeddings
                try:
                    dataset_embs_norm = dataset_embs / np.linalg.norm(dataset_embs, axis=1, keepdims=True)
                except Exception as e:
                    st.error(f"Error normalizing embeddings: {e}")
                    st.stop()

                # Compute similarities
                try:
                    logit_scale = model.logit_scale.exp().item()
                    similarities = logit_scale * cosine_similarity([text_emb_norm], dataset_embs_norm)[0]
                    top_indices = np.argsort(similarities)[::-1][:k]
                except Exception as e:
                    st.error(f"Error computing similarities: {e}")
                    st.stop()

                # Display results
                st.subheader(f"Top {k} Matches:")
                cols = st.columns(min(k, 5))
                for i, idx in enumerate(top_indices):
                    with cols[i % len(cols)]:
                        try:
                            st.image(dataset_paths[idx],
                                     caption=f"Score: {similarities[idx]:.3f}",
                                     use_column_width=True)
                        except Exception as e:
                            st.warning(f"Failed to display image '{dataset_paths[idx]}': {e}")

# Sidebar
st.sidebar.title("Instructions")
st.sidebar.markdown("""
1. Upload images to a `dataset` folder in AI Studio.
2. Run the script to start the Streamlit app.
3. If errors occur, delete `dataset_embeddings.pkl` and restart.
4. For face recognition, consider using FaceNet for better results.
""")
