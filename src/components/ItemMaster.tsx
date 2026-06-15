import React, { useState } from 'react';
import { Upload, Plus, X, Search, Edit, Trash2 } from 'lucide-react';
import { doc, setDoc, deleteDoc, Firestore } from 'firebase/firestore';
import { Item, Supplier } from '../types';

interface ItemMasterProps {
  items: Item[];
  suppliers: Supplier[];
  db: Firestore;
  basePath: string;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showAlert: (title: string, message: string) => void;
  formatCur: (amount: number, cur?: string) => string;
}

export default function ItemMaster({ items, suppliers, db, basePath, showConfirm, showAlert, formatCur }: ItemMasterProps) {
  const [form, setForm] = useState({ code: '', category: '', itemName: '', pricePerUnit: '', currency: 'THB', unit: '', discountPercent: '', moq: '', moqType: 'minimum' as 'minimum' | 'multiple' });
  const [selectedSupId, setSelectedSupId] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = items.filter(i => {
    const matchSup = i.supplierId === selectedSupId;
    const searchLower = searchTerm.toLowerCase();
    const matchSearch = !searchTerm || 
                        i.code?.toLowerCase().includes(searchLower) || 
                        i.itemName?.toLowerCase().includes(searchLower);
    return matchSup && matchSearch;
  });

  const handleEditItem = (item: Item) => {
    setEditingItemId(item.id);
    setForm({
      code: item.code || '',
      category: item.category || '',
      itemName: item.itemName || '',
      pricePerUnit: (item.pricePerUnit ?? '').toString(),
      currency: item.currency || 'THB',
      unit: item.unit || '',
      discountPercent: (item.discountPercent ?? '').toString(),
      moq: (item.moq ?? '').toString(),
      moqType: item.moqType || 'minimum'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingItemId(null);
    setForm({ code: '', category: '', itemName: '', pricePerUnit: '', currency: 'THB', unit: '', discountPercent: '', moq: '', moqType: 'minimum' });
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = { 
      ...form, 
      supplierId: selectedSupId, 
      pricePerUnit: parseFloat(form.pricePerUnit) || 0,
      discountPercent: parseFloat(form.discountPercent) || 0,
      moq: parseFloat(form.moq) || 0,
      moqType: form.moqType || 'minimum'
    };

    if (editingItemId) {
      await setDoc(doc(db, `${basePath}/items`, editingItemId), data, { merge: true });
    } else {
      await setDoc(doc(db, `${basePath}/items`, `ITM-${Date.now()}`), data);
    }
    
    cancelEdit();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSupId) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const rows = text.split('\n').filter(r => r.trim());
      for (let row of rows) {
        const cleanRow = row.replace(/\r/g, '').trim();
        let cols = cleanRow.split('\t');
        if (cols.length < 2) cols = cleanRow.split(',');
        
        if (cols.length >= 4) {
          let unit = '';
          let discountPercent = 0;
          let moq = 0;
          let moqType: 'minimum' | 'multiple' = 'minimum';
          let currency = 'THB';
          
          if (cols.length >= 5) unit = cols[4].trim();
          if (cols.length >= 6) discountPercent = parseFloat(cols[5]) || 0;
          if (cols.length >= 7) moq = parseFloat(cols[6]) || 0;
          if (cols.length >= 8) {
            const mt = cols[7].trim().toLowerCase();
            if (mt === 'multiple' || mt === 'ทุกๆ' || mt === 'ทวีคูณ') moqType = 'multiple';
            else moqType = 'minimum';
          }
          if (cols.length >= 9) currency = cols[8].trim().toUpperCase() || 'THB';

          await setDoc(doc(db, `${basePath}/items`, `ITM-${Date.now()}-${Math.random()}`), { 
            supplierId: selectedSupId, 
            code: cols[0].trim(), 
            category: cols[1].trim(), 
            itemName: cols[2].trim(), 
            pricePerUnit: parseFloat(cols[3]) || 0, 
            unit: unit,
            discountPercent: discountPercent, 
            moq: moq,
            moqType: moqType,
            currency: currency
          });
        }
      }
      showAlert("สำเร็จ", "นำเข้าสินค้าสำเร็จ!");
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">รายการสินค้า (Master Data)</h2>
      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6 border-slate-100">
        <select value={selectedSupId} onChange={e => { setSelectedSupId(e.target.value); cancelEdit(); }} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white text-slate-700">
          <option value="">-- เลือกซัพพลายเออร์เพื่อจัดการสินค้า --</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.brandName || s.companyName}</option>)}
        </select>
        
        {selectedSupId && (
          <div className="pt-4 border-t space-y-6 animate-in fade-in">
            <div className={`p-4 rounded-xl border ${editingItemId ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-100 bg-slate-50/50'}`}>
              <div className="flex justify-between items-center mb-4">
                <h4 className={`font-bold text-sm ${editingItemId ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {editingItemId ? 'กำลังแก้ไขสินค้า...' : 'เพิ่มสินค้าใหม่'}
                </h4>
                {!editingItemId && (
                  <label className="cursor-pointer bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-100 flex items-center">
                    <Upload size={14} className="mr-2"/> นำเข้าสินค้า (Tab หรือ CSV)
                    <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.csv"/>
                  </label>
                )}
              </div>
              
              <form onSubmit={handleSaveItem} className="grid grid-cols-1 md:grid-cols-12 gap-3">
                <div className="md:col-span-2"><input required placeholder="Code *" value={form.code} onChange={e => setForm({...form, code: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"/></div>
                <div className="md:col-span-3"><input required placeholder="Category *" value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"/></div>
                <div className="md:col-span-7"><input required placeholder="Item Name *" value={form.itemName} onChange={e => setForm({...form, itemName: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"/></div>
                
                <div className="md:col-span-3 flex gap-1">
                  <input required type="number" step="any" placeholder="Price/Unit *" value={form.pricePerUnit} onChange={e => setForm({...form, pricePerUnit: e.target.value})} className="w-2/3 border rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"/>
                  <select value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} className="w-1/3 border rounded-lg p-2.5 text-[10px] font-bold outline-none focus:border-indigo-500 bg-slate-100 text-indigo-700">
                    <option value="THB">THB</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                    <option value="JPY">JPY</option>
                    <option value="CNY">CNY</option>
                    <option value="GBP">GBP</option>
                    <option value="SGD">SGD</option>
                  </select>
                </div>
                <div className="md:col-span-3"><input placeholder="Unit (หน่วย)" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"/></div>
                <div className="md:col-span-2"><input type="number" step="any" placeholder="% Discount" value={form.discountPercent} onChange={e => setForm({...form, discountPercent: e.target.value})} className="w-full border rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"/></div>
                <div className="md:col-span-2 flex gap-1">
                  <input type="number" step="any" placeholder="MOQ" value={form.moq} onChange={e => setForm({...form, moq: e.target.value})} className="w-1/2 border rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white shadow-sm" title="ขั้นต่ำ"/>
                  <select value={form.moqType} onChange={e => setForm({...form, moqType: e.target.value as 'minimum' | 'multiple'})} className="w-1/2 border rounded-lg p-2.5 text-[10px] outline-none focus:border-indigo-500 bg-white shadow-sm" title="รูปแบบขั้นต่ำ">
                    <option value="minimum">&ge; ขั้นต่ำ</option>
                    <option value="multiple">x ทุกๆ</option>
                  </select>
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <button type="submit" className={`flex-1 text-white rounded-lg font-bold shadow-sm ${editingItemId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-800 hover:bg-slate-700'}`}>
                    {editingItemId ? 'บันทึก' : <div className="flex justify-center"><Plus size={18}/></div>}
                  </button>
                  {editingItemId && <button type="button" onClick={cancelEdit} className="flex-1 bg-white border border-slate-300 text-slate-600 rounded-lg font-bold hover:bg-slate-50"><X size={18} className="mx-auto"/></button>}
                </div>
              </form>
            </div>

            <div className="flex justify-between items-end mb-2 mt-4">
              <h4 className="font-bold text-sm text-slate-700 hidden md:block">รายชื่อสินค้าทั้งหมด</h4>
              <div className="relative w-full md:w-1/3">
                <Search size={16} className="absolute left-3 top-2.5 text-slate-400"/>
                <input 
                  type="text" 
                  placeholder="ค้นหา Code หรือ ชื่อสินค้า..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm outline-none focus:border-indigo-500 bg-white shadow-sm"
                />
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl overflow-hidden border border-slate-100">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 font-bold text-slate-500 border-b">
                  <tr>
                    <th className="p-3">รหัส / หมวดหมู่</th>
                    <th className="p-3">ชื่อสินค้า (Item Name)</th>
                    <th className="p-3 text-center">หน่วย</th>
                    <th className="p-3 text-center">ขั้นต่ำ (MOQ)</th>
                    <th className="p-3 text-right">ราคา/ส่วนลด</th>
                    <th className="p-3 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map(item => {
                    const netPrice = (item.pricePerUnit || 0) * (1 - (item.discountPercent || 0) / 100);
                    const moqDisplay = item.moqType === 'multiple' ? `ทุกๆ ${item.moq}` : `ขั้นต่ำ ${item.moq}`;
                    const itemCur = item.currency || 'THB';
                    return (
                      <tr key={item.id} className="bg-white hover:bg-slate-50 transition-colors">
                        <td className="p-3">
                          <div className="font-mono text-slate-600 font-bold">{item.code}</div>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded inline-block mt-1">{item.category}</span>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-800">{item.itemName}</div>
                        </td>
                        <td className="p-3 text-center text-slate-600">{item.unit || '-'}</td>
                        <td className="p-3 text-center">
                          {item.moq > 0 ? <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[11px] font-bold">{moqDisplay}</span> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-3 text-right font-mono">
                          {item.discountPercent > 0 && <span className="text-red-400 line-through text-[10px] mr-2">{formatCur(item.pricePerUnit, itemCur)}</span>}
                          <span className="font-bold text-indigo-600">{formatCur(netPrice, itemCur)}</span>
                          {item.discountPercent > 0 && <div className="text-[10px] text-green-600 mt-0.5">ลด {item.discountPercent}%</div>}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex justify-center space-x-1">
                            <button onClick={() => handleEditItem(item)} className="text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors"><Edit size={16}/></button>
                            <button onClick={(e) => { e.preventDefault(); showConfirm('ยืนยันการลบ', 'ต้องการลบสินค้านี้ใช่หรือไม่?', async () => { await deleteDoc(doc(db, `${basePath}/items`, item.id)); }); }} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"><Trash2 size={16}/></button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
