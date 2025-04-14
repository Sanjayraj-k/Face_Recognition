# app.py - Optimized with caching for faster face search
from flask import Flask, request, jsonify, render_template, url_for, send_from_directory
import os
import cv2
import numpy as np
import torch
import torchvision.transforms as transforms
import base64
from PIL import Image
from mtcnn import MTCNN
from facenet_pytorch import InceptionResnetV1
from scipy.spatial.distance import cosine
import json
import glob
import pickle
import hashlib
import time
from threading import Thread

app = Flask(__name__, static_folder='static', static_url_path='/static')
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['ALBUM_FOLDER'] = 'static/album'  # Folder containing the image album
app.config['CACHE_FOLDER'] = 'static/cache'  # Folder for storing face embeddings cache
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create required folders if they don't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['ALBUM_FOLDER'], exist_ok=True)
os.makedirs(app.config['CACHE_FOLDER'], exist_ok=True)

# Initialize MTCNN & FaceNet
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
detector = MTCNN()
facenet = InceptionResnetV1(pretrained='vggface2').eval().to(device)

# Tensor Transform
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Resize((160, 160)),
    transforms.Normalize(mean=[0.5], std=[0.5])
])

# Cache file path
CACHE_FILE = os.path.join(app.config['CACHE_FOLDER'], 'face_embeddings_cache.pkl')
CACHE_METADATA_FILE = os.path.join(app.config['CACHE_FOLDER'], 'cache_metadata.json')

# Global variables for cache
face_embeddings_cache = {}
cache_last_updated = 0
cache_updating = False

# Custom JSON encoder to handle NumPy types
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, np.bool_):
            return bool(obj)
        return super(NumpyEncoder, self).default(obj)

def extract_faces(img_array, confidence_threshold=0.8):
    """Extract faces using MTCNN, keeping original image resolution."""
    if img_array is None:
        return [], []

    rgb_img = cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB)
    faces = detector.detect_faces(rgb_img)

    face_images, face_positions = [], []
    for face in faces:
        if face['confidence'] >= confidence_threshold:
            x, y, w, h = face['box']
            x1, y1, x2, y2 = max(0, x), max(0, y), min(rgb_img.shape[1], x + w), min(rgb_img.shape[0], y + h)
            face_img = rgb_img[y1:y2, x1:x2]
            if face_img.size > 0:
                face_images.append(face_img)
                face_positions.append((x1, y1, x2, y2))

    return face_images, face_positions

def extract_features(face_img):
    """Extract 512D FaceNet embedding with correct input processing."""
    face_img = Image.fromarray(face_img)
    face_tensor = transform(face_img).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = facenet(face_tensor).cpu().numpy()
    return embedding / np.linalg.norm(embedding)

def get_file_hash(file_path):
    """Generate a hash of file contents for cache validation."""
    hasher = hashlib.md5()
    with open(file_path, 'rb') as f:
        buf = f.read(65536)  # Read in 64kb chunks
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def load_cache():
    """Load the face embeddings cache if it exists."""
    global face_embeddings_cache, cache_last_updated
    
    # If cache file exists, load it
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'rb') as f:
                face_embeddings_cache = pickle.load(f)
                
            # Load cache metadata
            if os.path.exists(CACHE_METADATA_FILE):
                with open(CACHE_METADATA_FILE, 'r') as f:
                    metadata = json.load(f)
                    cache_last_updated = metadata.get('last_updated', 0)
            
            print(f"Cache loaded with {len(face_embeddings_cache)} entries.")
            return True
        except Exception as e:
            print(f"Error loading cache: {str(e)}")
            face_embeddings_cache = {}
            return False
    return False

def save_cache():
    """Save the face embeddings cache to disk."""
    global cache_last_updated
    
    try:
        with open(CACHE_FILE, 'wb') as f:
            pickle.dump(face_embeddings_cache, f)
        
        # Save cache metadata
        cache_last_updated = time.time()
        with open(CACHE_METADATA_FILE, 'w') as f:
            json.dump({
                'last_updated': cache_last_updated,
                'size': len(face_embeddings_cache)
            }, f)
        
        print(f"Cache saved with {len(face_embeddings_cache)} entries.")
        return True
    except Exception as e:
        print(f"Error saving cache: {str(e)}")
        return False

def check_album_changes():
    """Check if album folder has been modified since last cache update."""
    album_path = app.config['ALBUM_FOLDER']
    supported_extensions = ['jpg', 'jpeg', 'png']
    
    # Get all image files
    image_files = []
    for ext in supported_extensions:
        image_files.extend(glob.glob(os.path.join(album_path, f"*.{ext}")))
    
    # Check if number of files has changed
    if len(image_files) != len(face_embeddings_cache):
        return True
    
    # Check if any files have been modified
    for img_path in image_files:
        file_hash = get_file_hash(img_path)
        if img_path not in face_embeddings_cache or face_embeddings_cache[img_path]['hash'] != file_hash:
            return True
    
    return False

def update_cache_async():
    """Update cache in a background thread."""
    global cache_updating
    
    if cache_updating:
        return
    
    cache_updating = True
    thread = Thread(target=update_cache)
    thread.daemon = True
    thread.start()

