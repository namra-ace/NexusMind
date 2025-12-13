import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, FileText, MessageSquare, Loader, Trash2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase (Use env variables in production)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const Dashboard = () => {
  const { user, token, logout, API_URL } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [projectName, setProjectName] = useState('');
  const [error, setError] = useState('');

  // 1. Fetch Projects on Load
  useEffect(() => {
    if (token) fetchProjects();
  }, [token]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (res.status === 401) {
        logout(); // Auto-logout if token is invalid
        return;
      }

      const data = await res.json();
      if (res.ok) setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  // 2. Handle File Selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      // Auto-fill project name from filename (remove extension)
      setProjectName(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
    }
  };

  // 3. The Upload Logic
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !projectName) return;

    setUploading(true);
    setError('');

    try {
      // Step A: Get Secure Upload Path from Backend
      const urlRes = await fetch(`${API_URL}/api/projects/upload-url`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          fileName: selectedFile.name, 
          fileType: selectedFile.type 
        }),
      });

      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { filePath, fileName } = await urlRes.json();

      // Step B: Upload directly to Supabase
      const { error: uploadError } = await supabase.storage
        .from('nexusmind-uploads')
        .upload(filePath, selectedFile);

      if (uploadError) throw new Error(`Supabase Error: ${uploadError.message}`);

      // Step C: Save Project & Trigger Ingestion in Backend
      const createRes = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          name: projectName, 
          fileKeys: [filePath] // Send the path we just uploaded to
        }),
      });

      if (!createRes.ok) throw new Error('Failed to create project');

      // Success! Reset form and refresh list
      setSelectedFile(null);
      setProjectName('');
      fetchProjects();

    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-10 border-b border-gray-700 pb-4">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          NexusMind Dashboard
        </h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">Welcome, {user?.email}</span>
          <button 
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Upload Form */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Plus className="text-blue-400" /> New Project
            </h2>
            
            {error && (
              <div className="bg-red-500/20 text-red-300 p-3 rounded mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Project Name</label>
                <input 
                  type="text" 
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g. Biology 101"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Upload PDF</label>
                <input 
                  type="file" 
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="w-full bg-gray-700 border border-gray-600 rounded p-2 text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                />
              </div>

              <button 
                type="submit" 
                disabled={uploading || !selectedFile}
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {uploading ? (
                  <> <Loader className="animate-spin" size={20} /> Processing... </>
                ) : (
                  <> <FileText size={20} /> Create Project </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Projects List */}
        <div className="lg:col-span-2">
          <h2 className="text-xl font-semibold mb-4">Your Projects</h2>
          
          {projects.length === 0 ? (
            <div className="text-center py-20 bg-gray-800/50 rounded-xl border border-gray-700 border-dashed">
              <p className="text-gray-500">No projects yet. Upload a PDF to get started!</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {projects.map((project) => (
                <div 
                  key={project._id}
                  className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-blue-500 transition-all cursor-pointer group relative"
                  onClick={() => navigate(`/chat/${project._id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-500/20 rounded-lg text-blue-400">
                        <FileText size={24} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg group-hover:text-blue-400 transition-colors">
                          {project.name}
                        </h3>
                        <p className="text-xs text-gray-500">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center text-sm text-gray-400 gap-2">
                    <MessageSquare size={16} />
                    <span>Click to chat</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;