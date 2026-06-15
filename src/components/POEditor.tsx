import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Globe, Printer, Plus, Search, Trash2, Download, AlertTriangle, ArrowUpCircle } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { Item, EquipmentSet, Supplier, OrderLine, Employee, PurchaseOrder } from '../types';

interface POEditorProps {
  poId: string | null;
  onBack: () => void;
  items: Item[];
  equipmentSets: EquipmentSet[];
  suppliers: Supplier[];
  getSetPrice: (setId: string, targetCur: string, ratesObj: Record<string, number>) => number;
  db: Firestore;
  basePath: string;
  showAlert: (title: string, message: string) => void;
  exchangeRates: Record<string, number>;
  convertPrice: (amount: number, fromCur: string, toCur: string, ratesObj: Record<string, number>) => number;
  formatCur: (amount: number, cur?: string) => string;
  loggedInEmployee: Employee | null;
}

export default function POEditor({ 
  poId, onBack, items, equipmentSets, suppliers, getSetPrice, db, basePath, showAlert, exchangeRates, convertPrice, formatCur, loggedInEmployee 
}: POEditorProps) {
  const [title, setTitle] = useState('');
  const [orderLines, setOrderLines] = useState<any[]>([]); 
  
  const [selectedSupId, setSelectedSupId] = useState(''); 
  const [lineType, setLineType] = useState('item'); 
  const [searchLineTerm, setSearchLineTerm] = useState('');
  const [currentLineSelection, setCurrentLineSelection] = useState('');
  const [currentQty, setCurrentQty] = useState('');
  const [saving, setSaving] = useState(false);
  const [printMode, setPrintMode] = useState<'report1' | 'report2' | null>(null); 
  
  const [poCurrency, setPoCurrency] = useState('THB');
  const [savedRates, setSavedRates] = useState<Record<string, number> | null>(null); 
  const [createdBy, setCreatedBy] = useState(loggedInEmployee?.name || '');

  useEffect(() => {
    if (poId) {
      getDoc(doc(db, `${basePath}/purchaseOrders`, poId)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setTitle(data.title || '');
          const loadedLines = data.orderLines || (data.sets || []).map((s: any) => ({ type: 'set', refId: s.setId, quantity: s.quantity }));
          setOrderLines(loadedLines);
          setPoCurrency(data.currency || 'THB');
          setSavedRates(data.exchangeRates || null);
          setCreatedBy(data.createdBy || loggedInEmployee?.name || '');
          if (data.supplierId) {
            setSelectedSupId(data.supplierId);
          }
        }
      });
    } else {
      setTitle(`PO-${Date.now().toString().slice(-6)}`);
      setPoCurrency('THB');
      setSavedRates(null);
      setOrderLines([]);
      setSelectedSupId('');
      setCreatedBy(loggedInEmployee?.name || '');
    }
  }, [poId, db, basePath, loggedInEmployee]);

  const effectiveRates = savedRates || exchangeRates;

  const filteredSets = equipmentSets.filter(s => 
    s.supplierId === selectedSupId && 
    s.name.toLowerCase().includes(searchLineTerm.toLowerCase())
  );
  const filteredItems = items.filter(i => 
    i.supplierId === selectedSupId && 
    (i.code?.toLowerCase().includes(searchLineTerm.toLowerCase()) || 
     i.itemName?.toLowerCase().includes(searchLineTerm.toLowerCase()))
  );

  const report2Rows = useMemo(() => {
    const map: Record<string, number> = {};
    orderLines.forEach(line => {
      if (line.type === 'set') {
        const s = equipmentSets.find(e => e.id === line.refId);
        s?.items.forEach(itm => {
          if (!map[itm.itemId]) map[itm.itemId] = 0;
          map[itm.itemId] += (itm.quantity * line.quantity);
        });
      } else if (line.type === 'item') {
        if (!map[line.refId]) map[line.refId] = 0;
        map[line.refId] += line.quantity;
      }
    });

    return Object.entries(map).map(([id, qty]) => {
      const item = items.find(i => i.id === id);
      const sup = suppliers.find(su => su.id === item?.supplierId);
      
      const itemCur = item?.currency || 'THB';
      const price = item?.pricePerUnit || 0;
      const discount = item?.discountPercent || 0;
      const netPriceOrig = price * (1 - discount / 100);
      
      const convertedFullPrice = convertPrice(price, itemCur, poCurrency, effectiveRates);
      const convertedNetPrice = convertPrice(netPriceOrig, itemCur, poCurrency, effectiveRates);

      const moq = item?.moq || 0;
      const moqType = item?.moqType || 'minimum';
      
      let missingQty = 0;
      if (moq > 0) {
        if (moqType === 'multiple' && qty % moq !== 0) {
          missingQty = moq - (qty % moq);
        } else if (moqType === 'minimum' && qty < moq) {
          missingQty = moq - qty;
        }
      }

      return { 
        ...item, 
        id,
        supplierName: sup?.brandName || 'Unknown', 
        qty, 
        fullPrice: convertedFullPrice,
        netPrice: convertedNetPrice, 
        total: convertedNetPrice * qty,
        missingQty 
      };
    }).sort((a, b) => a.supplierName.localeCompare(b.supplierName));
  }, [orderLines, equipmentSets, items, suppliers, poCurrency, effectiveRates, convertPrice]);

  const handleSave = async () => {
    if (!title.trim() || orderLines.length === 0 || !selectedSupId) return;
    
    const failedMoq = report2Rows.filter(r => r.missingQty > 0);
    if (failedMoq.length > 0) {
      const msgs = failedMoq.map(r => {
        if (r.moqType === 'multiple') return `- ${r.itemName} (สั่ง ${r.qty} / ต้องสั่งทีละ ${r.moq})`;
        return `- ${r.itemName} (สั่ง ${r.qty} / ขั้นต่ำ ${r.moq})`;
      }).join('\n');
      showAlert('แจ้งเตือน (MOQ)', `กรุณาปรับยอดสั่งซื้อให้ตรงตามขั้นต่ำ (MOQ) ก่อนบันทึก:\n\n${msgs}\n\n*เคล็ดลับ: คุณสามารถกดปุ่ม "ปรับยอดอัตโนมัติ" ในรายงาน 2 ด้านล่างได้เลยครับ`);
      return;
    }

    setSaving(true);
    const total = orderLines.reduce((sum, line) => {
      if (line.type === 'set') return sum + getSetPrice(line.refId, poCurrency, effectiveRates) * line.quantity;
      if (line.type === 'item') {
        const item = items.find(i => i.id === line.refId);
        const itemCur = item?.currency || 'THB';
        const netPriceOrig = (item?.pricePerUnit || 0) * (1 - (item?.discountPercent || 0) / 100);
        return sum + convertPrice(netPriceOrig, itemCur, poCurrency, effectiveRates) * line.quantity;
      }
      return sum;
    }, 0);

    await setDoc(doc(db, `${basePath}/purchaseOrders`, poId || `PO-${Date.now()}`), { 
      title, 
      orderLines, 
      totalAmount: total, 
      currency: poCurrency,
      exchangeRates: effectiveRates, 
      supplierId: selectedSupId,
      createdBy: createdBy, 
      createdAt: serverTimestamp() 
    }, { merge: true });
    
    onBack();
  };

  const handleAddLine = () => {
    if (!currentLineSelection) return;
    const [type, id] = currentLineSelection.split('|');
    const qty = parseFloat(currentQty) || 1;
    setOrderLines([...orderLines, { type, refId: id, quantity: qty }]);
    setCurrentLineSelection('');
    setCurrentQty('');
  };

  const adjustMOQ = (itemId: string, missingQty: number) => {
    // Check if line item already exists so we append quantity, otherwise insert a new line
    const existingIndex = orderLines.findIndex(line => line.type === 'item' && line.refId === itemId);
    if (existingIndex > -1) {
      const updatedLines = [...orderLines];
      updatedLines[existingIndex].quantity = (updatedLines[existingIndex].quantity || 0) + missingQty;
      setOrderLines(updatedLines);
    } else {
      setOrderLines([...orderLines, { type: 'item', refId: itemId, quantity: missingQty }]);
    }
  };

  const handlePrint = (mode: 'report1' | 'report2') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
      setPrintMode(null);
    }, 150);
  };

  const exportReport1 = () => {
    const groupedLines: Record<string, any> = {};
    orderLines.forEach(line => {
      const key = `${line.type}-${line.refId}`;
      if (!groupedLines[key]) {
        groupedLines[key] = { ...line };
      } else {
        groupedLines[key].quantity += line.quantity;
      }
    });
    const aggregatedLines = Object.values(groupedLines);

    const headers = ['ประเภท', 'รหัสสินค้า', 'รายการ', `ราคาเต็ม/หน่วย (${poCurrency})`, 'ส่วนลด (%)', `ราคา(สุทธิ)/หน่วย (${poCurrency})`, 'เงื่อนไข MOQ', 'จำนวน', 'หน่วย', `ราคารวม (${poCurrency})`];
    const rows = aggregatedLines.map(line => {
      const isSet = line.type === 'set';
      const typeStr = isSet ? 'ชุดอุปกรณ์' : 'สินค้ารายชิ้น';
      
      let code = '-';
      let name = '';
      let fullPrice = 0;
      let discount = 0;
      let netPrice = 0;
      let moqDisplay = '-';
      let unit = '';

      if (isSet) {
        const s = equipmentSets.find(e => e.id === line.refId);
        name = s?.name || 'Unknown Set';
        netPrice = getSetPrice(line.refId, poCurrency, effectiveRates);
        fullPrice = netPrice; 
        unit = 'ชุด';
      } else {
        const itm = items.find(e => e.id === line.refId);
        code = itm?.code || '-';
        name = itm?.itemName || 'Unknown Item';
        const itemCur = itm?.currency || 'THB';
        
        const origFull = itm?.pricePerUnit || 0;
        discount = itm?.discountPercent || 0;
        const origNet = origFull * (1 - discount / 100);

        fullPrice = convertPrice(origFull, itemCur, poCurrency, effectiveRates);
        netPrice = convertPrice(origNet, itemCur, poCurrency, effectiveRates);

        moqDisplay = (itm && itm.moq > 0) ? (itm.moqType === 'multiple' ? `ทุกๆ ${itm.moq}` : `ขั้นต่ำ ${itm.moq}`) : '-';
        unit = itm?.unit || '-';
      }
      return [typeStr, code, name, fullPrice.toFixed(2), discount, netPrice.toFixed(2), moqDisplay, line.quantity, unit, (netPrice * line.quantity).toFixed(2)];
    });

    const total = rows.reduce((sum, r) => sum + parseFloat(r[9] as string), 0);
    rows.push(['', '', '', '', '', '', '', '', 'ยอดรวมทั้งสิ้น', total.toFixed(2)]);
    
    import('../utils/helpers').then(h => {
      h.exportToCSV(`PO_Report1_${title || 'Untitled'}.csv`, [headers, ...rows]);
    });
  };

  const exportReport2 = () => {
    const headers = ['ซัพพลายเออร์', 'รหัสสินค้า', 'หมวดหมู่', 'ชื่อสินค้า', `ราคาเต็ม/หน่วย (${poCurrency})`, 'ส่วนลด (%)', `ราคา(สุทธิ)/หน่วย (${poCurrency})`, 'เงื่อนไข MOQ', 'รวมจำนวน', 'หน่วย', `ราคารวม (${poCurrency})`];
    const rows = report2Rows.map(r => {
      const moq = r.moq || 0;
      const moqDisplay = moq > 0 ? (r.moqType === 'multiple' ? `ทุกๆ ${moq}` : `ขั้นต่ำ ${moq}`) : '-';
      return [
        r.supplierName, 
        r.code || '', 
        r.category || '', 
        r.itemName || '', 
        (r.fullPrice || 0).toFixed(2),
        r.discountPercent || 0,
        r.netPrice.toFixed(2), 
        moqDisplay, 
        r.qty, 
        r.unit || '', 
        r.total.toFixed(2)
      ];
    });

    const total = rows.reduce((sum, r) => sum + parseFloat(r[10] as string), 0);
    rows.push(['', '', '', '', '', '', '', '', '', 'ยอดรวมทั้งสิ้น', total.toFixed(2)]);

    import('../utils/helpers').then(h => {
      h.exportToCSV(`PO_Report2_${title || 'Untitled'}.csv`, [headers, ...rows]);
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 print:p-0 print:m-0 print:max-w-none print:w-full">
      <div className="flex justify-between items-center print:hidden bg-white p-4 rounded-2xl border shadow-sm border-slate-100">
        <div className="flex items-center space-x-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={20}/></button>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="font-bold text-lg border-b border-transparent focus:border-indigo-500 outline-none px-2 py-1 w-48" placeholder="เลขที่ PO"/>
          
          <div className="flex items-center bg-slate-50 border rounded-lg px-2 py-1">
            <Globe size={14} className="text-slate-400 mr-2"/>
            <select value={poCurrency} onChange={e => setPoCurrency(e.target.value)} className="bg-transparent text-sm font-bold outline-none text-indigo-700">
              <option value="THB">THB</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="JPY">JPY</option>
              <option value="CNY">CNY</option>
              <option value="GBP">GBP</option>
              <option value="SGD">SGD</option>
            </select>
          </div>
        </div>
        <div className="flex space-x-2">
          <button onClick={() => handlePrint('report1')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center shadow-sm hover:bg-slate-200 transition-colors text-sm"><Printer size={16} className="mr-2"/> พิมพ์รายงาน 1</button>
          <button onClick={() => handlePrint('report2')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center shadow-sm hover:bg-slate-200 transition-colors text-sm"><Printer size={16} className="mr-2"/> พิมพ์รายงาน 2</button>
          <button onClick={handleSave} disabled={saving || !selectedSupId} className={`px-6 py-2 rounded-xl font-bold shadow-lg transition-all ml-2 ${(!selectedSupId || saving) ? 'bg-slate-300 text-slate-500' : 'bg-indigo-600 text-white active:scale-95'}`}>{saving ? '...' : 'บันทึก'}</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border shadow-sm print:hidden border-slate-100">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center"><Plus size={18} className="mr-2 text-indigo-500"/> เลือกรายการเข้าบิล</h3>
        
        <div className="mb-6">
          <select 
            value={selectedSupId} 
            onChange={e => { setSelectedSupId(e.target.value); setOrderLines([]); }} 
            disabled={orderLines.length > 0}
            className="w-full border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
          >
            <option value="">-- กรุณาระบุซัพพลายเออร์สำหรับใบสั่งซื้อนี้ --</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.brandName || s.companyName}</option>)}
          </select>
          {orderLines.length > 0 && <p className="text-xs text-amber-500 mt-2">* ลบรายการทั้งหมดในบิลออกก่อน หากต้องการเปลี่ยนซัพพลายเออร์</p>}
        </div>

        {selectedSupId && (
          <div className="flex flex-col gap-3 animate-in fade-in">
            <div className="flex flex-col md:flex-row gap-3">
              <select 
                value={lineType} 
                onChange={e => { setLineType(e.target.value); setCurrentLineSelection(''); setSearchLineTerm(''); }} 
                className="md:w-1/4 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-bold text-indigo-700"
              >
                <option value="item">🏷️ เลือกจากสินค้ารายตัว</option>
                <option value="set">📦 เลือกจากชุดอุปกรณ์</option>
              </select>
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-3.5 text-slate-400"/>
                <input 
                  type="text" 
                  placeholder={lineType === 'set' ? "ค้นหาชื่อชุดอุปกรณ์..." : "ค้นหารหัส หรือ ชื่อสินค้า..."} 
                  value={searchLineTerm} 
                  onChange={e => setSearchLineTerm(e.target.value)} 
                  className="w-full pl-10 pr-3 py-3 border rounded-xl text-sm outline-none focus:border-indigo-500 bg-slate-50"
                />
              </div>
            </div>
            <div className="flex flex-col md:flex-row gap-3">
              <select value={currentLineSelection} onChange={e => setCurrentLineSelection(e.target.value)} className="flex-1 border rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700">
                <option value="">-- {lineType === 'set' ? 'คลิกเพื่อเลือกชุดอุปกรณ์' : 'คลิกเพื่อเลือกสินค้ารายตัว'} --</option>
                {lineType === 'set' && filteredSets.map(s => (
                  <option key={`set-${s.id}`} value={`set|${s.id}`}>{s.name} ({formatCur(getSetPrice(s.id, poCurrency, effectiveRates), poCurrency)})</option>
                ))}
                {lineType === 'item' && filteredItems.map(i => {
                   const itemCur = i.currency || 'THB';
                   const netPriceOrig = (i.pricePerUnit || 0) * (1 - (i.discountPercent || 0) / 100);
                   const convertedNet = convertPrice(netPriceOrig, itemCur, poCurrency, effectiveRates);
                   return <option key={`item-${i.id}`} value={`item|${i.id}`}>[{i.code}] {i.itemName} ({formatCur(convertedNet, poCurrency)})</option>
                })}
              </select>
              <div className="flex gap-2">
                <input type="number" min="0.01" step="any" value={currentQty} onChange={e => setCurrentQty(e.target.value)} className="w-20 border rounded-xl p-3 outline-none text-center font-bold" title="จำนวน" placeholder="จำนวน"/>
                <button onClick={handleAddLine} className="bg-slate-800 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 whitespace-nowrap">เพิ่มลงบิล</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-10 print:space-y-0">
        {/* Report 1 */}
        <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm border-slate-100 print:border-none print:shadow-none print:rounded-none ${printMode === 'report2' ? 'print:hidden' : ''}`}>
          
          <div className="hidden print:block mb-6 text-center border-b-2 border-slate-800 pb-4">
            <h1 className="text-2xl font-bold text-slate-900 uppercase">ใบสั่งซื้อ (Purchase Order)</h1>
            <div className="flex justify-between mt-4 text-sm font-bold text-slate-700">
              <span>เลขที่อ้างอิง: {title}</span>
              <span>วันที่พิมพ์: {new Date().toLocaleDateString('th-TH')}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 border-b flex justify-between items-center print:hidden">
            <span className="font-bold text-slate-800">รายงาน 1: รายการในบิลสั่งซื้อ (ชุดอุปกรณ์ และ สินค้ารายตัว)</span>
            <button onClick={exportReport1} className="text-xs flex items-center bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 shadow-sm font-medium transition-colors">
              <Download size={14} className="mr-1.5"/> Export CSV
            </button>
          </div>
          <table className="w-full text-sm text-left print:border-collapse print:w-full">
            <thead className="bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase tracking-widest print:bg-slate-100 print:text-slate-800 print:text-xs">
              <tr><th className="p-4 print:border print:border-slate-300">ประเภท</th><th className="p-4 print:border print:border-slate-300">รายการ</th><th className="p-4 text-center print:border print:border-slate-300">จำนวน</th><th className="p-4 text-right print:border print:border-slate-300">ราคาหน่วย</th><th className="p-4 text-right print:border print:border-slate-300">ราคารวม</th><th className="p-4 print:hidden text-center">จัดการ</th></tr>
            </thead>
            <tbody className="divide-y text-[13px] print:divide-y-0">
              {orderLines.map((line, i) => {
                let name = '';
                let price = 0;
                let isSet = line.type === 'set';
                
                if (isSet) {
                  const s = equipmentSets.find(e => e.id === line.refId);
                  name = s?.name || 'Unknown Set';
                  price = getSetPrice(line.refId, poCurrency, effectiveRates);
                } else {
                  const itm = items.find(e => e.id === line.refId);
                  name = itm ? `[${itm.code}] ${itm.itemName}` : 'Unknown Item';
                  const itemCur = itm?.currency || 'THB';
                  const netOrig = (itm?.pricePerUnit || 0) * (1 - (itm?.discountPercent || 0)/100);
                  price = convertPrice(netOrig, itemCur, poCurrency, effectiveRates);
                }

                return (
                  <tr key={i} className="hover:bg-slate-50/50 print:border-b print:border-slate-200">
                    <td className="p-4 print:border print:border-slate-300">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold ${isSet ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'} print:bg-transparent print:p-0 print:text-slate-800 print:text-xs`}>
                        {isSet ? 'ชุดอุปกรณ์' : 'สินค้ารายชิ้น'}
                      </span>
                    </td>
                    <td className="p-4 font-bold text-slate-700 print:border print:border-slate-300 print:text-xs">{name}</td>
                    <td className="p-4 text-center print:border print:border-slate-300 print:p-2">
                      <input 
                        type="number" min="0.01" step="any" value={line.quantity} 
                        onChange={(e) => {
                          const val = e.target.value;
                          const newQty = val === '' ? 0 : parseFloat(val);
                          const newLines = [...orderLines];
                          newLines[i] = { ...newLines[i], quantity: newQty };
                          setOrderLines(newLines);
                        }}
                        className="w-20 border border-slate-300 rounded-lg p-1.5 text-center text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-bold text-indigo-600 bg-white shadow-sm print:border-none print:shadow-none print:bg-transparent print:p-0 print:text-slate-900 print:w-auto"
                        title="แก้ไขจำนวน"
                      />
                    </td>
                    <td className="p-4 text-right font-mono print:border print:border-slate-300 print:text-xs">{formatCur(price, poCurrency)}</td>
                    <td className="p-4 text-right font-bold text-slate-900 font-mono print:border print:border-slate-300 print:text-xs">{formatCur(price * line.quantity, poCurrency)}</td>
                    <td className="p-4 text-center print:hidden"><button type="button" onClick={(e) => { e.preventDefault(); setOrderLines(orderLines.filter((_, idx) => idx !== i)); }} className="text-red-400 p-1 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button></td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50/50 font-bold print:bg-slate-100">
                <td colSpan={4} className="p-4 text-right print:border print:border-slate-300">ยอดรวมทั้งสิ้น (Total)</td>
                <td className="p-4 text-right text-indigo-700 font-mono print:border print:border-slate-300 print:text-slate-900">
                  {formatCur(orderLines.reduce((sum, line) => {
                    let p = 0;
                    if (line.type === 'set') p = getSetPrice(line.refId, poCurrency, effectiveRates);
                    else {
                      const itm = items.find(e => e.id === line.refId);
                      const itemCur = itm?.currency || 'THB';
                      const netOrig = (itm?.pricePerUnit || 0) * (1 - (itm?.discountPercent || 0)/100);
                      p = convertPrice(netOrig, itemCur, poCurrency, effectiveRates);
                    }
                    return sum + (p * line.quantity);
                  }, 0), poCurrency)}
                </td>
                <td className="print:hidden"></td>
              </tr>
            </tfoot>
          </table>
          
          <div className="hidden print:flex justify-between mt-20 px-10">
            <div className="text-center">
              <div className="border-b border-slate-400 w-40 mx-auto mb-2"></div>
              <div className="text-sm font-bold">ผู้จัดทำ (Prepared By)</div>
              <div className="text-xs text-slate-500 mt-1">{createdBy}</div>
              <div className="text-xs text-slate-500 mt-1">วันที่ (Date): ____/____/____</div>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-400 w-40 mx-auto mb-2"></div>
              <div className="text-sm font-bold">ผู้อนุมัติ (Approved By)</div>
              <div className="text-xs text-slate-500 mt-1"><br/></div>
              <div className="text-xs text-slate-500 mt-1">วันที่ (Date): ____/____/____</div>
            </div>
          </div>
        </div>

        {/* Report 2 */}
        <div className={`bg-white border rounded-2xl overflow-hidden shadow-sm border-slate-100 print:border-none print:shadow-none print:rounded-none ${printMode === 'report1' ? 'print:hidden' : ''}`}>
          
          <div className="hidden print:block mb-6 text-center border-b-2 border-slate-800 pb-4 print:mt-0">
            <h1 className="text-2xl font-bold text-slate-900 uppercase">สรุปรายการเบิกสินค้าย่อย (Item Summary)</h1>
            <div className="flex justify-between mt-4 text-sm font-bold text-slate-700">
              <span>อ้างอิงจากใบสั่งซื้อ: {title}</span>
              <span>วันที่พิมพ์: {new Date().toLocaleDateString('th-TH')}</span>
            </div>
          </div>

          <div className="bg-slate-50 p-4 border-b flex justify-between items-center print:hidden">
            <span className="font-bold text-slate-800">รายงาน 2: สรุปรายการสินค้าย่อยทั้งหมด</span>
            <button onClick={exportReport2} className="text-xs flex items-center bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50 shadow-sm font-medium transition-colors">
              <Download size={14} className="mr-1.5"/> Export CSV
            </button>
          </div>
          <table className="w-full text-sm text-left print:border-collapse print:w-full">
            <thead className="bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase tracking-widest print:bg-slate-100 print:text-slate-800 print:text-xs">
              <tr>
                <th className="p-4 print:border print:border-slate-300">ซัพพลายเออร์</th>
                <th className="p-4 print:border print:border-slate-300">ชื่อสินค้า</th>
                <th className="p-4 text-right font-mono print:border print:border-slate-300">ราคา (สุทธิ)</th>
                <th className="p-4 text-center print:border print:border-slate-300">MOQ (เงื่อนไข)</th>
                <th className="p-4 text-center print:border print:border-slate-300">รวมจำนวน</th>
                <th className="p-4 text-right font-mono print:border print:border-slate-300">ราคารวม</th>
              </tr>
            </thead>
            <tbody className="divide-y text-[13px] print:divide-y-0">
              {report2Rows.map((r, i) => {
                const isMoqFailed = r.missingQty > 0;
                const moqWarningTitle = r.moqType === 'multiple' ? `ต้องสั่งทีละ ${r.moq} ${r.unit}` : `ต้องสั่งขั้นต่ำ ${r.moq} ${r.unit}`;
                const moqDisplay = r.moqType === 'multiple' ? `ทุกๆ ${r.moq}` : `ขั้นต่ำ ${r.moq}`;

                return (
                  <tr key={i} className={`${isMoqFailed ? 'bg-red-50/50' : 'hover:bg-slate-50/50'} print:border-b print:border-slate-200`}>
                    <td className="p-4 print:border print:border-slate-300 print:text-xs"><span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold print:bg-transparent print:p-0 print:text-slate-900 print:text-xs">{r.supplierName}</span></td>
                    <td className="p-4 print:border print:border-slate-300 print:text-xs">
                      <div className="font-bold flex items-center">
                        {r.itemName}
                        {isMoqFailed && <AlertTriangle size={14} className="text-red-500 ml-2 print:hidden" title={moqWarningTitle} />}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 print:text-slate-600">{r.code} | {r.category}</div>
                    </td>
                    <td className="p-4 text-right font-mono text-slate-500 print:border print:border-slate-300 print:text-slate-900 print:text-xs">
                      {r.discountPercent > 0 && <div className="text-[10px] text-red-400 line-through print:hidden">{formatCur(r.fullPrice, poCurrency)}</div>}
                      <div className="text-slate-700 print:text-slate-900">{formatCur(r.netPrice, poCurrency)}</div>
                    </td>
                    <td className="p-4 text-center print:border print:border-slate-300 print:text-xs">
                      {r.moq > 0 ? <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-[11px] font-bold whitespace-nowrap print:bg-transparent print:text-slate-900 print:p-0">{moqDisplay}</span> : <span className="text-slate-300 print:text-slate-600">-</span>}
                    </td>
                    <td className="p-4 text-center print:border print:border-slate-300 print:text-xs">
                      <div className={`font-bold ${isMoqFailed ? 'text-red-600' : 'text-indigo-600'} print:text-slate-900`}>{r.qty} {r.unit}</div>
                      {isMoqFailed && (
                        <button onClick={() => adjustMOQ(r.id, r.missingQty)} className="mt-2 text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded flex items-center justify-center mx-auto hover:bg-green-200 transition-colors print:hidden shadow-sm">
                          <ArrowUpCircle size={12} className="mr-1"/> ปรับยอดอัตโนมัติ (+{r.missingQty})
                        </button>
                      )}
                    </td>
                    <td className="p-4 text-right font-bold text-slate-900 font-mono print:border print:border-slate-300 print:text-xs">{formatCur(r.total, poCurrency)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-indigo-50/50 font-bold print:bg-slate-100"><td colSpan={5} className="p-4 text-right print:border print:border-slate-300">ยอดรวมทั้งสิ้น (Total)</td><td className="p-4 text-right text-indigo-700 font-mono print:border print:border-slate-300 print:text-slate-900">{formatCur(report2Rows.reduce((sum, r) => sum + r.total, 0), poCurrency)}</td></tr>
            </tfoot>
          </table>
          
          <div className="hidden print:flex justify-between mt-20 px-10">
            <div className="text-center">
              <div className="border-b border-slate-400 w-40 mx-auto mb-2"></div>
              <div className="text-sm font-bold">ผู้จัดทำ (Prepared By)</div>
              <div className="text-xs text-slate-500 mt-1">{createdBy}</div>
              <div className="text-xs text-slate-500 mt-1">วันที่ (Date): ____/____/____</div>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-400 w-40 mx-auto mb-2"></div>
              <div className="text-sm font-bold">ผู้อนุมัติ (Approved By)</div>
              <div className="text-xs text-slate-500 mt-1"><br/></div>
              <div className="text-xs text-slate-500 mt-1">วันที่ (Date): ____/____/____</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