def update_cache():
    """Process all album images and update the face embeddings cache."""
    global face_embeddings_cache, cache_updating
    
    try:
        print("Starting cache update...")
        album_path = app.config['ALBUM_FOLDER']
        supported_extensions = ['jpg', 'jpeg', 'png']
        
        # Get all image files
        image_files = []
        for ext in supported_extensions:
            image_files.extend(glob.glob(os.path.join(album_path, f"*.{ext}")))
        
        # Create a new cache
        new_cache = {}
        
        # Process each image
        for img_path in image_files:
            file_hash = get_file_hash(img_path)
            
            # Check if image is already in cache with same hash
            if img_path in face_embeddings_cache and face_embeddings_cache[img_path]['hash'] == file_hash:
                new_cache[img_path] = face_embeddings_cache[img_path]
                continue
            
            # Process new or changed image
            try:
                img_array = cv2.imread(img_path)
                if img_array is None:
                    continue
                
                # Extract faces
                faces, positions = extract_faces(img_array)
                
                if not faces:
                    continue
                
                # Process each face in the image
                face_data = []
                for face, position in zip(faces, positions):
                    # Extract features
                    features = extract_features(face)
                    
                    face_data.append({
                        'embedding': features,
                        'position': position
                    })
                
                # Add to new cache
                new_cache[img_path] = {
                    'hash': file_hash,
                    'faces': face_data
                }
                
            except Exception as e:
                print(f"Error processing {img_path}: {str(e)}")
                continue
        
        # Replace old cache with new cache
        face_embeddings_cache = new_cache
        
        # Save the cache
        save_cache()
        print("Cache update completed.")
    except Exception as e:
        print(f"Error updating cache: {str(e)}")
    finally:
        cache_updating = False

def find_matches_in_album(solo_embedding, similarity_threshold=0.6):
    """Find all images in the album that contain the query face using cache."""
    matches = []
    
    # Iterate through cache entries
    for img_path, cache_entry in face_embeddings_cache.items():
        try:
            # Skip if no faces in this image
            if 'faces' not in cache_entry or not cache_entry['faces']:
                continue
            
            # Check if any face matches the query face
            matched = False
            best_similarity = 1.0  # Initialize with worst possible similarity (cosine=1)
            best_face_position = None
            
            for face_data in cache_entry['faces']:
                # Get cached embedding
                features = face_data['embedding']
                position = face_data['position']
                
                # Calculate similarity (cosine distance)
                similarity = float(cosine(solo_embedding.flatten(), features.flatten()))
                
                # Check if this face is a better match than previous ones
                if similarity < best_similarity:
                    best_similarity = similarity
                    best_face_position = position
                    
                # If below threshold, consider it a match
                if similarity < similarity_threshold:
                    matched = True
            
            # If matched, add to results
            if matched:
                # Read the original image
                img_array = cv2.imread(img_path)
                if img_array is None:
                    continue
                    
                # Create a copy of the image with the matched face highlighted
                result_img = img_array.copy()
                if best_face_position:
                    x1, y1, x2, y2 = best_face_position
                    cv2.rectangle(result_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                
                # Convert both original and highlighted images to base64 for display
                _, highlighted_buffer = cv2.imencode('.jpg', result_img)
                highlighted_b64 = base64.b64encode(highlighted_buffer).decode('utf-8')
                
                # Convert original image to base64 for download
                _, original_buffer = cv2.imencode('.jpg', img_array)
                original_b64 = base64.b64encode(original_buffer).decode('utf-8')
                
                # Add to matches
                matches.append({
                    "filename": os.path.basename(img_path),
                    "filepath": img_path,
                    "similarity": float((1 - best_similarity) * 100),  # Convert to percentage
                    "image_data": f"data:image/jpeg;base64,{highlighted_b64}",
                    "original_image_data": f"data:image/jpeg;base64,{original_b64}"
                })
        
        except Exception as e:
            print(f"Error processing cached entry {img_path}: {str(e)}")
            continue
    
    # Sort matches by similarity (highest first)
    matches.sort(key=lambda x: x["similarity"], reverse=True)
    
    return matches

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/search', methods=['POST'])
def search():
    if 'solo_photo' not in request.files:
        return jsonify({"error": "Photo is required"}), 400
    
    try:
        # Ensure cache is loaded
        if not face_embeddings_cache:
            load_cache()
        
        # Check if cache needs updating (but don't wait for it)
        if check_album_changes():
            update_cache_async()
        
        # Read solo image
        solo_photo = request.files['solo_photo']
        solo_img_data = np.frombuffer(solo_photo.read(), np.uint8)
        solo_img_array = cv2.imdecode(solo_img_data, cv2.IMREAD_COLOR)
        
        # Extract face from solo photo
        solo_faces, _ = extract_faces(solo_img_array)
        
        if not solo_faces:
            return jsonify({
                "match_found": False,
                "message": "No face detected in the photo",
                "matches": []
            })
        
        # Extract features from the first face
        solo_embedding = extract_features(solo_faces[0])
        
        # Find matches in the album using cache
        matches = find_matches_in_album(solo_embedding, similarity_threshold=0.5)

        
        return app.response_class(
            response=json.dumps({
                "match_found": len(matches) > 0,
                "message": f"Found {len(matches)} matching images" if matches else "No matches found in your album",
                "matches": matches
            }, cls=NumpyEncoder),
            status=200,
            mimetype='application/json'
        )
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/album/<path:filename>')
def album_file(filename):
    return send_from_directory(app.config['ALBUM_FOLDER'], filename)

@app.route('/update_cache', methods=['POST'])
def force_update_cache():
    """Admin endpoint to force cache update."""
    update_cache()
    return jsonify({"success": True, "message": "Cache updated successfully"})

# Initialize cache on startup - FIXED VERSION
# Instead of @app.before_first_request decorator, we use this approach
def initialize_cache():
    if not load_cache() or check_album_changes():
        update_cache()

# Execute initialization when app is imported
with app.app_context():
    initialize_cache()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)