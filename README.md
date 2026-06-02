# Face Recognition & CLIP Image Search

## Overview
This repository contains two Flask-based services and a React frontend:
- **Face recognition API (`app.py`)**: user authentication, photo album uploads, face matching, and downloads using MTCNN + FaceNet with MongoDB-backed caching.
- **CLIP image search API (`image.py`)**: text-to-image retrieval over the `dataset/` directory using OpenAI CLIP.
- **Frontend (`frontend/face/`)**: Vite + React UI (default app targets the CLIP API).

## Key Features
- User registration/login and session handling for album search
- Batch album uploads with face embedding cache
- Face match search with highlighted results and download options
- Text-to-image search using CLIP with base64 image responses

## Repository Structure
- `app.py` — face recognition API (runs on port **3000** by default)
- `image.py` — CLIP search API (runs on port **5000** by default)
- `frontend/face/` — React + Vite client (CLIP search UI in `src/App.jsx`)
- `dataset/` — image dataset for CLIP search
- `album/` — uploaded albums for face recognition
- `cache/` — embedding/cache artifacts for face recognition
- `static/` — legacy static assets (CSS/JS) and cached images
- `dataset_embeddings_clip.pkl` — cached CLIP embeddings

## Requirements
- **Python 3.8+** (for both APIs)
- **MongoDB** running locally for `app.py`
- **Node.js + npm** for the frontend

## Setup
### Python dependencies
```bash
pip install -r requirements.txt
```

## Run the APIs
### Face Recognition API
```bash
python app.py
```
Runs at `http://localhost:3000` and serves routes under `/api/*` (e.g., `/api/login`, `/api/upload_album`, `/api/search`).

### CLIP Image Search API
```bash
python image.py
```
Runs at `http://localhost:5000` and exposes:
- `GET /` (service info and dataset size)
- `POST /search` (JSON: `{ "text_query": "...", "k": 5 }`)

## Run the Frontend
```bash
cd frontend/face
npm install
npm run dev
```
By default, the UI in `src/App.jsx` targets the CLIP API at `http://localhost:5000`.
If you run either API elsewhere, update the base URL constants in the frontend source (search for
`API_URL` and `API_BASE_URL`).
