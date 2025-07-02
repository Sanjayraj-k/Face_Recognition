import React, { useState, useRef, useEffect } from 'react';
import { Upload, Search, User, LogOut, Camera, Image, RefreshCw, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';

// Define the absolute URL for your backend API
const API_BASE_URL = 'http://localhost:3000/api';

const SnapIDApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(true); // Start with loading true for session check
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchResults, setSearchResults] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  
  // Form states
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ username: '', password: '' });
  
  // File refs
  const albumFileRef = useRef(null);
  const searchFileRef = useRef(null);

  // Check for existing session on component mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/check_session`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          if (data.isLoggedIn) {
            setCurrentUser(data.username);
            setActiveTab('upload');
          }
        }
      } catch (error) {
        console.error("Session check failed:", error);
        showMessage('error', 'Could not connect to the backend server.');
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setCurrentUser(data.username);
        setActiveTab('upload');
        showMessage('success', 'Logged in successfully!');
        setLoginForm({ username: '', password: '' });
      } else {
        showMessage('error', data.message || 'Login failed');
      }
    } catch (error) {
      showMessage('error', 'Network error. Please try again.');
    }
    
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerForm)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        showMessage('success', 'Registration successful! Please login.');
        setActiveTab('login');
        setRegisterForm({ username: '', password: '' });
      } else {
        showMessage('error', data.message || 'Registration failed');
      }
    } catch (error) {
      showMessage('error', 'Network error. Please try again.');
    }
    
    setLoading(false);
  };

  const handleAlbumUpload = async (files) => {
    if (!files || files.length === 0) return;
    
    setLoading(true);
    setUploadProgress(0);
    
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('album_photos', file);
    });
    
    try {
      const response = await fetch(`${API_BASE_URL}/upload_album`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        showMessage('success', data.message);
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 2000);
      } else {
        showMessage('error', data.message || data.error || 'Upload failed');
      }
    } catch (error) {
      showMessage('error', 'Upload failed. Please try again.');
    }
    
    setLoading(false);
  };

  const handleSearch = async (file) => {
    if (!file) return;
    
    setLoading(true);
    setSearchResults([]);
    
    const formData = new FormData();
    formData.append('solo_photo', file);
    
    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSearchResults(data.matches || []);
        showMessage(data.match_found ? 'success' : 'info', data.message);
      } else {
        showMessage('error', data.error || 'Search failed');
      }
    } catch (error) {
      showMessage('error', 'Search failed. Please try again.');
    }
    
    setLoading(false);
  };

  const updateCache = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/update_cache`, { 
          method: 'POST',
          credentials: 'include'
      });
      const data = await response.json();
      
      if (response.ok && data.success) {
        showMessage('success', 'Cache updated successfully!');
      } else {
        showMessage('error', data.message || data.error || 'Cache update failed');
      }
    } catch (error) {
      showMessage('error', 'Network error during cache update');
    }
    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error("Logout API call failed:", error);
    } finally {
      setCurrentUser(null);
      setActiveTab('login');
      setSearchResults([]);
      setLoading(false);
      showMessage('info', 'Logged out successfully');
    }
  };

  // Initial loading screen
  if (loading && !currentUser) {
    return (
        <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
                <p className="text-gray-700 font-medium">Loading SnapID...</p>
            </div>
        </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <Camera className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">SnapID</h1>
              <p className="text-gray-600">Face Recognition Made Simple</p>
            </div>

            {message.text && (
              <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
                message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                'bg-blue-50 text-blue-800 border border-blue-200'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                 message.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
                 <AlertCircle className="w-5 h-5" />}
                {message.text}
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="flex border-b">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-4 px-6 font-medium transition-colors ${
                    activeTab === 'login'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  Login
                </button>
                <button
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 py-4 px-6 font-medium transition-colors ${
                    activeTab === 'register'
                      ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-blue-600'
                  }`}
                >
                  Register
                </button>
              </div>

              <div className="p-6">
                {activeTab === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Enter your username"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                          className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Enter your password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
                      {loading ? 'Logging in...' : 'Login'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Username
                      </label>
                      <input
                        type="text"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        placeholder="Choose a username"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                          className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          placeholder="Create a password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-medium hover:from-purple-700 hover:to-pink-700 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <User className="w-5 h-5" />}
                      {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">SnapID</h1>
                <p className="text-sm text-gray-600">Welcome, {currentUser}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={updateCache}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Update Cache</span>
              </button>
              <button
                onClick={logout}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {message.text && (
          <div className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
            message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
            message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
            'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
             message.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
             <AlertCircle className="w-5 h-5" />}
            {message.text}
          </div>
        )}

        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap gap-2 mb-8 bg-white rounded-xl p-2 shadow-lg">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 min-w-0 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload Album</span>
              <span className="sm:hidden">Upload</span>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 min-w-0 px-6 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                activeTab === 'search'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Face Search</span>
              <span className="sm:hidden">Search</span>
            </button>
          </div>

          {activeTab === 'upload' && (
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <Image className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Upload Your Album</h2>
                <p className="text-gray-600">Add photos to your album for face recognition search</p>
              </div>

              <input
                type="file"
                ref={albumFileRef}
                multiple
                accept=".jpg,.jpeg,.png"
                onChange={(e) => handleAlbumUpload(e.target.files)}
                className="hidden"
              />

              <div
                onClick={() => albumFileRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-blue-400 hover:bg-blue-50 transition-all cursor-pointer group"
              >
                <Upload className="w-12 h-12 text-gray-400 group-hover:text-blue-600 mx-auto mb-4 transition-colors" />
                <p className="text-lg font-medium text-gray-700 group-hover:text-blue-700 mb-2">
                  Click to upload photos
                </p>
                <p className="text-gray-500">
                  Select multiple photos (JPG, PNG supported)
                </p>
              </div>

              {uploadProgress > 0 && (
                <div className="mt-6">
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-gray-600">{uploadProgress === 100 ? 'Upload Complete!' : 'Uploading...'}</span>
                    <span className="text-sm text-gray-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'search' && (
            <div className="space-y-8">
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <Search className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Face Search</h2>
                  <p className="text-gray-600">Upload a photo to find similar faces in your album</p>
                </div>

                <input
                  type="file"
                  ref={searchFileRef}
                  accept=".jpg,.jpeg,.png"
                  onChange={(e) => handleSearch(e.target.files[0])}
                  className="hidden"
                />

                <div
                  onClick={() => searchFileRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer group"
                >
                  <Camera className="w-12 h-12 text-gray-400 group-hover:text-purple-600 mx-auto mb-4 transition-colors" />
                  <p className="text-lg font-medium text-gray-700 group-hover:text-purple-700 mb-2">
                    Upload photo to search
                  </p>
                  <p className="text-gray-500">
                    Select a photo with a clear face
                  </p>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="bg-white rounded-2xl shadow-xl p-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-6">
                    Search Results ({searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'} found)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {searchResults.map((result, index) => (
                      <div key={index} className="group relative overflow-hidden rounded-xl shadow-lg hover:shadow-xl transition-all">
                        <img
                          src={result.image_data}
                          alt={result.filename}
                          className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                          <p className="font-medium truncate">{decodeURIComponent(result.filename)}</p>
                          <p className="text-sm opacity-90">
                            {Math.round(result.similarity)}% match
                          </p>
                        </div>
                        <div className="absolute top-3 right-3">
                          <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                            {Math.round(result.similarity)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <p className="text-gray-700 font-medium">Processing...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SnapIDApp;