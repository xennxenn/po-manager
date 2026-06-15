import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, Package, Users, Database, FileText, UserPlus, Shield, UserCircle, LogOut 
} from 'lucide-react';
import { 
  collection, doc, setDoc, onSnapshot, deleteDoc, serverTimestamp, getDocs 
} from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';

// Internal module imports
import { db, auth, BASE_PATH } from './lib/firebase';
import { DEFAULT_RATES, convertPrice, formatCur } from './utils/helpers';
import { Employee, Supplier, Item, EquipmentSet, PurchaseOrder, CustomModalProps } from './types';

// Component imports
import CustomModal from './components/CustomModal';
import AppLoginScreen from './components/AppLoginScreen';
import SidebarButton from './components/SidebarButton';
import EmployeeMaster from './components/EmployeeMaster';
import SupplierMaster from './components/SupplierMaster';
import ItemMaster from './components/ItemMaster';
import EquipmentSetMaster from './components/EquipmentSetMaster';
import POList from './components/POList';
import POEditor from './components/POEditor';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [loggedInEmployee, setLoggedInEmployee] = useState<Employee | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [exchangeRates, setExchangeRates] = useState<Record<string, number>>(DEFAULT_RATES);

  // App Data State
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [equipmentSets, setEquipmentSets] = useState<EquipmentSet[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [editingPoId, setEditingPoId] = useState<string | null>(null);

  const [modal, setModal] = useState<CustomModalProps>({ 
    isOpen: false, 
    type: 'confirm', 
    title: '', 
    message: '', 
    onConfirm: null, 
    onCancel: null 
  });

  const showConfirm = (title: string, message: string, onConfirmCallback: () => void) => {
    setModal({
      isOpen: true, 
      type: 'confirm', 
      title, 
      message,
      onConfirm: () => { 
        if (onConfirmCallback) onConfirmCallback(); 
        setModal(prev => ({ ...prev, isOpen: false })); 
      },
      onCancel: () => setModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const showAlert = (title: string, message: string) => {
    setModal({
      isOpen: true, 
      type: 'alert', 
      title, 
      message,
      onConfirm: () => setModal(prev => ({ ...prev, isOpen: false })),
      onCancel: () => setModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  // Fetch Exchange Rates on load
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/THB')
      .then(res => res.json())
      .then(data => { 
        if (data && data.rates) {
          setExchangeRates(data.rates); 
        }
      })
      .catch(err => console.error('Fetch rates error, using defaults', err));
  }, []);

  // Firebase Anonymous Auth
  useEffect(() => {
    const initAuth = async () => {
      try { 
        await signInAnonymously(auth); 
      } catch (error) { 
        console.error("Firebase Auth error:", error); 
        setLoadingAuth(false); 
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => { 
      setFirebaseUser(u); 
    });
    return () => unsubscribe();
  }, []);

  // Sync data dynamically with Firestore
  useEffect(() => {
    if (!firebaseUser) return;
    
    const unsubEmployees = onSnapshot(collection(db, `${BASE_PATH}/employees`), (snap) => {
      const emps = snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
      setEmployees(emps);
      
      // Auto Create Initial Admin Account if no employee records exist
      if (emps.length === 0) {
        setDoc(doc(db, `${BASE_PATH}/employees`, 'admin'), {
          username: 'Admin',
          name: 'Administrator',
          password: '1234',
          role: 'admin',
          createdAt: serverTimestamp()
        });
      }
      setLoadingAuth(false); 
    });

    const unsubSuppliers = onSnapshot(collection(db, `${BASE_PATH}/suppliers`), (snap) => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Supplier)));
    });

    const unsubItems = onSnapshot(collection(db, `${BASE_PATH}/items`), (snap) => {
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() } as Item)));
    });

    const unsubSets = onSnapshot(collection(db, `${BASE_PATH}/equipmentSets`), (snap) => {
      setEquipmentSets(snap.docs.map(d => ({ id: d.id, ...d.data() } as EquipmentSet)));
    });

    const unsubPOs = onSnapshot(collection(db, `${BASE_PATH}/purchaseOrders`), (snap) => {
      setPurchaseOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
    });

    return () => { 
      unsubEmployees(); 
      unsubSuppliers(); 
      unsubItems(); 
      unsubSets(); 
      unsubPOs(); 
    };
  }, [firebaseUser]);

  const getSetPrice = (setId: string, targetCur: string = 'THB', ratesObj: Record<string, number> = exchangeRates) => {
    const eqSet = equipmentSets.find(s => s.id === setId);
    if (!eqSet) return 0;
    return eqSet.items.reduce((total, setItem) => {
      const item = items.find(i => i.id === setItem.itemId);
      const price = item?.pricePerUnit || 0;
      const discount = item?.discountPercent || 0;
      const netPrice = price * (1 - discount / 100);
      const itemCur = item?.currency || 'THB';
      const convertedPrice = convertPrice(netPrice, itemCur, targetCur, ratesObj);
      return total + (convertedPrice * setItem.quantity);
    }, 0);
  };

  const recoverOldData = async () => {
    if (!firebaseUser) return;
    showConfirm(
      'ดึงข้อมูลระบบเก่าทั้งหมด', 
      'ระบบจะกวาดข้อมูลเดิมทั้งหมด (สินค้า, ซัพพลายเออร์, ใบสั่งซื้อ, และชุดอุปกรณ์) ที่เคยบันทึกในบัญชีส่วนตัว กลับมารวมใส่ในระบบแชร์ส่วนกลางเพื่อให้พนักงานทุกคนเห็นร่วมกัน คุณต้องการดำเนินการหรือไม่?', 
      async () => {
        try {
          const oldBasePath = `users/${firebaseUser.uid}`;
          const collectionsToMigrate = ['suppliers', 'items', 'equipmentSets', 'purchaseOrders'];
          let totalMigrated = 0;

          for (const col of collectionsToMigrate) {
            const snapshot = await getDocs(collection(db, `${oldBasePath}/${col}`));
            for (const docSnap of snapshot.docs) {
              await setDoc(doc(db, `${BASE_PATH}/${col}`, docSnap.id), docSnap.data(), { merge: true });
              totalMigrated++;
            }
          }
          
          showAlert("ดึงข้อมูลสำเร็จ!", `ระบบตรวจพบและดึงข้อมูลเดิมกลับเข้ามาทั้งหมดสำเร็จเรียบร้อยจำนวน ${totalMigrated} รายการครับ`);
        } catch (err: any) {
          showAlert("ข้อผิดพลาด", "ไม่สามารถกู้คืนข้อมูลได้: " + err.message);
        }
      }
    );
  };

  const seedDatabase = async () => {
    if (!firebaseUser) return;
    try {
      const s1Id = 'SUP001';
      await setDoc(doc(db, `${BASE_PATH}/suppliers`, s1Id), { 
        brandName: 'IT Solutions', 
        companyName: 'IT Solutions Co.,Ltd.', 
        address: 'Bangkok, Thailand', 
        branch: 'HQ', 
        taxId: '1234567890123' 
      });
      
      const i1Id = 'ITM001';
      await setDoc(doc(db, `${BASE_PATH}/items`, i1Id), { 
        supplierId: s1Id, 
        code: '885001', 
        category: 'IT', 
        itemName: 'Wireless Mouse (เมาส์ไร้สาย)', 
        pricePerUnit: 20, 
        currency: 'USD', 
        unit: 'อัน', 
        discountPercent: 0, 
        moq: 5, 
        moqType: 'minimum' 
      });
      
      const i2Id = 'ITM002';
      await setDoc(doc(db, `${BASE_PATH}/items`, i2Id), { 
        supplierId: s1Id, 
        code: '885002', 
        category: 'IT', 
        itemName: 'Keyboard Premium (คีย์บอร์ดกลไก)', 
        pricePerUnit: 990, 
        currency: 'THB', 
        unit: 'อัน', 
        discountPercent: 5, 
        moq: 2, 
        moqType: 'multiple' 
      });
      
      const set1Id = 'SET001';
      await setDoc(doc(db, `${BASE_PATH}/equipmentSets`, set1Id), { 
        supplierId: s1Id, 
        name: 'ชุดพนักงานเริ่มงาน IT Starter Kit', 
        currency: 'THB', 
        items: [
          { itemId: i1Id, quantity: 1 },
          { itemId: i2Id, quantity: 1 }
        ] 
      });
      
      showAlert("สำเร็จ", "เพิ่มข้อมูลตัวอย่างสำเร็จเรียบร้อย!");
    } catch (e: any) {
      showAlert("เกิดข้อผิดพลาด", "ไม่สามารถสร้างฐานข้อมูลตัวอย่างได้: " + e.message);
    }
  };

  const handleLogout = () => {
    showConfirm("ออกจากระบบ", "คุณต้องการออกจากระบบใช่หรือไม่?", () => {
      setLoggedInEmployee(null);
    });
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-medium font-sans">กำลังเชื่อมต่อระบบ Smart PO Cloud Database...</p>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans">
        <div className="bg-red-550/20 text-red-650 p-4 rounded-full mb-4">
          <Shield size={48} className="text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่สามารถเชื่อมต่อ Cloud ได้</h2>
        <p className="text-slate-600 max-w-md text-sm">การเชื่อมต่อผ่านอินสัญญาล้มเหลว โปรดตรวจสอบการทำงานและอัปเดต Firebase Configuration</p>
      </div>
    );
  }

  // Render employee login screen if not authenticated
  if (!loggedInEmployee) {
    return <AppLoginScreen employees={employees} onLogin={setLoggedInEmployee} />;
  }

  const isAdmin = loggedInEmployee.role === 'admin';

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans print:bg-white text-slate-900 border-t-4 border-indigo-600">
        <aside className="w-full md:w-64 bg-white border-r border-slate-200 flex-shrink-0 shadow-sm print:hidden flex flex-col h-screen overflow-y-auto">
          <div className="p-6 border-b border-slate-100 flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
              <ShoppingCart size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Smart PO</h1>
          </div>
          
          <div className="p-4 border-b border-slate-100 bg-indigo-50/50 flex items-center justify-between">
            <div className="flex flex-col">
              <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1 flex items-center">
                {isAdmin ? <Shield size={12} className="mr-1"/> : <UserCircle size={12} className="mr-1"/>}
                {isAdmin ? 'Administrator' : 'Employee'}
              </div>
              <div className="text-sm font-bold text-indigo-900 truncate max-w-[180px]">{loggedInEmployee.name}</div>
            </div>
          </div>

          <nav className="p-4 space-y-1 flex-1">
            <SidebarButton icon={FileText} label="ใบสั่งซื้อ (POs)" active={activeTab === 'pos' || activeTab === 'po-editor'} onClick={() => { setActiveTab('pos'); setEditingPoId(null); }} />
            <div className="pt-6 pb-2 px-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">ข้อมูลพื้นฐาน</div>
            <SidebarButton icon={Package} label="ชุดอุปกรณ์ (Sets)" active={activeTab === 'sets'} onClick={() => setActiveTab('sets')} />
            <SidebarButton icon={Database} label="รายการสินค้า (Items)" active={activeTab === 'items'} onClick={() => setActiveTab('items')} />
            <SidebarButton icon={Users} label="ซัพพลายเออร์" active={activeTab === 'suppliers'} onClick={() => setActiveTab('suppliers')} />
            
            {isAdmin && (
              <>
                <div className="pt-6 pb-2 px-3 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">ระบบผู้ดูแล (Admin)</div>
                <SidebarButton icon={UserPlus} label="จัดการพนักงาน" active={activeTab === 'employees'} onClick={() => setActiveTab('employees')} customClass="hover:bg-emerald-50 hover:text-emerald-700 data-[active=true]:bg-emerald-600" />
              </>
            )}
          </nav>
          
          <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
            {isAdmin && (
              <>
                <button onClick={recoverOldData} className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center shadow-md shadow-amber-100">
                  <Database size={14} className="mr-2" /> ดึงข้อมูลเก่าระบบเดิมทั้งหมด
                </button>
                <button onClick={seedDatabase} className="w-full py-2 px-4 bg-white hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all border border-slate-200">
                  + ข้อมูลตัวอย่าง (Demo Sets)
                </button>
              </>
            )}
            <button onClick={handleLogout} className="w-full py-2.5 px-4 bg-white border border-red-200 text-red-650 rounded-xl text-xs font-bold hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center shadow-sm">
              <LogOut size={14} className="mr-2" /> ออกจากระบบ
            </button>
          </div>
        </aside>

        <main className="flex-1 overflow-auto print:overflow-visible h-screen relative">
          {activeTab === 'pos' && (
            <POList 
              purchaseOrders={purchaseOrders} 
              onCreateNew={() => { setEditingPoId(null); setActiveTab('po-editor'); }}
              onEdit={(id) => { setEditingPoId(id); setActiveTab('po-editor'); }}
              db={db} basePath={BASE_PATH} showConfirm={showConfirm} suppliers={suppliers}
            />
          )}
          {activeTab === 'po-editor' && (
            <POEditor 
              poId={editingPoId}
              onBack={() => setActiveTab('pos')}
              items={items} equipmentSets={equipmentSets} suppliers={suppliers}
              getSetPrice={getSetPrice} db={db} basePath={BASE_PATH} 
              showAlert={showAlert} exchangeRates={exchangeRates} convertPrice={convertPrice} formatCur={formatCur}
              loggedInEmployee={loggedInEmployee}
            />
          )}
          {activeTab === 'suppliers' && <SupplierMaster suppliers={suppliers} db={db} basePath={BASE_PATH} showConfirm={showConfirm} />}
          {activeTab === 'items' && <ItemMaster items={items} suppliers={suppliers} db={db} basePath={BASE_PATH} showConfirm={showConfirm} showAlert={showAlert} formatCur={formatCur} />}
          {activeTab === 'sets' && <EquipmentSetMaster sets={equipmentSets} items={items} getSetPrice={getSetPrice} db={db} basePath={BASE_PATH} showConfirm={showConfirm} showAlert={showAlert} suppliers={suppliers} convertPrice={convertPrice} formatCur={formatCur} exchangeRates={exchangeRates} />}
          {activeTab === 'employees' && isAdmin && <EmployeeMaster employees={employees} db={db} basePath={BASE_PATH} showConfirm={showConfirm} showAlert={showAlert} />}
        </main>
      </div>
      <CustomModal {...modal} />
    </>
  );
}
