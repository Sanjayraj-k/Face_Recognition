import React, { useState, useRef, useEffect } from 'react';
import { Upload, Search, User, LogOut, Camera, Image, RefreshCw, Eye, EyeOff, AlertCircle, CheckCircle, Loader2, Star, Sparkles } from 'lucide-react';

// Define the absolute URL for your backend API
const API_BASE_URL = 'http://localhost:3000/api';

const SnapIDApp = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(true);
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
        showMessage('success', 'Welcome back! Logged in successfully.');
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
        showMessage('success', 'Account created successfully! Please login to continue.');
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
        showMessage('success', 'Cache updated successfully! Your search index is now current.');
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
      showMessage('info', 'See you next time! Logged out successfully.');
    }
  };

  // Initial loading screen
  if (loading && !currentUser) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center animate-pulse">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-ping opacity-75"></div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">SnapID</h1>
            <p className="text-gray-300 font-medium">Initializing face recognition...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Logo and title */}
            <div className="text-center mb-8">
              <div className="relative inline-block mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center transform rotate-12 hover:rotate-0 transition-transform duration-500">
                  <Camera className="w-10 h-10 text-white" />
                </div>
                <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-yellow-400 animate-bounce" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-3">
                SnapID
              </h1>
              <p className="text-gray-300 text-lg">AI-Powered Face Recognition</p>
              <p className="text-gray-400 text-sm mt-2">Find faces in seconds, not hours</p>
            </div>

            {/* Message display */}
            {message.text && (
              <div className={`mb-6 p-4 rounded-2xl backdrop-blur-xl border flex items-center gap-3 transform animate-fadeIn ${
                message.type === 'success' 
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300' 
                  : message.type === 'error' 
                  ? 'bg-red-500/20 border-red-500/30 text-red-300' 
                  : 'bg-blue-500/20 border-blue-500/30 text-blue-300'
              }`}>
                {message.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
                 message.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
                 <AlertCircle className="w-5 h-5" />}
                {message.text}
              </div>
            )}

            {/* Auth card */}
            <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
              <div className="flex">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-6 px-6 font-medium transition-all duration-300 relative ${
                    activeTab === 'login'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {activeTab === 'login' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-sm"></div>
                  )}
                  <span className="relative z-10">Welcome Back</span>
                </button>
                <button
                  onClick={() => setActiveTab('register')}
                  className={`flex-1 py-6 px-6 font-medium transition-all duration-300 relative ${
                    activeTab === 'register'
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {activeTab === 'register' && (
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 backdrop-blur-sm"></div>
                  )}
                  <span className="relative z-10">Get Started</span>
                </button>
              </div>

              <div className="p-8">
                {activeTab === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-3">
                        Username
                      </label>
                      <input
                        type="text"
                        value={loginForm.username}
                        onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                        className="w-full px-4 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all backdrop-blur-sm"
                        placeholder="Enter your username"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-3">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={loginForm.password}
                          onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                          className="w-full px-4 py-4 pr-12 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all backdrop-blur-sm"
                          placeholder="Enter your password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white py-4 rounded-2xl font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-3 group"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <User className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      )}
                      {loading ? 'Signing you in...' : 'Sign In'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-3">
                        Choose Username
                      </label>
                      <input
                        type="text"
                        value={registerForm.username}
                        onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                        className="w-full px-4 py-4 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all backdrop-blur-sm"
                        placeholder="Pick a unique username"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 mb-3">
                        Create Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          value={registerForm.password}
                          onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                          className="w-full px-4 py-4 pr-12 rounded-2xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all backdrop-blur-sm"
                          placeholder="Make it secure!"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 text-white py-4 rounded-2xl font-medium hover:shadow-lg hover:shadow-pink-500/25 transition-all transform hover:scale-105 disabled:opacity-50 disabled:transform-none flex items-center justify-center gap-3 group"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Star className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      )}
                      {loading ? 'Creating your account...' : 'Create Account'}
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative">
      {/* Header */}
      <header className="bg-white/70 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40 shadow-sm">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  SnapID
                </h1>
                <p className="text-sm text-gray-600">Hello, {currentUser} 👋</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={updateCache}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all duration-200"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : 'hover:rotate-180 transition-transform duration-500'}`} />
                <span className="hidden sm:inline font-medium">Sync</span>
              </button>
              <button
                onClick={logout}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline font-medium">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Message display */}
        {message.text && (
          <div className={`mb-8 p-6 rounded-2xl backdrop-blur-xl border flex items-center gap-3 shadow-lg transform animate-slideDown ${
            message.type === 'success' 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800' 
              : message.type === 'error' 
              ? 'bg-red-50/80 border-red-200 text-red-800' 
              : 'bg-blue-50/80 border-blue-200 text-blue-800'
          }`}>
            {message.type === 'success' ? (
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
            ) : message.type === 'error' ? (
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        )}

        <div className="max-w-6xl mx-auto">
          {/* Tab navigation */}
          <div className="flex gap-4 mb-8 bg-white/60 backdrop-blur-xl rounded-2xl p-2 shadow-lg border border-gray-200/50">
            <button
              onClick={() => setActiveTab('upload')}
              className={`flex-1 px-8 py-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-3 ${
                activeTab === 'upload'
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25 transform scale-105'
                  : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
              }`}
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">Upload Photos</span>
              <span className="sm:hidden">Upload</span>
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 px-8 py-4 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-3 ${
                activeTab === 'search'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 transform scale-105'
                  : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
              }`}
            >
              <Search className="w-5 h-5" />
              <span className="hidden sm:inline">Find Faces</span>
              <span className="sm:hidden">Search</span>
            </button>
          </div>

          {/* Upload tab */}
          {activeTab === 'upload' && (
            <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-gray-200/50">
              <div className="text-center mb-10">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-purple-100 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                  <Image className="w-10 h-10 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Build Your Photo Album</h2>
                <p className="text-gray-600 text-lg">Upload your photos to create a searchable face database</p>
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
                className="relative border-2 border-dashed border-gray-300 rounded-3xl p-16 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative z-10">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                    <Upload className="w-8 h-8 text-white" />
                  </div>
                  <p className="text-xl font-semibold text-gray-700 group-hover:text-blue-700 mb-3 transition-colors">
                    Drop photos here or click to browse
                  </p>
                  <p className="text-gray-500 text-lg">
                    Select multiple photos • JPG, PNG supported • Max 10MB each
                  </p>
                </div>
              </div>

              {uploadProgress > 0 && (
                <div className="mt-8 bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50">
                  <div className="flex justify-between mb-4">
                    <span className="text-lg font-medium text-gray-700">
                      {uploadProgress === 100 ? '✨ Upload Complete!' : '📤 Uploading photos...'}
                    </span>
                    <span className="text-lg font-bold text-blue-600">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 h-3 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search tab */}
          {activeTab === 'search' && (
            <div className="space-y-8">
              <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-gray-200/50">
                <div className="text-center mb-10">
                  <div className="w-20 h-20 bg-gradient-to-r from-purple-100 to-pink-100 rounded-3xl mx-auto mb-6 flex items-center justify-center shadow-lg">
                    <Search className="w-10 h-10 text-purple-600" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-3">AI Face Search</h2>
                  <p className="text-gray-600 text-lg">Upload a photo to find matching faces instantly</p>
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
                  className="relative border-2 border-dashed border-gray-300 rounded-3xl p-16 text-center hover:border-purple-400 hover:bg-purple-50/50 transition-all cursor-pointer group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-pink-500/5 to-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl mx-auto mb-6 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-lg">
                      <Camera className="w-8 h-8 text-white" />
                    </div>
                    <p className="text-xl font-semibold text-gray-700 group-hover:text-purple-700 mb-3 transition-colors">
                      Upload a photo to search
                    </p>
                    <p className="text-gray-500 text-lg">
                      Choose a clear photo with visible faces
                    </p>
                  </div>
                </div>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-xl p-8 border border-gray-200/50">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900">
                        Found {searchResults.length} {searchResults.length === 1 ? 'Match' : 'Matches'}
                      </h3>
                      <p className="text-gray-600">AI-powered face recognition results</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {searchResults.map((result, index) => (
                      <div key={index} className="group relative overflow-hidden rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:scale-105">
                        <div className="aspect-square">
                          <img
                            src={result.image_data}
                            alt={result.filename}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                          <p className="font-semibold truncate text-sm mb-1">
                            {decodeURIComponent(result.filename)}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                            <p className="text-xs opacity-90">
                              {Math.round(result.similarity)}% confidence
                            </p>
                          </div>
                        </div>
                        <div className="absolute top-3 right-3">
                          <div className={`px-3 py-1 rounded-full text-xs font-bold text-white shadow-lg ${
                            result.similarity >= 90 ? 'bg-green-500' :
                            result.similarity >= 70 ? 'bg-yellow-500' : 'bg-orange-500'
                          }`}>
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

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 flex flex-col items-center gap-6 shadow-2xl border border-white/20">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center animate-pulse">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl animate-ping opacity-75"></div>
            </div>
            <div className="text-center">
              <p className="text-gray-900 font-semibold text-lg">AI Processing...</p>
              <p className="text-gray-600 text-sm mt-1">This may take a few moments</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SnapIDApp;