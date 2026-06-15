import React from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { doc, deleteDoc, Firestore } from 'firebase/firestore';
import { PurchaseOrder, Supplier } from '../types';

interface POListProps {
  purchaseOrders: PurchaseOrder[];
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  db: Firestore;
  basePath: string;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  suppliers: Supplier[];
}

export default function POList({ purchaseOrders, onCreateNew, onEdit, db, basePath, showConfirm, suppliers }: POListProps) {
  const handleDelete = async (id: string) => {
    showConfirm('ยืนยันการลบ', 'ต้องการลบใบสั่งซื้อนี้ใช่หรือไม่?', async () => {
      await deleteDoc(doc(db, `${basePath}/purchaseOrders`, id));
    });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">ใบสั่งซื้อทั้งหมด</h2>
          <p className="text-slate-500 text-sm">รายการประวัติการสั่งซื้อของคุณ</p>
        </div>
        <button onClick={onCreateNew} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center shadow-lg active:scale-95">
          <Plus size={20} className="mr-2" /> สร้างใบสั่งซื้อใหม่
        </button>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {purchaseOrders.length === 0 ? (
          <div className="p-16 text-center text-slate-400 font-medium">ไม่พบข้อมูลใบสั่งซื้อ</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b">
                <tr>
                  <th className="p-5">เลขที่อ้างอิง</th>
                  <th className="p-5">วันที่ / ผู้จัดทำ</th>
                  <th className="p-5">ซัพพลายเออร์</th>
                  <th className="p-5 text-center">จำนวนรายการ</th>
                  <th className="p-5 text-right">ยอดรวม</th>
                  <th className="p-5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-100">
                {purchaseOrders.map(po => {
                  const lineCount = po.orderLines ? po.orderLines.length : (po.sets?.length || 0);
                  const sup = suppliers.find(s => s.id === po.supplierId);
                  const supName = sup ? (sup.brandName || sup.companyName) : '-';
                  return (
                    <tr key={po.id} className="hover:bg-slate-50/50">
                      <td className="p-5 font-bold text-indigo-600 cursor-pointer" onClick={() => onEdit(po.id)}>{po.title || po.id}</td>
                      <td className="p-5 text-slate-500">
                        <div>{po.createdAt?.toDate ? po.createdAt.toDate().toLocaleDateString('th-TH') : '-'}</div>
                        {po.createdBy && <div className="text-[10px] text-slate-400 mt-1">โดย: {po.createdBy}</div>}
                      </td>
                      <td className="p-5 text-slate-700 font-medium">{supName}</td>
                      <td className="p-5 text-center"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">{lineCount} รายการ</span></td>
                      <td className="p-5 text-right font-bold text-slate-900 font-mono">
                        {new Intl.NumberFormat('th-TH', { style: 'currency', currency: po.currency || 'THB' }).format(po.totalAmount || 0)}
                      </td>
                      <td className="p-5 text-center flex justify-center space-x-2">
                        <button onClick={() => onEdit(po.id)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit size={16}/></button>
                        <button onClick={(e) => { e.preventDefault(); handleDelete(po.id); }} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 size={16}/></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
