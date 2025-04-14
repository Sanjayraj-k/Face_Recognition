# Facial-Recognition-Tool-for-Album-Matching

## Glimpse: Intelligent Face Recognition Platform

Glimpse is a powerful web application that enables users to search for matching faces in their photo albums using advanced face recognition technology. Built on Flask, Glimpse uses MTCNN for face detection and FaceNet for extraction of facial embeddings, providing accurate and efficient face search capabilities.

## 🚀 Features

- **Face Detection**: Accurately detects faces in images using MTCNN
- **Face Recognition**: Identifies faces across multiple images using FaceNet embeddings
- **Similarity Matching**: Finds similar faces with customizable threshold settings
- **Caching System**: Optimized performance with a smart caching system for faster searches
- **Interactive UI**: User-friendly interface with drag-and-drop functionality
- **Preview & Download**: View and download matched images with highlighted face regions

## 📋 Requirements

- Python 3.7+
- Flask
- OpenCV (cv2)
- PyTorch & torchvision
- MTCNN
- facenet-pytorch
- NumPy
- SciPy
- PIL (Pillow)

## 🔧 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/glimpse.git
   cd glimpse
   ```

2. Create a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create required directories:
   ```bash
   mkdir -p static/uploads static/album static/cache static/css
   ```

5. Add the CSS file to the static/css directory:
   ```bash
   cp style.css static/css/
   ```

6. Place your album photos in the static/album directory

## 🚀 Usage

1. Start the Flask server:
   ```bash
   python app.py
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

3. Upload a photo containing a face to search for similar faces in your album
4. View and download the matching results

## 💻 Technical Details

### Backend Architecture

- **Face Detection**: Uses MTCNN to detect and extract faces from images
- **Feature Extraction**: Uses FaceNet (Inception-ResNet-V1) to create 512-dimensional embeddings for each face
- **Similarity Matching**: Calculates cosine similarity between face embeddings
- **Caching System**: Stores face embeddings to prevent redundant processing

### Caching System

The platform implements an intelligent caching system that:
- Maintains a cache of face embeddings for all album images
- Detects when album images are added, removed, or modified
- Updates the cache asynchronously to avoid blocking operations
- Validates cache integrity using file hashing

### Face Search Process

1. Face is extracted from the uploaded photo
2. FaceNet generates embedding for the extracted face
3. The system compares this embedding with all cached embeddings
4. Images with similarity scores above the threshold are returned as matches
5. Matching faces are highlighted in the results

## 🔒 Security and Performance

- File size limits to prevent abuse (16MB max)
- Hash-based cache validation
- Asynchronous cache updates to maintain responsiveness
- Error handling for corrupted or invalid images

## 📁 Project Structure

```
glimpse/
├── app.py                  # Main Flask application
├── requirements.txt        # Python dependencies
├── static/
│   ├── css/
│   │   └── style.css       # CSS styles
│   ├── js/
│   │   └── script.js       # JavaScript for UI interactions
│   ├── uploads/            # Temporary storage for uploaded images
│   ├── album/              # User's photo album
│   └── cache/              # Cache storage for face embeddings
└── templates/
    └── index.html          # Main HTML template
```

## 🧠 Model Information

- **Face Detection**: MTCNN (Multi-task Cascaded Convolutional Networks)
- **Face Recognition**: FaceNet with Inception-ResNet-V1 architecture (pretrained on VGGFace2)

## 🛣️ Future Enhancements

- Multi-user support with authentication
- Bulk image processing
- Face clustering functionality
- API for integration with other applications
- Mobile application support

## 🙏 Acknowledgements

- [FaceNet PyTorch](https://github.com/timesler/facenet-pytorch)
- [MTCNN](https://github.com/ipazc/mtcnn)
- [Flask](https://flask.palletsprojects.com/)
