import { Firestore } from 'firebase/firestore';

export interface Employee {
  id: string;
  username: string;
  name: string;
  password?: string;
  role: 'admin' | 'employee';
  createdAt?: any;
}

export interface Supplier {
  id: string;
  brandName: string;
  companyName: string;
  address?: string;
  branch?: string;
  taxId?: string;
}

export interface Item {
  id: string;
  supplierId: string;
  code: string;
  category: string;
  itemName: string;
  pricePerUnit: number;
  currency: string;
  unit: string;
  discountPercent: number;
  moq: number;
  moqType: 'minimum' | 'multiple';
}

export interface OrderLine {
  type: 'item' | 'set';
  refId: string;
  quantity: number;
}

export interface PurchaseOrder {
  id: string;
  title: string;
  supplierId: string;
  orderLines: OrderLine[];
  sets?: any[]; // For backwards-compatibility query fallback
  totalAmount: number;
  currency: string;
  exchangeRates: Record<string, number>;
  createdBy: string;
  createdAt?: any;
}

export interface EquipmentSetItem {
  itemId: string;
  quantity: number;
}

export interface EquipmentSet {
  id: string;
  supplierId: string;
  name: string;
  currency?: string;
  items: EquipmentSetItem[];
}

export interface CustomModalProps {
  isOpen: boolean;
  type: 'confirm' | 'alert';
  title: string;
  message: string;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}
