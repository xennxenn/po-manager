import React, { useState } from 'react';
import { Shield, UserPlus, Edit, Trash2, AlertCircle, UserCircle } from 'lucide-react';
import { doc, setDoc, serverTimestamp, deleteDoc, Firestore } from 'firebase/firestore';
import { Employee } from '../types';

interface EmployeeMasterProps {
  employees: Employee[];
  db: Firestore;
  basePath: string;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showAlert: (title: string, message: string) => void;
}

export default function EmployeeMaster({ employees, db, basePath, showConfirm, showAlert }: EmployeeMasterProps) {
  const [form, setForm] = useState({ username: '', name: '', password: '', role: 'employee' as 'admin' | 'employee' });
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setForm({ username: emp.username, name: emp.name, password: emp.password || '', role: emp.role || 'employee' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ username: '', name: '', password: '', role: 'employee' });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.name.trim() || !form.password.trim()) return;

    // เช็ค Username ซ้ำ กรณีสร้างใหม่ หรือแก้ชื่อ Username
    const isDuplicate = employees.some(emp => 
      emp.id !== editingId && 
      emp.username.toLowerCase() === form.username.trim().toLowerCase()
    );

    if (isDuplicate) {
      showAlert('ข้อผิดพลาด', 'รหัสพนักงาน (Username) นี้มีผู้ใช้งานแล้ว โปรดใช้รหัสอื่น');
      return;
    }

    const id = editingId || `EMP-${Date.now()}`;
    await setDoc(doc(db, `${basePath}/employees`, id), {
      ...form,
      username: form.username.trim(),
      updatedAt: serverTimestamp()
    }, { merge: true });

    showAlert('สำเร็จ', editingId ? 'อัปเดตข้อมูลพนักงานสำเร็จ' : 'เพิ่มพนักงานใหม่สำเร็จ');
    cancelEdit();
  };

  const handleDelete = (id: string) => {
    if (id === 'admin') {
      showAlert('ไม่อนุญาต', 'ไม่สามารถลบบัญชีผู้ดูแลระบบเริ่มต้นได้');
      return;
    }
    showConfirm('ยืนยันการลบ', 'คุณต้องการลบพนักงานคนนี้ออกจากระบบใช่หรือไม่?', async () => {
      await deleteDoc(doc(db, `${basePath}/employees`, id));
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center">
        <Shield className="text-emerald-500 mr-3" size={28}/> จัดการผู้ใช้งานระบบ (Employee Management)
      </h2>

      <div className={`p-6 rounded-2xl border shadow-sm transition-all ${editingId ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-100 bg-white'}`}>
        <h4 className={`font-bold mb-4 flex items-center ${editingId ? 'text-emerald-700' : 'text-slate-800'}`}>
          {editingId ? <><Edit size={18} className="mr-2"/> กำลังแก้ไขข้อมูลพนักงาน</> : <><UserPlus size={18} className="mr-2 text-emerald-500"/> เพิ่มพนักงานใหม่</>}
        </h4>
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">รหัสพนักงาน (Username)</label>
            <input required placeholder="เช่น EMP001" value={form.username} onChange={e => setForm({...form, username: e.target.value})} disabled={editingId === 'admin'} className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white disabled:bg-slate-100 disabled:text-slate-400"/>
          </div>
          <div className="md:col-span-4">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">ชื่อ-นามสกุล</label>
            <input required placeholder="ชื่อพนักงาน" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white"/>
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">รหัสผ่าน (Password)</label>
            <input required placeholder="ตั้งรหัสผ่าน" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-mono"/>
          </div>
          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">สิทธิ์ (Role)</label>
            <select value={form.role} onChange={e => setForm({...form, role: e.target.value as 'admin' | 'employee'})} disabled={editingId === 'admin'} className="w-full border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500 bg-white font-bold disabled:bg-slate-100 disabled:text-slate-400">
              <option value="employee">พนักงาน</option>
              <option value="admin">แอดมิน</option>
            </select>
          </div>
          <div className="md:col-span-12 flex gap-3 mt-2">
            <button type="submit" className={`px-6 py-3 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95 ${editingId ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-700'}`}>
              {editingId ? 'บันทึกการแก้ไข' : 'เพิ่มพนักงาน'}
            </button>
            {editingId && (
               <button type="button" onClick={cancelEdit} className="px-6 py-3 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all">ยกเลิก</button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden border-slate-100">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs text-slate-500 uppercase tracking-widest">รายชื่อผู้ใช้งานทั้งหมด ({employees.length})</div>
        <table className="w-full text-left text-sm">
          <thead className="bg-white border-b text-slate-400 font-medium">
            <tr>
              <th className="p-4">Username</th>
              <th className="p-4">ชื่อพนักงาน</th>
              <th className="p-4">รหัสผ่าน</th>
              <th className="p-4 text-center">สิทธิ์ (Role)</th>
              <th className="p-4 text-center">จัดการ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-4 font-bold text-slate-700 font-mono">{emp.username}</td>
                <td className="p-4 text-slate-800">{emp.name} {emp.id === 'admin' && <span className="ml-2 text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">ค่าเริ่มต้น</span>}</td>
                <td className="p-4 text-slate-400 font-mono">
                  <span className="bg-slate-100 px-2 py-1 rounded select-all">{emp.password}</span>
                </td>
                <td className="p-4 text-center">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${emp.role === 'admin' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                    {emp.role === 'admin' ? <Shield size={12} className="mr-1"/> : <UserCircle size={12} className="mr-1"/>}
                    {emp.role === 'admin' ? 'แอดมิน' : 'พนักงาน'}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <div className="flex justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(emp)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors" title="แก้ไข"><Edit size={16}/></button>
                    <button onClick={() => handleDelete(emp.id)} disabled={emp.id === 'admin'} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent" title="ลบ"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
