import React from 'react';

interface SidebarButtonProps {
  icon: React.ComponentType<any>;
  label: string;
  active: boolean;
  onClick: () => void;
  customClass?: string;
}

export default function SidebarButton({ icon: Icon, label, active, onClick, customClass }: SidebarButtonProps) {
  let defaultClass = active ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900';
  if (customClass) {
    const activeClass = customClass.split(' ').find(c => c.startsWith('data-[active=true]:'))?.replace('data-[active=true]:', '') || 'bg-emerald-600 text-white shadow-md shadow-emerald-100';
    const inactiveClass = customClass.split(' ').filter(c => !c.startsWith('data-[active=true]:')).join(' ');
    defaultClass = active ? activeClass : inactiveClass;
  }

  return (
    <button onClick={onClick} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${defaultClass}`}>
      <Icon size={18} />
      <span className="font-medium text-sm">{label}</span>
    </button>
  );
}
