import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, Plus, FileText, MessageSquare, Loader, Trash2 } from 'lucide-react'; // Import Trash2
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';

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

  useEffect(() => {
    if (token) fetchProjects();
  }, [token]);

  const fetchProjects = async () => {
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) return logout();
      const data = await res.json();
      if (res.ok) setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setProjectName(e.target.files[0].name.replace(/\.[^/.]+$/, ""));
    }
  };

  // --- NEW DELETE FUNCTION ---
  const handleDelete = async (e, projectId) => {
    e.stopPropagation(); // Stop click from opening the chat
    if (!window.confirm("Are you sure you want to delete this project? This cannot be undone.")) return;

    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete project");

      // Remove from UI immediately
      setProjects(projects.filter(p => p._id !== projectId));
    } catch (err) {
      alert(err.message);
    }
  };
  // ---------------------------

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile || !projectName) return;

    setUploading(true);
    setError('');

    try {
      const urlRes = await fetch(`${API_URL}/api/projects/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileName: selectedFile.name, fileType: selectedFile.type }),
      });

      if (!urlRes.ok) throw new Error('Failed to get upload URL');
      const { filePath } = await urlRes.json();

      const { error: uploadError } = await supabase.storage
        .from('nexusmind-uploads')
        .upload(filePath, selectedFile);

      if (uploadError) throw new Error(uploadError.message);

      const createRes = await fetch(`${API_URL}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: projectName, fileKeys: [filePath] }),
      });

      if (!createRes.ok) throw new Error('Failed to create project');

      setSelectedFile(null);
      setProjectName('');
      fetchProjects();

    }// In handleUpload catch block:
    catch (err) {
      toast.error(err.message); // <--- Use toast instead of setError
      setError(err.message); // Keep this if you still want the banner, or remove it
    }
    // In handleUpload success block (after fetchProjects):
    toast.success('Project created successfully!');
  };


  const deleteProjectConfig = async (projectId, toastId) => {
    toast.dismiss(toastId); // Close the confirmation toast

    // Show a loading toast
    const loadingToast = toast.loading('Deleting project...');

    try {
      const res = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to delete");

      // Success! Update UI
      setProjects((prev) => prev.filter((p) => p._id !== projectId));
      toast.success('Project deleted successfully', { id: loadingToast });

    } catch (err) {
      toast.error(err.message, { id: loadingToast });
    }
  };

  const confirmDelete = (e, projectId) => {
    e.stopPropagation(); // Stop navigation to chat

    // Trigger Custom Toast
    toast((t) => (
      <div className="flex flex-col gap-2">
        <span className="font-semibold">Delete this project?</span>
        <span className="text-xs text-gray-400">This cannot be undone.</span>
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => deleteProjectConfig(projectId, t.id)}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            Delete
          </button>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-1 rounded text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    ), {
      duration: 5000, // Stay open for 5 seconds
      style: {
        background: '#1f2937', // Dark gray
        border: '1px solid #374151',
        color: '#fff',
      }
    });
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Form */}
        <div className="lg:col-span-1">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Plus className="text-blue-400" /> New Project
            </h2>
            {error && <div className="bg-red-500/20 text-red-300 p-3 rounded mb-4 text-sm">{error}</div>}

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
                className="w-full py-3 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 rounded-lg font-bold shadow-lg disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {uploading ? <><Loader className="animate-spin" size={20} /> Processing...</> : <><FileText size={20} /> Create Project</>}
              </button>
            </form>
          </div>
        </div>

        {/* Project List */}
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
                  className="bg-gray-800 p-5 rounded-xl border border-gray-700 hover:border-blue-500 transition-all cursor-pointer group relative flex flex-col justify-between"
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

                    {/* DELETE BUTTON */}
                    <button
                      onClick={(e) => confirmDelete(e, project._id)}
                      className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-full transition-colors"
                      title="Delete Project"
                    >
                      <Trash2 size={18} />
                    </button>
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