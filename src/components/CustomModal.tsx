import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { CustomModalProps } from '../types';

export default function CustomModal({ isOpen, type, title, message, onConfirm, onCancel }: CustomModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 transform transition-all">
        <div className="flex items-center space-x-3 mb-4">
          {type === 'alert' ? <AlertCircle className="text-amber-500" size={28}/> : <AlertTriangle className="text-red-500" size={28}/>}
          <h3 className="text-xl font-bold text-slate-800">{title}</h3>
        </div>
        <div className="text-slate-600 text-sm mb-6 whitespace-pre-line leading-relaxed">{message}</div>
        <div className="flex justify-end gap-3">
          {type === 'confirm' && onCancel && (
            <button onClick={onCancel} className="px-5 py-2.5 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold transition-colors">ยกเลิก</button>
          )}
          {onConfirm && (
            <button onClick={onConfirm} className={`px-5 py-2.5 text-white rounded-xl font-bold transition-colors shadow-lg ${type === 'alert' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-red-600 hover:bg-red-700 shadow-red-200'}`}>
              {type === 'alert' ? 'ตกลง' : 'ยืนยัน'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
