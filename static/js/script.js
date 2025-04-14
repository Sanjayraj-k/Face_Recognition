// DOM Elements
const soloDropArea = document.getElementById('solo-drop-area');
const soloInput = document.getElementById('solo-input');
const searchBtn = document.getElementById('search-btn');
const loadingDiv = document.getElementById('loading');
const resultsDiv = document.getElementById('results');
const matchStatus = document.getElementById('match-status');
const matchesContainer = document.getElementById('matches-container');
const noMatches = document.getElementById('no-matches');

// Modal Elements
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const downloadBtn = document.getElementById('downloadBtn');
const closeBtn = document.querySelector('.close');

// Form Data
let soloFile = null;

// Setup drag & drop and file selection for Solo Photo
setupDragDrop(soloDropArea, soloInput, file => {
    soloFile = file;
    displayPreview(file, soloDropArea);
    validateSearchForm();
});

// Setup drag & drop functionality
function setupDragDrop(dropArea, fileInput, onFileSelected) {
    // Click to select file
    dropArea.addEventListener('click', () => fileInput.click());
    
    // Handle file selection
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            onFileSelected(fileInput.files[0]);
        }
    });
    
    // Drag & drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    // Highlight drop area when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('highlight');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('highlight');
        }, false);
    });
    
    // Handle dropped files
    dropArea.addEventListener('drop', e => {
        if (e.dataTransfer.files.length) {
            onFileSelected(e.dataTransfer.files[0]);
        }
    }, false);
}

// Display image preview
function displayPreview(file, container) {
    const reader = new FileReader();
    reader.onload = e => {
        container.style.backgroundImage = `url(${e.target.result})`;
        
        // Hide default content
        const defaultContent = container.querySelector('div');
        if (defaultContent) {
            defaultContent.classList.add('hidden');
        }
    };
    reader.readAsDataURL(file);
}

// Validate search form
function validateSearchForm() {
    searchBtn.disabled = !soloFile;
}

// Handle search button click
searchBtn.addEventListener('click', async () => {
    if (!soloFile) return;
    
    // Show loading spinner
    loadingDiv.classList.remove('hidden');
    resultsDiv.classList.add('hidden');
    
    // Create form data
    const formData = new FormData();
    formData.append('solo_photo', soloFile);
    
    try {
        // Send request to server
        const response = await fetch('/search', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        // Hide loading spinner
        loadingDiv.classList.add('hidden');
        
        // Display results
        displayResults(data);
    } catch (error) {
        console.error('Error:', error);
        loadingDiv.classList.add('hidden');
        alert('An error occurred during search. Please try again.');
    }
});

// Modal handling functions
function openModal(imageUrl, originalImageUrl, filename) {
    modalImage.src = imageUrl;
    modalTitle.textContent = filename;
    downloadBtn.href = originalImageUrl;
    downloadBtn.download = `original_${filename}`;
    imageModal.style.display = 'block';
}

function closeModal() {
    imageModal.style.display = 'none';
}

// Close modal when clicking the X
closeBtn.addEventListener('click', closeModal);

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    if (e.target === imageModal) {
        closeModal();
    }
});

// Display search results
function displayResults(data) {
    resultsDiv.classList.remove('hidden');
    
    // Display match status
    if (data.error) {
        matchStatus.innerHTML = `<div class="text-red-600 font-medium">Error: ${data.error}</div>`;
        return;
    }
    
    // Show match status
    if (data.match_found) {
        matchStatus.innerHTML = `
            <div class="bg-green-100 text-green-800 px-4 py-3 rounded-md">
                <span class="font-bold">${data.message}</span>
            </div>
        `;
        noMatches.classList.add('hidden');
    } else {
        matchStatus.innerHTML = `
            <div class="bg-red-100 text-red-800 px-4 py-3 rounded-md">
                <span class="font-bold">No matches found.</span> ${data.message}
            </div>
        `;
        noMatches.classList.remove('hidden');
    }
    
    // Display matches
    matchesContainer.innerHTML = '';
    
    if (data.matches && data.matches.length > 0) {
        data.matches.forEach(match => {
            const matchCard = document.createElement('div');
            matchCard.className = 'bg-white border rounded-lg overflow-hidden shadow-md';
            
            matchCard.innerHTML = `
                <div class="p-2">
                    <img src="${match.image_data}" alt="Match" class="w-full h-48 object-cover">
                </div>
                <div class="p-4">
                    <div class="flex justify-between items-center mb-2">
                        <p class="text-sm text-gray-600 truncate">${match.filename}</p>
                        <span class="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded">
                            ${match.similarity.toFixed(1)}% Match
                        </span>
                    </div>
                    <div class="flex space-x-2">
                        <button class="preview-btn bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-medium text-xs py-1 px-3 rounded transition">
                            Preview
                        </button>
                        <a href="${match.original_image_data}" download="${match.filename}" class="bg-green-100 hover:bg-green-200 text-green-700 font-medium text-xs py-1 px-3 rounded transition text-center">
                            Download
                        </a>
                    </div>
                </div>
            `;
            
            // Add preview functionality
            const previewBtn = matchCard.querySelector('.preview-btn');
            previewBtn.addEventListener('click', () => {
                // Show the image with bounding box in the preview
                openModal(match.image_data, match.original_image_data, match.filename);
            });
            
            matchesContainer.appendChild(matchCard);
        });
        
        matchesContainer.classList.remove('hidden');
    } else {
        matchesContainer.classList.add('hidden');
    }
}