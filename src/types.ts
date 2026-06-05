/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'Admin' | 'Manager' | 'Cashier';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  branchId: string;
  isDeactivated: boolean;
  createdAt: string;
}

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  description?: string;
  categoryId: string;
  price: number;
  costPrice: number;
  lowStockThreshold: number;
  imageUrl?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitCost: number;
}

export type PurchaseOrderStatus = 'Pending' | 'Ordered' | 'Received' | 'Cancelled';

export interface PurchaseOrder {
  id: string;
  supplierId: string;
  branchId: string;
  poNumber: string;
  status: PurchaseOrderStatus;
  items: PurchaseOrderItem[];
  totalCost: number;
  notes?: string;
  orderedAt?: string;
  receivedAt?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  productId: string;
  branchId: string;
  stockQuantity: number;
  updatedAt: string;
}

export type StockMovementType = 'Adjustment_In' | 'Adjustment_Out' | 'Transfer_In' | 'Transfer_Out' | 'Sale' | 'Refund' | 'PO_Received';

export interface StockMovement {
  id: string;
  inventoryItemId: string;
  type: StockMovementType;
  quantity: number; // positive or negative
  reason: string;
  userId: string;
  createdAt: string;
}

export type OrderStatus = 'Completed' | 'Refunded' | 'OnHold';

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  subtotal: number;
  priceAtSale: number;
  discountAmount: number; // per-item discount applied
}

export interface Order {
  id: string;
  orderNumber: string;
  branchId: string;
  cashierId: string;
  customerId?: string;
  totalBeforeTax: number;
  taxAmount: number;
  discountPercentage: number;
  discountAmount: number;
  totalAmount: number;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  paymentMethod: 'Cash' | 'Card' | 'Split';
  cashReceived?: number;
  changeGiven?: number;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address?: string;
  loyaltyPointsBalance: number;
  createdAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  orderId?: string;
  points: number; // Positive for earned, negative for redeemed
  type: 'Earned' | 'Redeemed' | 'Adjusted';
  createdAt: string;
}

export interface Refund {
  id: string;
  orderId: string;
  reason: string;
  processedByUserId: string;
  refundedAmount: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: string;
  ipAddress?: string;
  createdAt: string;
}

export interface Setting {
  id: string;
  businessName: string;
  businessAddress: string;
  businessPhone: string;
  logoUrl?: string;
  currency: string;
  taxRatePercentage: number;
  receiptFooterMessage: string;
  lowStockAlertEmail: string;
  enableEmailAlerts: boolean;
  updatedAt: string;
}

// For state management transfers
export interface BriefProduct extends Product {
  categoryName?: string;
  stockInSelectedBranch?: number;
}
