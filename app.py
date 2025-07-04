from flask import Flask, request, jsonify, session
from flask_cors import CORS
from pymongo import MongoClient
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
import hashlib
import time
from threading import Thread
from werkzeug.utils import secure_filename
from datetime import datetime
import bcrypt
import urllib.parse

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALBUM_FOLDER'] = 'album'
app.config['CACHE_FOLDER'] = 'cache'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SECRET_KEY'] = 'your-secret-key'

# Configure CORS for frontend
CORS(app, supports_credentials=True)

mongo_url = os.environ.get("MONGODB_URL", "mongodb://localhost:27017/")
client = MongoClient(mongo_url)
db = client['snapid_db']
users_collection = db['users']
photos_collection = db['photos']
embeddings_collection = db['embeddings']

# Create required folders
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

# Global variables for cache
cache_last_updated = 0
cache_updating = False

# Custom JSON encoder
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
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super(NumpyEncoder, self).default(obj)

def extract_faces(img_array, confidence_threshold=0.8):
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
    face_img = Image.fromarray(face_img)
    face_tensor = transform(face_img).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = facenet(face_tensor).cpu().numpy()
    return embedding / np.linalg.norm(embedding)

def get_file_hash(file_path):
    hasher = hashlib.md5()
    with open(file_path, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()

def load_cache(username):
    embeddings = embeddings_collection.find({"username": username})
    cache = {}
    for emb in embeddings:
        cache[emb['filepath']] = {
            'hash': emb['hash'],
            'faces': emb['faces']
        }
    print(f"Cache loaded with {len(cache)} entries for user {username}.")
    return cache

def save_cache(username, cache):
    global cache_last_updated
    try:
        embeddings_collection.delete_many({"username": username})
        for filepath, data in cache.items():
            embeddings_collection.insert_one({
                "username": username,
                "filepath": filepath,
                "hash": data['hash'],
                "faces": data['faces'],
                "last_updated": datetime.utcnow()
            })
        cache_last_updated = time.time()
        print(f"Cache saved with {len(cache)} entries for user {username}.")
        return True
    except Exception as e:
        print(f"Error saving cache: {str(e)}")
        return False

def check_album_changes(username, cache):
    user_photos = photos_collection.find({"username": username})
    photo_paths = {photo['filepath'] for photo in user_photos}
    if len(photo_paths) != len(cache):
        return True
    for img_path in photo_paths:
        file_hash = get_file_hash(img_path)
        if img_path not in cache or cache[img_path]['hash'] != file_hash:
            return True
    return False

def update_cache_async(username):
    global cache_updating
    if cache_updating:
        return
    cache_updating = True
    thread = Thread(target=update_cache, args=(username,))
    thread.daemon = True
    thread.start()

def update_cache(username):
    global cache_updating
    try:
        print(f"Starting cache update for user {username}...")
        user_photos = photos_collection.find({"username": username})
        supported_extensions = ['jpg', 'jpeg', 'png']
        new_cache = {}
        for photo in user_photos:
            img_path = photo['filepath']
            if not any(img_path.lower().endswith(ext) for ext in supported_extensions):
                continue
            file_hash = get_file_hash(img_path)
            if img_path in new_cache and new_cache[img_path]['hash'] == file_hash:
                continue
            try:
                img_array = cv2.imread(img_path)
                if img_array is None:
                    continue
                faces, positions = extract_faces(img_array)
                if not faces:
                    continue
                face_data = []
                for face, position in zip(faces, positions):
                    features = extract_features(face)
                    face_data.append({
                        'embedding': features.tolist(),
                        'position': position
                    })
                new_cache[img_path] = {
                    'hash': file_hash,
                    'faces': face_data
                }
            except Exception as e:
                print(f"Error processing {img_path}: {str(e)}")
                continue
        save_cache(username, new_cache)
        print(f"Cache update completed for user {username}.")
    except Exception as e:
        print(f"Error updating cache: {str(e)}")
    finally:
        cache_updating = False

def find_matches_in_album(username, solo_embedding, similarity_threshold=0.3):
    matches = []
    cache = load_cache(username)
    for img_path, cache_entry in cache.items():
        try:
            if 'faces' not in cache_entry or not cache_entry['faces']:
                continue
            matched = False
            best_similarity = 1.0
            best_face_position = None
            for face_data in cache_entry['faces']:
                features = np.array(face_data['embedding'])
                position = face_data['position']
                similarity = float(cosine(solo_embedding.flatten(), features.flatten()))
                if similarity < best_similarity:
                    best_similarity = similarity
                    best_face_position = position
                if similarity < similarity_threshold:
                    matched = True
            if matched:
                similarity_percentage = float((1 - best_similarity) * 100)
                if similarity_percentage <= 70:
                    continue
                img_array = cv2.imread(img_path)
                if img_array is None:
                    continue
                result_img = img_array.copy()
                if best_face_position:
                    x1, y1, x2, y2 = best_face_position
                    cv2.rectangle(result_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
                _, highlighted_buffer = cv2.imencode('.jpg', result_img)
                highlighted_b64 = base64.b64encode(highlighted_buffer).decode('utf-8')
                _, original_buffer = cv2.imencode('.jpg', img_array)
                original_b64 = base64.b64encode(original_buffer).decode('utf-8')
                safe_filename = urllib.parse.quote(os.path.basename(img_path))
                matches.append({
                    "filename": safe_filename,
                    "filepath": img_path,
                    "similarity": similarity_percentage,
                    "image_data": f"data:image/jpeg;base64,{highlighted_b64}",
                    "original_image_data": f"data:image/jpeg;base64,{original_b64}"
                })
        except Exception as e:
            print(f"Error processing cached entry {img_path}: {str(e)}")
            continue
    matches.sort(key=lambda x: x["similarity"], reverse=True)
    return matches

# API Routes
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Invalid request data"}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
    
    user = users_collection.find_one({"username": username})
    if user and bcrypt.checkpw(password.encode('utf-8'), user['password']):
        session['username'] = username
        return jsonify({"success": True, "message": "Logged in successfully", "username": username})
    
    return jsonify({"success": False, "message": "Invalid credentials"}), 401

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Invalid request data"}), 400
    
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
    
    if users_collection.find_one({"username": username}):
        return jsonify({"success": False, "message": "Username already exists"}), 400
    
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    users_collection.insert_one({
        "username": username,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    })
    
    return jsonify({"success": True, "message": "Registered successfully"})

@app.route('/api/upload_album', methods=['POST'])
def upload_album():
    if 'username' not in session:
        return jsonify({"error": "Please login first"}), 401
    
    if 'album_photos' not in request.files:
        return jsonify({"error": "No photos uploaded"}), 400
    
    try:
        username = session['username']
        photos = request.files.getlist('album_photos')
        uploaded_files = []
        
        for photo in photos:
            if photo and photo.filename:
                filename = secure_filename(photo.filename)
                filename = urllib.parse.quote(filename, safe='')
                
                if not filename.lower().endswith(('.jpg', '.jpeg', '.png')):
                    continue
                
                file_path = os.path.join(app.config['ALBUM_FOLDER'], filename)
                photo.save(file_path)
                
                photos_collection.insert_one({
                    "username": username,
                    "filename": filename,
                    "filepath": file_path,
                    "upload_date": datetime.utcnow()
                })
                
                uploaded_files.append(filename)
        
        if uploaded_files:
            update_cache_async(username)
            return jsonify({
                "success": True,
                "message": f"Successfully uploaded {len(uploaded_files)} photos",
                "files": uploaded_files
            })
        else:
            return jsonify({"success": False, "message": "No valid photos uploaded"}), 400
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/check_session', methods=['GET'])
def check_session():
    if 'username' in session:
        return jsonify({"isLoggedIn": True, "username": session['username']})
    return jsonify({"isLoggedIn": False})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('username', None)
    return jsonify({"success": True, "message": "Logged out successfully"})

@app.route('/api/search', methods=['POST'])
def search():
    if 'username' not in session:
        return jsonify({"error": "Please login first"}), 401
    
    if 'solo_photo' not in request.files:
        return jsonify({"error": "Photo is required"}), 400
    
    try:
        username = session['username']
        cache = load_cache(username)
        
        if check_album_changes(username, cache):
            update_cache_async(username)
        
        solo_photo = request.files['solo_photo']
        solo_img_data = np.frombuffer(solo_photo.read(), np.uint8)
        solo_img_array = cv2.imdecode(solo_img_data, cv2.IMREAD_COLOR)
        
        solo_faces, _ = extract_faces(solo_img_array)
        if not solo_faces:
            return jsonify({
                "match_found": False,
                "message": "No face detected in the photo",
                "matches": []
            })
        
        solo_embedding = extract_features(solo_faces[0])
        matches = find_matches_in_album(username, solo_embedding, similarity_threshold=0.5)
        
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

@app.route('/api/update_cache', methods=['POST'])
def force_update_cache():
    if 'username' not in session:
        return jsonify({"error": "Please login first"}), 401
    
    try:
        update_cache(session['username'])
        return jsonify({"success": True, "message": "Cache updated successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/user_stats', methods=['GET'])
def user_stats():
    if 'username' not in session:
        return jsonify({"error": "Please login first"}), 401
    
    try:
        username = session['username']
        photo_count = photos_collection.count_documents({"username": username})
        cache_count = embeddings_collection.count_documents({"username": username})
        
        return jsonify({
            "username": username,
            "photo_count": photo_count,
            "cached_embeddings": cache_count,
            "cache_status": "updating" if cache_updating else "ready"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/delete_photo', methods=['DELETE'])
def delete_photo():
    if 'username' not in session:
        return jsonify({"error": "Please login first"}), 401
    
    data = request.get_json()
    if not data or 'filename' not in data:
        return jsonify({"error": "Filename required"}), 400
    
    try:
        username = session['username']
        filename = data['filename']
        
        # Find and delete the photo record
        photo = photos_collection.find_one({"username": username, "filename": filename})
        if not photo:
            return jsonify({"error": "Photo not found"}), 404
        
        # Delete file from filesystem
        if os.path.exists(photo['filepath']):
            os.remove(photo['filepath'])
        
        # Delete from database
        photos_collection.delete_one({"username": username, "filename": filename})
        
        # Update cache
        update_cache_async(username)
        
        return jsonify({"success": True, "message": "Photo deleted successfully"})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "face-recognition-api",
        "timestamp": datetime.utcnow().isoformat()
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

@app.errorhandler(413)
def too_large(error):
    return jsonify({"error": "File too large. Maximum size is 16MB"}), 413

def initialize_cache():
    for user in users_collection.find():
        username = user['username']
        if check_album_changes(username, load_cache(username)):
            update_cache(username)

# Initialize cache on startup
with app.app_context():
    initialize_cache()
port = int(os.environ.get("PORT", 3000))
app.run(host='0.0.0.0', port=port, debug=True)
