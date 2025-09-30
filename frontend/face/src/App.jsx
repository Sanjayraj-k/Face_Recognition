import React, { useState, useEffect } from 'react';
import { Search, Image, Sparkles, Loader2, AlertCircle, Info, Zap, Download, Archive } from 'lucide-react';

// You need to import axios in your actual project
// import axios from 'axios';

// Mock axios for this demo - replace with real import above
const axios = {
  get: (url) => fetch(url).then(res => res.json()).then(data => ({ data })),
  post: (url, data) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).then(res => res.json()).then(data => ({ data }))
};

const API_URL = 'http://localhost:5000/search';

// ImageResults Component
const ImageResults = ({ results, onDownloadImage }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {results.map((result, index) => (
        <div
          key={result.path + index}
          className="group bg-white rounded-2xl p-5 border border-gray-200 hover:border-blue-300 transition-all duration-500 hover:scale-[1.02] shadow-sm hover:shadow-xl"
          style={{ 
            animation: `slideUp 0.6s ease-out ${index * 0.1}s both` 
          }}
        >
          <div className="relative overflow-hidden rounded-xl mb-4">
            <img
              src={result.image}
              alt={result.path}
              className="w-full h-48 object-cover transition-transform duration-700 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            {/* Score badge overlay */}
            <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <span className="text-xs font-bold text-gray-800">
                {(result.score * 100).toFixed(1)}%
              </span>
            </div>

            {/* Download button overlay */}
            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={() => onDownloadImage(result)}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-colors duration-200"
                title="Download Image"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="space-y-3">
            {/* File path/name */}
            <div className="flex items-start justify-between">
              <h3 className="text-gray-800 font-semibold text-sm leading-tight flex-1 mr-2">
                {result.path.split('/').pop() || result.path}
              </h3>
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-green-400"></span>
                <span>Match</span>
              </div>
            </div>
            
            {/* Full path tooltip on hover */}
            <div className="text-xs text-gray-500 truncate" title={result.path}>
              {result.path}
            </div>
            
            {/* Score visualization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500 font-medium">Confidence Score</span>
                <span className="text-sm font-bold text-gray-800">
                  {result.score.toFixed(3)}
                </span>
              </div>
              
              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 via-blue-500 to-purple-600 rounded-full transition-all duration-1000 ease-out"
                  style={{ width: `${Math.min(result.score * 100, 100)}%` }}
                />
              </div>
              
              {/* Score interpretation */}
              <div className="flex justify-between text-xs">
                <span className={`font-medium ${
                  result.score > 0.8 ? 'text-emerald-600' : 
                  result.score > 0.6 ? 'text-blue-600' : 
                  result.score > 0.4 ? 'text-yellow-600' : 'text-gray-500'
                }`}>
                  {result.score > 0.8 ? 'Excellent Match' : 
                   result.score > 0.6 ? 'Good Match' : 
                   result.score > 0.4 ? 'Fair Match' : 'Weak Match'}
                </span>
                <span className="text-gray-400">
                  #{index + 1}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

function App() {
  const [textQuery, setTextQuery] = useState('');
  const [k, setK] = useState(2);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [maxK, setMaxK] = useState(20);
  const [downloading, setDownloading] = useState(false);

  // Download helper functions
  const downloadImage = async (result) => {
    try {
      // If result.image is a base64 string
      if (result.image.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = result.image;
        link.download = result.path.split('/').pop() || `image_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // If result.image is a URL, fetch and download
        const response = await fetch(result.image);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = result.path.split('/').pop() || `image_${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      setError('Failed to download image. Please try again.');
    }
  };

  const downloadAllResults = async () => {
    if (results.length === 0) return;
    
    setDownloading(true);
    
    // Create a report with search results
    const report = {
      query: textQuery,
      timestamp: new Date().toISOString(),
      total_results: results.length,
      results: results.map((result, index) => ({
        rank: index + 1,
        filename: result.path.split('/').pop(),
        path: result.path,
        confidence_score: result.score,
        match_quality: result.score > 0.8 ? 'Excellent Match' : 
                      result.score > 0.6 ? 'Good Match' : 
                      result.score > 0.4 ? 'Fair Match' : 'Weak Match'
      }))
    };

    // Download the JSON report
    const reportBlob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const reportUrl = window.URL.createObjectURL(reportBlob);
    const reportLink = document.createElement('a');
    reportLink.href = reportUrl;
    reportLink.download = `clip_search_results_${Date.now()}.json`;
    document.body.appendChild(reportLink);
    reportLink.click();
    document.body.removeChild(reportLink);
    window.URL.revokeObjectURL(reportUrl);

    // Download individual images with delay to prevent overwhelming the browser
    for (let i = 0; i < results.length; i++) {
      try {
        await downloadImage(results[i]);
        // Small delay between downloads
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error downloading image ${i + 1}:`, error);
      }
    }
    
    setDownloading(false);
  };

  // Fetch dataset size on mount
  useEffect(() => {
    axios.get('http://localhost:5000/')
      .then(response => {
        setMaxK(response.data.dataset_size);
        setError(null);
      })
      .catch(err => {
        console.error('Error fetching dataset size:', err);
        setError('Failed to fetch dataset information. Using default maximum results (20). You can still search.');
      });
  }, []);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!textQuery.trim()) {
      setError('Please enter a text description to search.');
      return;
    }
    setError(null);
    setResults([]);
    setLoading(true);

    try {
      const response = await axios.post(API_URL, {
        text_query: textQuery,
        k: parseInt(k),
      });

      setResults(response.data.results || []);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.response?.data?.error || 'An error occurred while searching. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  };

  const suggestedQueries = [
    "child photo",
    "mountain",
    "green background image",
    "green tshirt",
    "man keeping sun glasses in shirt"

  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 relative">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-100 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-100 rounded-full blur-3xl" />
        <div className="absolute top-3/4 left-1/2 w-72 h-72 bg-indigo-100 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center items-center mb-6">
            <div className="p-4 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-xl">
              <Zap className="w-8 h-8 text-white" />
            </div>
          </div>
          <p>
            <span className="text-4xl font-extrabold mb-4 block animated-gradient-text">
              CLIP Image Search
            </span>
            <span className="block text-gray-600 subtitle-gradient">Text to image search using OpenAI's CLIP model</span>
          </p>
          
        </div>

        {/* Search Form */}
        <div className="max-w-4xl mx-auto mb-12">
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xl">
              <div className="space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={textQuery}
                    onChange={(e) => setTextQuery(e.target.value)}
                    placeholder="Describe the image you're looking for..."
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch(e)}
                  />
                </div>
                
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Number of results (max {maxK})
                    </label>
                    <input
                      type="number"
                      value={k}
                      onChange={(e) => setK(Math.min(parseInt(e.target.value) || 1, maxK))}
                      min="1"
                      max={maxK}
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-300"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={handleSearch}
                      disabled={loading}
                      className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
                    >
                      {loading ? (
                        <div className="flex items-center space-x-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Searching...</span>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Sparkles className="w-5 h-5" />
                          <span>Search Images</span>
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Suggested Queries */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4 font-medium">Try these example searches:</p>
            <div className="flex flex-wrap justify-center gap-3">
              {suggestedQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => setTextQuery(query)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-full text-sm text-gray-700 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-700 transition-all duration-300 transform hover:scale-105 shadow-sm hover:shadow-md"
                >
                  {query}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="max-w-4xl mx-auto mb-8">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-red-800 font-semibold">Search Error</p>
                <p className="text-red-700 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl mb-6 shadow-xl">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Analyzing Your Query</h3>
            <p className="text-gray-600">Searching through your image dataset using AI...</p>
          </div>
        )}

        {/* Results */}
        {results.length > 0 && !loading && (
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-3xl p-8 border border-gray-200 shadow-xl mb-8">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">
                    Search Results
                  </h2>
                  <p className="text-gray-600">
                    Found {results.length} matching images for "<span className="font-medium text-gray-800">{textQuery}</span>"
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <button
                    onClick={downloadAllResults}
                    disabled={downloading}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors duration-200 shadow-md hover:shadow-lg"
                  >
                    {downloading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-medium">Downloading...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4" />
                        <span className="text-sm font-medium">Download All</span>
                      </>
                    )}
                  </button>
                  <div className="flex items-center space-x-2 text-gray-500">
                    <Info className="w-4 h-4" />
                    <span className="text-sm font-medium">Sorted by relevance</span>
                  </div>
                </div>
              </div>
            </div>
            
            <ImageResults results={results} onDownloadImage={downloadImage} />
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && !loading && !error && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gray-100 rounded-3xl mb-6">
              <Image className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">Ready to Search</h3>
            <p className="text-gray-500">Enter a description above to find matching images in your dataset.</p>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-20 pt-8 border-t border-gray-200">
          <p className="text-gray-500 font-medium">
            Powered by OpenAI's CLIP • Built with React & Tailwind CSS
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* Animated gradient text for the main title */
        .animated-gradient-text {
          background: linear-gradient(90deg, #06b6d4, #7c3aed, #f97316, #06b6d4);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradientShift 6s ease infinite;
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* Subtle gradient tint for subtitle */
        .subtitle-gradient {
          background: linear-gradient(90deg, rgba(124,58,237,0.08), rgba(14,165,233,0.06));
          padding: 6px 10px;
          border-radius: 8px;
          display: inline-block;
        }
      `}</style>
    </div>
  );
}

export default App;