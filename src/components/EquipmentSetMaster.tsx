import React, { useState, useMemo } from 'react';
import { Upload, Search, Trash2, Edit, X, AlertTriangle, ArrowUpCircle, Printer } from 'lucide-react';
import { doc, setDoc, deleteDoc, Firestore } from 'firebase/firestore';
import { EquipmentSet, Item, Supplier, EquipmentSetItem } from '../types';

interface EquipmentSetMasterProps {
  sets: EquipmentSet[];
  items: Item[];
  getSetPrice: (setId: string, targetCur: string, ratesObj: Record<string, number>) => number;
  db: Firestore;
  basePath: string;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  showAlert: (title: string, message: string) => void;
  suppliers: Supplier[];
  convertPrice: (amount: number, fromCur: string, toCur: string, ratesObj: Record<string, number>) => number;
  formatCur: (amount: number, cur?: string) => string;
  exchangeRates: Record<string, number>;
}

export default function EquipmentSetMaster({ 
  sets, items, getSetPrice, db, basePath, showConfirm, showAlert, suppliers, convertPrice, formatCur, exchangeRates 
}: EquipmentSetMasterProps) {
  const [name, setName] = useState('');
  const [setItems, setSetItems] = useState<EquipmentSetItem[]>([]);
  const [curItem, setCurItem] = useState('');
  const [curQty, setCurQty] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedSupId, setSelectedSupId] = useState('');
  const [setCurrency, setSetCurrency] = useState('THB'); 
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchSetTerm, setSearchSetTerm] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPending, setImportPending] = useState<any[]>([]); 
  const [importResults, setImportResults] = useState<Record<string, string>>({}); 

  // Print Report States
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printOption, setPrintOption] = useState<'names-only' | 'with-details'>('names-only'); 

  const filteredSets = sets.filter(s => {
    const matchSup = s.supplierId === selectedSupId;
    const matchSearch = !searchSetTerm || s.name.toLowerCase().includes(searchSetTerm.toLowerCase());
    return matchSup && matchSearch;
  });
  const itemsForSelectedSupplier = items.filter(i => i.supplierId === selectedSupId);

  const { totalFullPrice, totalNetPrice } = useMemo(() => {
    return setItems.reduce((acc, si) => {
      const item = items.find(it => it.id === si.itemId);
      if (item) {
        const itemCur = item.currency || 'THB';
        const price = item.pricePerUnit || 0;
        const discount = item.discountPercent || 0;
        
        const convertedPrice = convertPrice(price, itemCur, setCurrency, exchangeRates);
        
        acc.totalFullPrice += convertedPrice * si.quantity;
        acc.totalNetPrice += convertedPrice * (1 - discount / 100) * si.quantity;
      }
      return acc;
    }, { totalFullPrice: 0, totalNetPrice: 0 });
  }, [setItems, items, setCurrency, exchangeRates, convertPrice]);

  const handleSave = async () => {
    if (!name.trim() || setItems.length === 0 || !selectedSupId) return;
    const id = editingId || `SET-${Date.now()}`;
    await setDoc(doc(db, `${basePath}/equipmentSets`, id), { name, items: setItems, supplierId: selectedSupId, currency: setCurrency });
    setName(''); setSetItems([]); setEditingId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedSupId) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const rows = text.split('\n').filter(r => r.trim());
      const newAutoAdded: EquipmentSetItem[] = [];
      const newPending: any[] = [];

      rows.forEach(row => {
        const cleanRow = row.replace(/\r/g, '').trim();
        let cols = cleanRow.split('\t');
        if (cols.length < 2) cols = cleanRow.split(',');
        if (cols.length < 2) cols = cleanRow.split(/\s+/);

        if (cols.length >= 2) {
          const code = cols[0].trim();
          const qty = parseFloat(cols[1]) || 1;
          const matches = itemsForSelectedSupplier.filter(i => i.code === code);

          if (matches.length === 1) {
            newAutoAdded.push({ itemId: matches[0].id, quantity: qty });
          } else if (matches.length > 1) {
            newPending.push({ code, qty, options: matches });
          }
        }
      });

      if (newPending.length > 0) {
        setImportPending(newPending);
        setSetItems(prev => [...prev, ...newAutoAdded]);
        setShowImportModal(true);
      } else {
        setSetItems(prev => [...prev, ...newAutoAdded]);
        showAlert('สำเร็จ', `นำเข้าสำเร็จ! เพิ่ม ${newAutoAdded.length} รายการ`);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const confirmPendingImport = () => {
    const resolved = Object.entries(importResults).map(([idx, itemId]) => ({
      itemId,
      quantity: importPending[parseInt(idx)].qty
    }));
    setSetItems(prev => [...prev, ...resolved]);
    setShowImportModal(false);
    setImportPending([]);
    setImportResults({});
  };

  const filteredItemsForSet = itemsForSelectedSupplier.filter(i => 
    i.code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    i.itemName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">จัดการชุดอุปกรณ์</h2>
      <div className="bg-white p-6 rounded-2xl border shadow-sm space-y-6 border-slate-100">
        
        <select value={selectedSupId} onChange={e => {setSelectedSupId(e.target.value); setEditingId(null); setName(''); setSetItems([]); setSearchSetTerm('');}} className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-white text-slate-700">
          <option value="">-- เลือกซัพพลายเออร์เพื่อจัดการชุดอุปกรณ์ --</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.brandName || s.companyName}</option>)}
        </select>

        {selectedSupId && (
          <div className="pt-4 border-t space-y-4 animate-in fade-in">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-slate-700">{editingId ? 'แก้ไขข้อมูลชุดอุปกรณ์' : 'สร้างชุดอุปกรณ์ใหม่'}</h4>
              <label className="cursor-pointer bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all flex items-center">
                <Upload size={14} className="mr-2"/> นำเข้าจากไฟล์ (คั่นด้วย Tab)
                <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.csv"/>
              </label>
            </div>
            
            <div className="flex gap-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="ระบุชื่อชุดอุปกรณ์ (เช่น ชุดพนักงานใหม่)" className="flex-1 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 font-bold bg-slate-50 border-slate-200"/>
              <select value={setCurrency} onChange={e => setSetCurrency(e.target.value)} className="w-32 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-indigo-700">
                <option value="THB">THB</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="JPY">JPY</option>
                <option value="CNY">CNY</option>
                <option value="GBP">GBP</option>
                <option value="SGD">SGD</option>
              </select>
            </div>
            
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-3.5 text-slate-400"/>
                <input 
                  type="text" 
                  placeholder="ค้นหาสินค้า (พิมพ์ Code หรือ ชื่อสินค้า...)" 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="w-full pl-10 pr-3 py-2.5 border rounded-xl text-sm outline-none focus:border-indigo-500 bg-slate-50"
                />
              </div>
              
              <div className="flex flex-col md:flex-row gap-3">
                <select value={curItem} onChange={e => setCurItem(e.target.value)} className="flex-1 border rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white text-slate-700">
                  <option value="">-- เลือกสินค้ารายตัว --</option>
                  {filteredItemsForSet.map(i => {
                    const itemCur = i.currency || 'THB';
                    const netPriceOrig = (i.pricePerUnit || 0) * (1 - (i.discountPercent || 0) / 100);
                    const convertedPrice = convertPrice(netPriceOrig, itemCur, setCurrency, exchangeRates);
                    return (
                      <option key={i.id} value={i.id}>
                        [{i.code}] {i.itemName} ({i.category}) - {formatCur(convertedPrice, setCurrency)}
                      </option>
                    )
                  })}
                </select>
                <div className="flex gap-2">
                  <input type="number" min="0.01" step="any" value={curQty} onChange={e => setCurQty(e.target.value)} className="w-20 border rounded-lg p-2.5 outline-none text-center" placeholder="จำนวน"/>
                  <button onClick={() => { if(curItem) { setSetItems([...setItems, {itemId: curItem, quantity: parseFloat(curQty) || 1}]); setCurItem(''); setCurQty(''); } }} className="bg-slate-800 text-white px-6 rounded-lg font-bold hover:bg-slate-700">เพิ่ม</button>
                </div>
              </div>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
              {setItems.length === 0 && <p className="text-center py-8 text-slate-400 text-sm border border-dashed rounded-xl">ยังไม่มีสินค้าในชุดนี้</p>}
              {setItems.map((si, i) => {
                const itemData = items.find(it => it.id === si.itemId);
                const itemCur = itemData?.currency || 'THB';
                const netPriceOrig = (itemData?.pricePerUnit || 0) * (1 - (itemData?.discountPercent || 0) / 100);
                const convertedNetPrice = convertPrice(netPriceOrig, itemCur, setCurrency, exchangeRates);
                const rowTotal = convertedNetPrice * si.quantity;

                return (
                  <div key={i} className="flex justify-between items-center bg-indigo-50/30 px-4 py-2 rounded-xl border border-indigo-100 group">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">
                        <span className="text-indigo-600 font-mono text-xs mr-2">[{itemData?.code}]</span> 
                        {itemData?.itemName}
                      </span>
                      <span className="text-[11px] text-slate-500 mt-0.5">@ {formatCur(convertedNetPrice, setCurrency)} / {itemData?.unit}</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="block font-bold text-indigo-600">x{si.quantity}</span>
                        <span className="block text-[11px] font-mono text-slate-600 font-bold">{formatCur(rowTotal, setCurrency)}</span>
                      </div>
                      <button type="button" onClick={(e) => { e.preventDefault(); setSetItems(setItems.filter((_, idx) => idx !== i)); }} className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><Trash2 size={14}/></button>
                    </div>
                  </div>
                )
              })}
            </div>

            {setItems.length > 0 && (
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2 space-y-2">
                <div className="flex justify-between text-sm text-slate-500 font-medium">
                  <span>ยอดรวมราคาเต็ม ({setCurrency}):</span>
                  <span className={`font-mono ${totalFullPrice > totalNetPrice ? 'line-through text-red-400' : 'text-slate-600'}`}>
                    {formatCur(totalFullPrice, setCurrency)}
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold text-slate-800 border-t border-slate-200 pt-2">
                  <span>ยอดรวมสุทธิ ({setCurrency}):</span>
                  <span className="font-mono text-indigo-600">
                    {formatCur(totalNetPrice, setCurrency)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={handleSave} className="flex-1 bg-indigo-600 text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
                {editingId ? 'บันทึกการแก้ไขชุดอุปกรณ์' : 'บันทึกชุดอุปกรณ์ใหม่'}
              </button>
              {editingId && (
                 <button onClick={() => { setEditingId(null); setName(''); setSetItems([]); setSetCurrency('THB'); }} className="px-6 bg-white border border-slate-300 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all">ยกเลิกแก้ไข</button>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedSupId && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-3">
              <h3 className="font-extrabold text-slate-800 text-sm md:text-base">ชุดอุปกรณ์ที่สร้างไว้แล้ว</h3>
              <button 
                onClick={() => setIsPrintModalOpen(true)} 
                className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-xl text-xs transition-all shadow-sm"
              >
                <Printer size={14}/> พิมพ์รายงาน
              </button>
            </div>
            <div className="relative w-full md:w-80">
              <Search size={16} className="absolute left-3.5 top-3.5 text-slate-400"/>
              <input 
                type="text" 
                placeholder="ค้นหาตามชื่อชุดอุปกรณ์..." 
                value={searchSetTerm} 
                onChange={e => setSearchSetTerm(e.target.value)} 
                className="w-full pl-10 pr-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-white border-slate-200 shadow-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSets.map(s => {
              const displayCur = s.currency || 'THB';
              return (
                <div key={s.id} className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col group transition-all hover:shadow-md border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="font-bold text-slate-800">{s.name}</h3>
                    <div className="flex space-x-1">
                      <button type="button" onClick={() => { setEditingId(s.id); setName(s.name); setSetItems(s.items); setSetCurrency(s.currency || 'THB'); window.scrollTo({top:0, behavior:'smooth'}); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"><Edit size={16}/></button>
                      <button type="button" onClick={(e) => { 
                        e.preventDefault(); 
                        e.stopPropagation(); 
                        showConfirm('ยืนยันการลบ', 'ต้องการลบชุดอุปกรณ์นี้ใช่หรือไม่?', async () => {
                          try { 
                            await deleteDoc(doc(db, `${basePath}/equipmentSets`, s.id)); 
                            if (editingId === s.id) { 
                              setEditingId(null); setName(''); setSetItems([]); setSetCurrency('THB');
                            } 
                          } catch(err: any) { 
                            showAlert('ข้อผิดพลาด', 'ไม่สามารถลบได้: ' + err.message); 
                          } 
                        });
                      }} className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  <ul className="text-[12px] text-slate-500 flex-1 space-y-2">
                    {s.items.map((it, idx) => {
                      const itemData = items.find(x => x.id === it.itemId);
                      const itemCur = itemData?.currency || 'THB';
                      const netPriceOrig = (itemData?.pricePerUnit || 0) * (1 - (itemData?.discountPercent || 0) / 100);
                      const convertedPrice = convertPrice(netPriceOrig, itemCur, displayCur, exchangeRates);
                      const rowTotal = convertedPrice * it.quantity;
                      return (
                        <li key={idx} className="flex justify-between items-start border-b border-slate-50 pb-1.5 last:border-0 last:pb-0">
                          <div className="flex flex-col truncate pr-2">
                            <span className="truncate font-medium text-slate-700">• [{itemData?.code}] {itemData?.itemName}</span>
                            <span className="text-[10px] text-slate-400 mt-0.5 ml-2">@ {formatCur(convertedPrice, displayCur)} / {itemData?.unit}</span>
                          </div>
                          <div className="flex flex-col items-end whitespace-nowrap">
                            <span className="font-medium text-slate-700">x{it.quantity}</span>
                            <span className="font-bold text-indigo-600 text-[10px] font-mono mt-0.5">{formatCur(rowTotal, displayCur)}</span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="pt-4 mt-4 border-t flex justify-between font-bold text-sm text-indigo-700"><span>ราคาต่อชุด ({displayCur})</span><span>{formatCur(getSetPrice(s.id, displayCur, exchangeRates), displayCur)}</span></div>
                </div>
              )
            })}
            {filteredSets.length === 0 && (
              <div className="col-span-1 md:col-span-2 text-center p-8 text-slate-400 bg-white border border-dashed rounded-2xl">
                {searchSetTerm ? 'ไม่พบชุดอุปกรณ์ที่ตรงกับการค้นหา' : 'ซัพพลายเออร์นี้ยังไม่มีการจัดชุดอุปกรณ์'}
              </div>
            )}
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center text-amber-600">
                <AlertTriangle className="mr-2" size={24}/>
                <h3 className="text-lg font-bold">พบ Code ซ้ำ (โปรดเลือกรายการ)</h3>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600"><X/></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <p className="text-sm text-slate-500">Code ต่อไปนี้มีสินค้าหลายชื่อในระบบ โปรดเลือกชื่อสินค้าที่คุณต้องการใช้งานสำหรับแต่ละรายการในไฟล์:</p>
              {importPending.map((pending, idx) => (
                <div key={idx} className="space-y-2 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex justify-between font-bold text-sm">
                    <span className="text-slate-400">Code: {pending.code}</span>
                    <span className="text-indigo-600">จำนวนที่นำเข้า: {pending.qty}</span>
                  </div>
                  <div className="space-y-2">
                    {pending.options.map((opt: any) => (
                      <label key={opt.id} className={`flex items-center p-3 rounded-xl border-2 transition-all cursor-pointer ${importResults[idx] === opt.id ? 'border-indigo-500 bg-indigo-50' : 'border-white bg-white hover:border-slate-200'}`}>
                        <input type="radio" name={`pending-${idx}`} checked={importResults[idx] === opt.id} onChange={() => setImportResults({...importResults, [idx]: opt.id})} className="hidden" />
                        <div className={`w-4 h-4 rounded-full border-2 mr-3 flex items-center justify-center ${importResults[idx] === opt.id ? 'border-indigo-500' : 'border-slate-300'}`}>
                          {importResults[idx] === opt.id && <div className="w-2 h-2 bg-indigo-500 rounded-full" />}
                        </div>
                        <div className="text-sm">
                          <div className="font-bold text-slate-800">{opt.itemName} <span className="text-[10px] text-slate-400">({opt.category})</span></div>
                          <div className="text-xs text-slate-500 mt-0.5">ราคา: {formatCur(opt.pricePerUnit, opt.currency || 'THB')} / {opt.unit}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t bg-slate-50 rounded-b-3xl">
              <button 
                onClick={confirmPendingImport} 
                disabled={Object.keys(importResults).length < importPending.length}
                className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold disabled:opacity-50 shadow-lg shadow-indigo-100"
              >
                ยืนยันการเลือกและนำเข้าทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:bg-white overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] print:max-h-full print:shadow-none print:rounded-none my-8">
            <div className="p-6 border-b flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <Printer size={20} className="text-indigo-600"/> พิมพ์รายงานชุดอุปกรณ์
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">เลือกรูปแบบรายงานที่ต้องการเพื่อแสดงพรีวิวสำหรับการพิมพ์</p>
              </div>
              
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 self-start md:self-auto">
                <button 
                  onClick={() => setPrintOption('names-only')} 
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${printOption === 'names-only' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  เฉพาะชื่อชุดอุปกรณ์
                </button>
                <button 
                  onClick={() => setPrintOption('with-details')} 
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${printOption === 'with-details' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  รวมรายละเอียดสินค้า
                </button>
              </div>
            </div>

            {/* Print paper mockup preview */}
            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 print:bg-white print:p-0" id="print-area-outer">
              <div id="printable-set-report" className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 w-full max-w-3xl mx-auto print:border-0 print:shadow-none print:p-4 text-black">
                {/* Scoped style for high-fidelity printing */}
                <style>{`
                  @media print {
                    body * {
                      visibility: hidden;
                    }
                    #printable-set-report, #printable-set-report * {
                      visibility: visible;
                    }
                    #printable-set-report {
                      position: absolute;
                      left: 0;
                      top: 0;
                      width: 100%;
                      background: white !important;
                      color: black !important;
                    }
                  }
                `}</style>

                <div className="text-center border-b pb-6 mb-6">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900">
                    {printOption === 'names-only' 
                      ? 'รายงานสรุปชุดอุปกรณ์สินค้า (Equipment Sets Summary Report)' 
                      : 'รายงานชุดอุปกรณ์พร้อมรายละเอียดสินค้า (Equipment Sets Detail Report)'
                    }
                  </h1>
                  <p className="text-sm text-slate-500 mt-1">
                    ข้อมูล ณ วันที่ {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100 print:bg-white">
                  <div>
                    <p className="font-bold text-slate-400 text-xs uppercase tracking-wider">ซัพพลายเออร์ (Supplier)</p>
                    <p className="font-extrabold text-slate-800 text-base mt-0.5">
                      {suppliers.find(s => s.id === selectedSupId)?.companyName || '-'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      แบรนด์: {suppliers.find(s => s.id === selectedSupId)?.brandName || '-'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-400 text-xs uppercase tracking-wider">เอกสารรายงาน</p>
                    <p className="font-bold text-slate-700 text-sm mt-0.5">จำนวนชุดอุปกรณ์ทั้งหมด {filteredSets.length} ชุด</p>
                    <p className="text-xs text-slate-500 mt-1">ผู้จัดทำรายงาน: ระบบบริหารการจัดซื้อ Smart PO</p>
                  </div>
                </div>

                {printOption === 'names-only' ? (
                  <table className="w-full text-xs text-left border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-3 border border-slate-200 w-12 text-center">ที่</th>
                        <th className="p-3 border border-slate-200">ชื่อชุดอุปกรณ์ (Equipment Set Name)</th>
                        <th className="p-3 border border-slate-200 w-36 text-center">จำนวนรายการพัสดุ</th>
                        <th className="p-3 border border-slate-200 text-right w-44">ราคาสุทธิรวมต่อชุด</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSets.map((s, idx) => {
                        const displayCur = s.currency || 'THB';
                        return (
                          <tr key={s.id} className="border-b border-slate-200 hover:bg-slate-50">
                            <td className="p-3 border border-slate-200 text-center text-slate-500">{idx + 1}</td>
                            <td className="p-3 border border-slate-200 font-bold text-slate-800">{s.name}</td>
                            <td className="p-3 border border-slate-200 text-center font-medium text-slate-600">
                              {s.items.reduce((total, explicitItem) => total + explicitItem.quantity, 0)} รายการ
                            </td>
                            <td className="p-3 border border-slate-200 text-right font-mono font-bold text-indigo-700">
                              {formatCur(getSetPrice(s.id, displayCur, exchangeRates), displayCur)}
                            </td>
                          </tr>
                        );
                      })}
                      {filteredSets.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">ไม่พบชุดอุปกรณ์ในรายการพิมพ์</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  <div className="space-y-8">
                    {filteredSets.map((s, idx) => {
                      const displayCur = s.currency || 'THB';
                      return (
                        <div key={s.id} className="border border-slate-200 rounded-xl overflow-hidden print:border-slate-350 print:break-inside-avoid">
                          <div className="bg-slate-100 p-4 border-b border-slate-200 flex justify-between items-center print:bg-slate-100">
                            <h3 className="font-extrabold text-sm text-slate-800">
                              {idx + 1}. {s.name}
                            </h3>
                            <span className="font-bold text-xs text-indigo-700">
                              ราคารวม: {formatCur(getSetPrice(s.id, displayCur, exchangeRates), displayCur)}
                            </span>
                          </div>
                          <table className="w-full text-[11px] text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-2.5 w-24">รหัสสินค้า</th>
                                <th className="p-2.5">ชื่อสินค้า (Item Name)</th>
                                <th className="p-2.5 w-24">หมวดหมู่</th>
                                <th className="p-2.5 w-16 text-center">จำนวน</th>
                                <th className="p-2.5 w-16 text-center">หน่วย</th>
                                <th className="p-2.5 w-24 text-right">ราคาต่อหน่วย</th>
                                <th className="p-2.5 w-24 text-right">ราคาสุทธิ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.items.map((it, idx2) => {
                                const itemData = items.find(x => x.id === it.itemId);
                                const itemCur = itemData?.currency || 'THB';
                                const netPriceOrig = (itemData?.pricePerUnit || 0) * (1 - (itemData?.discountPercent || 0) / 100);
                                const convertedPrice = convertPrice(netPriceOrig, itemCur, displayCur, exchangeRates);
                                const rowTotal = convertedPrice * it.quantity;
                                return (
                                  <tr key={idx2} className="border-b last:border-0 border-slate-150">
                                    <td className="p-2.5 font-mono text-slate-600 font-bold">{itemData?.code || '-'}</td>
                                    <td className="p-2.5 font-medium text-slate-800">{itemData?.itemName || '-'}</td>
                                    <td className="p-2.5 text-slate-500">{itemData?.category || '-'}</td>
                                    <td className="p-2.5 text-center font-bold text-slate-700">{it.quantity}</td>
                                    <td className="p-2.5 text-center text-slate-500">{itemData?.unit || '-'}</td>
                                    <td className="p-2.5 text-right font-mono">{formatCur(convertedPrice, displayCur)}</td>
                                    <td className="p-2.5 text-right font-mono font-bold text-indigo-700">{formatCur(rowTotal, displayCur)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    })}
                    {filteredSets.length === 0 && (
                      <p className="text-center p-8 text-slate-400 font-medium">ไม่พบชุดอุปกรณ์ในรายการพิมพ์</p>
                    )}
                  </div>
                )}

                <div className="mt-12 pt-6 border-t flex justify-between text-xs text-slate-400 font-medium">
                  <span>พิมพ์โดยระบบ Smart PO Cloud</span>
                  <span>หน้า 1 จาก 1</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-slate-50 rounded-b-3xl flex justify-between items-center print:hidden">
              <button onClick={() => setIsPrintModalOpen(false)} className="text-sm font-bold text-slate-500 hover:text-slate-800">
                ปิดหน้าต่าง
              </button>
              <div className="flex gap-3">
                <button onClick={() => setIsPrintModalOpen(false)} className="px-5 py-2.5 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all text-xs">
                  ยกเลิก
                </button>
                <button onClick={() => window.print()} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all text-xs shadow-lg shadow-indigo-100 flex items-center gap-2">
                  <Printer size={16}/> พิมพ์รายงาน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
