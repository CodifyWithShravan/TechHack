import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Save, Loader2, User } from 'lucide-react';

export default function Profile({ session }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State matching your screenshot
  const [formData, setFormData] = useState({
    full_name: '', gender: '', dob: '', mobile: '',
    father_name: '', mother_name: '', parent_mobile: '', blood_group: '',
    roll_number: '', admission_number: '', batch: '', degree: '',
    program_code: '', semester: '', section: ''
  });

  // Load data on mount
  useEffect(() => {
    const getProfile = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setFormData(data);
      }
      setLoading(false);
    };
    getProfile();
  }, [session]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: session.user.id, ...formData });

    if (error) alert('Error saving profile!');
    else alert('Profile updated successfully!');
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading profile...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6 pb-20">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-semibold text-white">Profile Details</h1>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-medium transition-all"
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
          Save Changes
        </button>
      </div>

      <div className="space-y-8">
        {/* --- Personal Details Section --- */}
        <section className="bg-[#1e1f20] p-6 rounded-2xl border border-[#333]">
          <h2 className="text-xl font-medium text-white mb-6 border-b border-[#333] pb-2">Personal Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Full Name" name="full_name" val={formData.full_name} onChange={handleChange} />
            <InputField label="Gender" name="gender" val={formData.gender} onChange={handleChange} />
            <InputField label="Date of Birth" name="dob" type="date" val={formData.dob} onChange={handleChange} />
            <InputField label="Mobile" name="mobile" val={formData.mobile} onChange={handleChange} />
            <InputField label="Email" val={session.user.email} disabled={true} />
            <InputField label="Blood Group" name="blood_group" val={formData.blood_group} onChange={handleChange} />
            <InputField label="Father's Name" name="father_name" val={formData.father_name} onChange={handleChange} />
            <InputField label="Mother's Name" name="mother_name" val={formData.mother_name} onChange={handleChange} />
            <InputField label="Parent's Mobile" name="parent_mobile" val={formData.parent_mobile} onChange={handleChange} />
          </div>
        </section>

        {/* --- Academic Details Section --- */}
        <section className="bg-[#1e1f20] p-6 rounded-2xl border border-[#333]">
          <h2 className="text-xl font-medium text-white mb-6 border-b border-[#333] pb-2">Academic Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputField label="Roll Number" name="roll_number" val={formData.roll_number} onChange={handleChange} />
            <InputField label="Admission Number" name="admission_number" val={formData.admission_number} onChange={handleChange} />
            <InputField label="Batch" name="batch" val={formData.batch} onChange={handleChange} />
            <InputField label="Degree" name="degree" val={formData.degree} onChange={handleChange} />
            <InputField label="Program Code" name="program_code" val={formData.program_code} onChange={handleChange} />
            <InputField label="Semester" name="semester" val={formData.semester} onChange={handleChange} />
            <InputField label="Section" name="section" val={formData.section} onChange={handleChange} />
          </div>
        </section>
      </div>
    </div>
  );
}

// Helper Component for cleaner code
function InputField({ label, name, val, onChange, type = "text", disabled = false }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{label}</label>
      <input
        type={type}
        name={name}
        value={val || ''}
        onChange={onChange}
        disabled={disabled}
        className={`w-full bg-[#131314] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        placeholder={`Enter ${label}`}
      />
    </div>
  );
}