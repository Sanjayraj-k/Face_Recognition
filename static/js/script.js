document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const soloDropArea = document.getElementById('solo-drop-area');
    const soloInput = document.getElementById('solo-input');
    const searchBtn = document.getElementById('search-btn');
    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    const matchStatus = document.getElementById('match-status');
    const matchesContainer = document.getElementById('matches-container');
    const noMatches = document.getElementById('no-matches');
    const tryAgainBtn = document.getElementById('try-again-btn');
    const progressBar = document.getElementById('progress-bar');
    const removeBtn = document.getElementById('remove-btn');
    const removeBtnContainer = document.getElementById('remove-btn-container');
    const soloPreview = document.getElementById('solo-preview');
    const soloDefault = document.getElementById('solo-default');

    // Modal Elements
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const downloadBtn = document.getElementById('downloadBtn');
    const closeBtn = document.querySelector('.close');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const shareBtn = document.getElementById('share-btn');

    // Toast Elements
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    // Form Data
    let soloFile = null;
    let currentScale = 1;

    // Initialize the app
    init();

    function init() {
        setupDragDrop();
        setupEventListeners();
        checkCacheStatus();
    }

    function checkCacheStatus() {
        // You can call this periodically to check cache status
        fetch('/update_cache', { method: 'POST' })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    console.log('Cache is up to date');
                }
            })
            .catch(error => console.error('Cache check failed:', error));
    }

    function setupDragDrop() {
        // Click to select file
        soloDropArea.addEventListener('click', (e) => {
            if (e.target !== removeBtn && e.target !== removeBtnContainer) {
                soloInput.click();
            }
        });

        // Handle file selection
        soloInput.addEventListener('change', () => {
            if (soloInput.files.length) {
                handleFileSelection(soloInput.files[0]);
            }
        });

        // Drag & drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            soloDropArea.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            soloDropArea.addEventListener(eventName, highlight, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            soloDropArea.addEventListener(eventName, unhighlight, false);
        });

        function highlight() {
            soloDropArea.classList.add('highlight');
        }

        function unhighlight() {
            soloDropArea.classList.remove('highlight');
        }

        // Handle dropped files
        soloDropArea.addEventListener('drop', e => {
            if (e.dataTransfer.files.length) {
                handleFileSelection(e.dataTransfer.files[0]);
            }
        }, false);
    }

    function setupEventListeners() {
        // Remove button
        removeBtn.addEventListener('click', resetUpload);

        // Search button
        searchBtn.addEventListener('click', handleSearch);

        // Try again button
        tryAgainBtn.addEventListener('click', resetUpload);

        // Modal controls
        closeBtn.addEventListener('click', closeModal);
        zoomInBtn.addEventListener('click', () => zoomImage(1.1));
        zoomOutBtn.addEventListener('click', () => zoomImage(0.9));
        shareBtn.addEventListener('click', shareImage);

        // Close modal when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closeModal();
            }
        });

        // Reset zoom when modal closes
        imageModal.addEventListener('transitionend', () => {
            if (imageModal.style.display === 'none') {
                currentScale = 1;
            }
        });
    }

    function handleFileSelection(file) {
        // Validate file type
        if (!file.type.match('image.*')) {
            showToast('Please select an image file (JPEG, PNG)', 'error');
            return;
        }

        // Validate file size (16MB max - matches Flask config)
        if (file.size > 16 * 1024 * 1024) {
            showToast('Image must be smaller than 16MB', 'error');
            return;
        }

        soloFile = file;
        displayPreview(file);
        validateSearchForm();
        showToast('Image uploaded successfully', 'success');
    }

    function displayPreview(file) {
        const reader = new FileReader();
        reader.onload = e => {
            soloPreview.style.backgroundImage = `url(${e.target.result})`;
            soloPreview.classList.remove('hidden');
            soloDefault.classList.add('hidden');
            removeBtnContainer.classList.remove('hidden');
        };
        reader.readAsDataURL(file);
    }

    function resetUpload() {
        soloFile = null;
        soloInput.value = '';
        soloPreview.style.backgroundImage = '';
        soloPreview.classList.add('hidden');
        soloDefault.classList.remove('hidden');
        removeBtnContainer.classList.add('hidden');
        validateSearchForm();
        resultsDiv.classList.add('hidden');
    }

    function validateSearchForm() {
        searchBtn.disabled = !soloFile;
    }

    async function handleSearch() {
        if (!soloFile) return;
        
        // Show loading state
        loadingDiv.classList.remove('hidden');
        resultsDiv.classList.add('hidden');
        searchBtn.disabled = true;
        
        // Simulate progress (you can replace this with actual upload progress events)
        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 10;
            if (progress >= 90) clearInterval(progressInterval);
            progressBar.style.width = `${Math.min(progress, 90)}%`;
        }, 300);

        try {
            // Create form data
            const formData = new FormData();
            formData.append('solo_photo', soloFile);  // Matches Flask's request.files['solo_photo']
            
            // Make API request to your Flask backend
            const response = await fetch('/search', {
                method: 'POST',
                body: formData
            });
            
            // Check for HTTP errors
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.error || `Server error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Validate response structure
            if (!data) {
                throw new Error('Empty response from server');
            }
            
            // Clear progress interval and complete the bar
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            
            // Small delay to show completed progress
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Hide loading and show results
            loadingDiv.classList.add('hidden');
            displayResults(data);
            
        } catch (error) {
            console.error('Search error:', error);
            clearInterval(progressInterval);
            loadingDiv.classList.add('hidden');
            searchBtn.disabled = false;
            
            // Specific error messages based on error type
            if (error.message.includes('No face detected')) {
                showToast('No face detected in the photo. Try a clearer image.', 'error');
            } else if (error.message.includes('Server error: 413')) {
                showToast('Image is too large. Maximum size is 16MB.', 'error');
            } else if (error.message.includes('Server error: 415')) {
                showToast('Unsupported image format. Use JPEG or PNG.', 'error');
            } else if (error.message.includes('Failed to fetch')) {
                showToast('Network error. Please check your connection.', 'error');
            } else {
                showToast(error.message || 'Search failed. Please try again.', 'error');
            }
        }
    }

    function displayResults(data) {
        resultsDiv.classList.remove('hidden');
        
        if (data.error) {
            matchStatus.innerHTML = `
                <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded">
                    <div class="flex items-center">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        <strong>Error:</strong> ${data.error}
                    </div>
                </div>
            `;
            noMatches.classList.remove('hidden');
            matchesContainer.classList.add('hidden');
            return;
        }
        
        // Show match status
        if (data.match_found && data.matches && data.matches.length > 0) {
            matchStatus.innerHTML = `
                <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded">
                    <div class="flex items-center">
                        <i class="fas fa-check-circle mr-2"></i>
                        <strong>${data.matches.length} ${data.matches.length === 1 ? 'match' : 'matches'} found!</strong> ${data.message}
                    </div>
                </div>
            `;
            noMatches.classList.add('hidden');
            matchesContainer.classList.remove('hidden');
        } else {
            matchStatus.innerHTML = `
                <div class="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded">
                    <div class="flex items-center">
                        <i class="fas fa-info-circle mr-2"></i>
                        <strong>No matches found.</strong> ${data.message}
                    </div>
                </div>
            `;
            noMatches.classList.remove('hidden');
            matchesContainer.classList.add('hidden');
        }
        
        // Display matches
        matchesContainer.innerHTML = '';
        
        if (data.matches && data.matches.length > 0) {
            data.matches.forEach(match => {
                const matchCard = document.createElement('div');
                matchCard.className = 'match-card bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all';
                
                matchCard.innerHTML = `
                    <div class="relative overflow-hidden h-48 bg-gray-100">
                        <img src="${match.image_data}" alt="Match" class="w-full h-full object-cover transition-transform duration-300 hover:scale-105">
                        <div class="absolute bottom-2 right-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                            ${match.similarity.toFixed(1)}% Match
                        </div>
                    </div>
                    <div class="p-4">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <p class="font-medium text-gray-800 truncate">${match.filename}</p>
                            </div>
                        </div>
                        <div class="flex space-x-2">
                            <button class="preview-btn bg-blue-50 hover:bg-blue-100 text-blue-600 font-medium text-sm py-2 px-4 rounded-lg transition-colors flex items-center w-full justify-center">
                                <i class="fas fa-eye mr-2"></i> Preview
                            </button>
                            <a href="${match.original_image_data}" download="${match.filename}" class="bg-green-50 hover:bg-green-100 text-green-600 font-medium text-sm py-2 px-4 rounded-lg transition-colors flex items-center justify-center">
                                <i class="fas fa-download mr-2"></i>
                            </a>
                        </div>
                    </div>
                `;
                
                // Add preview functionality
                const previewBtn = matchCard.querySelector('.preview-btn');
                previewBtn.addEventListener('click', () => {
                    openModal(match.image_data, match.original_image_data, match.filename);
                });
                
                matchesContainer.appendChild(matchCard);
            });
        }
    }

    function openModal(imageUrl, originalImageUrl, filename) {
        modalImage.src = imageUrl;
        modalTitle.textContent = filename;
        downloadBtn.href = originalImageUrl;
        downloadBtn.download = filename;
        
        // Reset zoom
        currentScale = 1;
        modalImage.style.transform = `scale(${currentScale})`;
        
        // Show modal with animation
        imageModal.style.display = 'block';
        setTimeout(() => {
            imageModal.classList.add('show');
        }, 10);
    }

    function closeModal() {
        imageModal.classList.remove('show');
        setTimeout(() => {
            imageModal.style.display = 'none';
        }, 300);
    }

    function zoomImage(scaleFactor) {
        currentScale *= scaleFactor;
        // Limit zoom
        currentScale = Math.max(0.5, Math.min(currentScale, 3));
        modalImage.style.transform = `scale(${currentScale})`;
        
        // Change cursor based on zoom level
        if (currentScale > 1) {
            modalImage.style.cursor = 'zoom-out';
        } else {
            modalImage.style.cursor = 'zoom-in';
        }
    }

    function shareImage() {
        // Use Web Share API if available
        if (navigator.share) {
            navigator.share({
                title: 'Face Match from Glimpse',
                text: 'Check out this matching face I found!',
                url: modalImage.src
            }).catch(err => {
                showToast('Sharing cancelled', 'info');
            });
        } else {
            // Fallback for browsers without Web Share API
            const shareUrl = `${window.location.origin}/album/${modalTitle.textContent}`;
            showToast('Copy this link to share: ' + shareUrl, 'info');
        }
    }

    function showToast(message, type) {
        // Set message and icon
        toastMessage.textContent = message;
        
        // Set icon and color based on type
        switch(type) {
            case 'success':
                toastIcon.className = 'fas fa-check-circle text-green-400';
                toast.style.backgroundColor = '#10B981';
                break;
            case 'error':
                toastIcon.className = 'fas fa-exclamation-circle text-red-400';
                toast.style.backgroundColor = '#EF4444';
                break;
            case 'warning':
                toastIcon.className = 'fas fa-exclamation-triangle text-yellow-400';
                toast.style.backgroundColor = '#F59E0B';
                break;
            default:
                toastIcon.className = 'fas fa-info-circle text-blue-400';
                toast.style.backgroundColor = '#3B82F6';
        }
        
        // Show toast
        toast.classList.remove('hidden');
        setTimeout(() => {
            toast.classList.add('toast-show');
        }, 10);
        
        // Hide after 3 seconds
        setTimeout(() => {
            toast.classList.remove('toast-show');
            setTimeout(() => {
                toast.classList.add('hidden');
            }, 300);
        }, 3000);
    }
});