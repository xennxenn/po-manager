import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { doc, setDoc, deleteDoc, Firestore } from 'firebase/firestore';
import { Supplier } from '../types';

interface SupplierMasterProps {
  suppliers: Supplier[];
  db: Firestore;
  basePath: string;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export default function SupplierMaster({ suppliers, db, basePath, showConfirm }: SupplierMasterProps) {
  const [form, setForm] = useState({ brandName: '', companyName: '', address: '', branch: '', taxId: '' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandName.trim() && !form.companyName.trim()) return;
    await setDoc(doc(db, `${basePath}/suppliers`, `SUP-${Date.now()}`), { ...form });
    setForm({ brandName: '', companyName: '', address: '', branch: '', taxId: '' });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">จัดการซัพพลายเออร์</h2>
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 border-slate-100">
        <input placeholder="ชื่อแบรนด์ (Brand)" value={form.brandName} onChange={e => setForm({...form, brandName: e.target.value})} className="border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"/>
        <input placeholder="ชื่อจดทะเบียนบริษัท" value={form.companyName} onChange={e => setForm({...form, companyName: e.target.value})} className="border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"/>
        <input placeholder="ที่อยู่บริษัท" value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="md:col-span-2 border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"/>
        <input placeholder="สาขา" value={form.branch} onChange={e => setForm({...form, branch: e.target.value})} className="border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"/>
        <input placeholder="เลขประจำตัวผู้เสียภาษี" value={form.taxId} onChange={e => setForm({...form, taxId: e.target.value})} className="border rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"/>
        <button type="submit" className="md:col-span-2 bg-slate-900 text-white py-3.5 rounded-2xl font-bold hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-100">บันทึกซัพพลายเออร์</button>
      </form>
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden border-slate-100">
        <div className="p-4 bg-slate-50 border-b font-bold text-xs text-slate-400 uppercase tracking-widest">รายชื่อซัพพลายเออร์</div>
        {suppliers.map(s => (
          <div key={s.id} className="flex justify-between items-center p-5 border-b last:border-0 hover:bg-slate-50 transition-colors">
            <div>
              <div className="font-bold text-slate-800">{s.brandName || s.companyName}</div>
              <div className="text-xs text-slate-400 font-medium">{s.companyName} {s.taxId && `| TAX: ${s.taxId}`}</div>
            </div>
            <button onClick={(e) => { e.preventDefault(); showConfirm('ยืนยันการลบ', 'ต้องการลบซัพพลายเออร์ใช่หรือไม่?', async () => { await deleteDoc(doc(db, `${basePath}/suppliers`, s.id)); }); }} className="text-red-300 hover:text-red-500 p-2 transition-colors"><Trash2 size={18}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}
