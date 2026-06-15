import React, { useState } from 'react';
import { Shield, UserCircle, Lock, LogIn, AlertCircle } from 'lucide-react';
import { Employee } from '../types';

interface AppLoginScreenProps {
  employees: Employee[];
  onLogin: (emp: Employee) => void;
}

export default function AppLoginScreen({ employees, onLogin }: AppLoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // ค้นหาพนักงานจากฐานข้อมูลที่โหลดมา
    const foundUser = employees.find(emp => 
      emp.username.toLowerCase() === username.trim().toLowerCase() && 
      emp.password === password
    );

    if (foundUser) {
      onLogin(foundUser);
    } else {
      setError('รหัสพนักงาน หรือ รหัสผ่านไม่ถูกต้อง');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white max-w-md w-full rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-indigo-600 p-8 text-center text-white">
          <div className="bg-white/20 p-4 rounded-2xl inline-block mb-4 backdrop-blur-sm">
            <Shield size={32} />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Smart PO Manager</h2>
          <p className="text-indigo-100 mt-2 text-sm">เข้าสู่ระบบด้วยรหัสพนักงาน</p>
        </div>
        
        <div className="p-8">
          <h3 className="text-xl font-bold text-slate-800 mb-6 text-center">เข้าสู่ระบบ (Sign In)</h3>

          {error && (
            <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium mb-6 flex items-start border border-red-100">
              <AlertCircle size={18} className="mr-2 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">รหัสพนักงาน / Username</label>
              <div className="relative">
                <UserCircle size={18} className="absolute left-4 top-3.5 text-slate-400" />
                <input 
                  type="text" required
                  value={username} onChange={e => setUsername(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50 focus:bg-white font-bold text-slate-700"
                  placeholder="กรอกรหัสพนักงาน"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">รหัสผ่าน (Password)</label>
              <div className="relative">
                <Lock size={18} className="absolute left-4 top-3.5 text-slate-400" />
                <input 
                  type="password" required
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all bg-slate-50 focus:bg-white font-bold text-slate-700"
                  placeholder="กรอกรหัสผ่าน"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 flex justify-center items-center mt-8"
            >
              <LogIn size={18} className="mr-2"/> เข้าสู่ระบบ
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
