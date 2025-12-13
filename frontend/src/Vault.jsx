import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { FileText, Upload, Download, Loader2, Trash2, Shield } from 'lucide-react';

export default function Vault({ session }) {
  const [items, setItems] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState('Certificate');

  useEffect(() => {
    fetchVault();
  }, []);

  const fetchVault = async () => {
    const { data, error } = await supabase
      .from('vault_items')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });
    if (data) setItems(data);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);

    try {
      // 1. Upload to Supabase Storage (Cloud)
      const filePath = `${session.user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('vault')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Save Details to Database
      const { error: dbError } = await supabase
        .from('vault_items')
        .insert({
          user_id: session.user.id,
          filename: file.name,
          file_path: filePath,
          file_type: file.type,
          category: category
        });

      if (dbError) throw dbError;

      fetchVault();
      alert("File saved to Vault safely!");
    } catch (error) {
      alert("Upload failed: " + error.message);
    } finally {
      setUploading(false);
    }
  };

const downloadFile = async (path, filename) => {
    try {
      // 1. Get a Signed URL (Valid for 60 seconds)
      const { data, error } = await supabase.storage
        .from('vault')
        .createSignedUrl(path, 60);

      if (error) throw error;

      // 2. Force the browser to download it
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
    } catch (error) {
      console.error("Download Error:", error);
      alert("Error downloading file. Please try again.");
    }
  };

const deleteFile = async (id, filePath) => {
    if (!confirm("Are you sure you want to delete this file completely?")) return;

    try {
      // 1. Delete from Storage (The actual file)
      const { error: storageError } = await supabase.storage
        .from('vault')
        .remove([filePath]);

      if (storageError) {
        console.error("Storage Delete Error:", storageError);
        alert("Failed to delete file from cloud. Check permissions.");
        return;
      }

      // 2. Delete from Database (The record)
      const { error: dbError } = await supabase
        .from('vault_items')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error("DB Delete Error:", dbError);
        alert("Failed to delete database record.");
        return;
      }

      // 3. Refresh UI
      fetchVault();
      alert("File deleted successfully.");

    } catch (error) {
      console.error("Unexpected Error:", error);
      alert("An unexpected error occurred.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 pb-32">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-white flex items-center gap-2">
            <Shield className="text-green-400" /> My Vault
          </h1>
          <p className="text-gray-400 text-sm mt-1">Securely store your certificates & mark sheets.</p>
        </div>
        
        <div className="flex gap-2 bg-[#1e1f20] p-2 rounded-xl border border-[#333]">
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="bg-[#2a2b2e] text-white text-sm rounded-lg px-3 outline-none border border-[#333] h-10"
          >
            <option>Certificate</option>
            <option>Mark Sheet</option>
            <option>ID Card</option>
            <option>Resume</option>
            <option>Other</option>
          </select>
          <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-all cursor-pointer h-10">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            Upload
            <input type="file" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-500 border border-dashed border-[#333] rounded-2xl">
          <Shield size={48} className="mx-auto mb-4 opacity-20" />
          <p>Your vault is empty.</p>
          <p className="text-xs">Upload a document to keep it safe forever.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-[#1e1f20] border border-[#333] p-4 rounded-xl hover:border-gray-500 transition-all group relative">
              <div className="flex items-start justify-between mb-3">
                <div className="p-3 bg-[#2a2b2e] rounded-lg">
                  <FileText className="text-blue-400" size={24} />
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-500 bg-[#131314] px-2 py-1 rounded">
                  {item.category}
                </span>
              </div>
              <h3 className="text-white font-medium truncate mb-1" title={item.filename}>{item.filename}</h3>
              <p className="text-xs text-gray-500 mb-4">Uploaded: {new Date(item.created_at).toLocaleDateString()}</p>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => downloadFile(item.file_path, item.filename)}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#131314] hover:bg-[#2a2b2e] text-gray-300 py-2 rounded-lg text-sm transition-colors"
                >
                  <Download size={14} /> Download
                </button>
                <button 
                  onClick={() => deleteFile(item.id, item.file_path)}
                  className="px-3 bg-[#131314] hover:bg-red-900/30 text-gray-500 hover:text-red-400 rounded-lg transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}