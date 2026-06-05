/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  User, Branch, Category, Product, Supplier, PurchaseOrder,
  InventoryItem, StockMovement, Order, Customer, LoyaltyTransaction,
  Refund, AuditLog, Setting, Role
} from '../src/types';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

interface Schema {
  users: User[];
  branches: Branch[];
  categories: Category[];
  products: Product[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  inventoryItems: InventoryItem[];
  stockMovements: StockMovement[];
  orders: Order[];
  customers: Customer[];
  loyaltyTransactions: LoyaltyTransaction[];
  refunds: Refund[];
  auditLogs: AuditLog[];
  settings: Setting;
}

const defaultSettings: Setting = {
  id: 'setting-1',
  businessName: 'Apex Enterprise POS',
  businessAddress: '100 Tech Avenue, Suite 400, London, EC2A 2BB',
  businessPhone: '+44 20 7496 0122',
  currency: '£', // Base currency symbol
  taxRatePercentage: 20, // 20% VAT/Tax
  receiptFooterMessage: 'Thank you for your business. We appreciate your shopping with us!',
  lowStockAlertEmail: 'manager@apexpos.com',
  enableEmailAlerts: true,
  updatedAt: new Date().toISOString()
};

function getInitialData(): Schema {
  const now = new Date().toISOString();
  
  const initialBranches: Branch[] = [
    { id: 'b1', name: 'London Flagship HQ', code: 'LND-MAIN-01', address: '12 Old Broad St, London', phone: '+44 20 1234 5678', createdAt: now },
    { id: 'b2', name: 'Manchester Northern', code: 'MCR-BRCH-02', address: '45 Piccadilly, Manchester', phone: '+44 161 987 6543', createdAt: now },
    { id: 'b3', name: 'Edinburgh Royal Mile', code: 'EDI-BRCH-03', address: '109 High St, Edinburgh', phone: '+44 131 556 7890', createdAt: now }
  ];

  const initialUsers: User[] = [
    { id: 'u1', email: 'admin@pos.com', name: 'Sarah Jenkins (Admin)', role: 'Admin', branchId: 'b1', isDeactivated: false, createdAt: now },
    { id: 'u2', email: 'manager@pos.com', name: 'Thomas Wright (Manager)', role: 'Manager', branchId: 'b1', isDeactivated: false, createdAt: now },
    { id: 'u3', email: 'cashier@pos.com', name: 'Emily Rose (Cashier)', role: 'Cashier', branchId: 'b1', isDeactivated: false, createdAt: now },
    { id: 'u4', email: 'cashier2@pos.com', name: 'Marcus Sterling (Cashier)', role: 'Cashier', branchId: 'b2', isDeactivated: false, createdAt: now }
  ];

  const initialCategories: Category[] = [
    { id: 'cat1', name: 'Consumer Electronics', description: 'Power adapters, wireless earbuds, smart accessories', createdAt: now },
    { id: 'cat2', name: 'Premium Beverages', description: 'Cold drinks, juices, soda cans and barista coffees', createdAt: now },
    { id: 'cat3', name: 'Fresh Gourmet Grab-and-Go', description: 'Sandwiches, pastries, salads made daily', createdAt: now },
    { id: 'cat4', name: 'Stationery & Giftware', description: 'Premium notebooks, fine write-wear, journals', createdAt: now }
  ];

  const initialProducts: Product[] = [
    { id: 'p1', sku: 'ELE-PWR-USBC', barcode: '5060871140019', name: 'Thunderbolt USB-C 65W Power Hub', categoryId: 'cat1', price: 34.99, costPrice: 14.50, lowStockThreshold: 10, imageUrl: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=150', createdAt: now },
    { id: 'p2', sku: 'ELE-BUD-AURA', barcode: '5060871140026', name: 'Aura Wireless Earbuds Pro', categoryId: 'cat1', price: 79.99, costPrice: 32.00, lowStockThreshold: 5, imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=150', createdAt: now },
    { id: 'p3', sku: 'BEV-COL-330M', barcode: '5060871140033', name: 'Sparkling Artesian Cola 330ml', categoryId: 'cat2', price: 2.20, costPrice: 0.75, lowStockThreshold: 24, imageUrl: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=150', createdAt: now },
    { id: 'p4', sku: 'BEV-ORG-JUIC', barcode: '5060871140040', name: 'Cold-Pressed Valencia Orange 250ml', categoryId: 'cat2', price: 2.80, costPrice: 0.95, lowStockThreshold: 15, imageUrl: 'https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=150', createdAt: now },
    { id: 'p5', sku: 'FD-CLUB-SNDW', barcode: '5060871140057', name: 'Wood-Smoked Deluxe Club Sandwich', categoryId: 'cat3', price: 6.50, costPrice: 2.20, lowStockThreshold: 8, imageUrl: 'https://images.unsplash.com/photo-1539252554453-80ab65ce3586?w=150', createdAt: now },
    { id: 'p6', sku: 'STA-EXC-NOTE', barcode: '5060871140064', name: 'Executive Hardbound Saffiano Grid Notebook', categoryId: 'cat4', price: 12.00, costPrice: 4.80, lowStockThreshold: 12, imageUrl: 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=150', createdAt: now }
  ];

  const initialSuppliers: Supplier[] = [
    { id: 's1', name: 'Apex Logistical Wholesalers', contactName: 'Jonathan Davis', email: 'orders@apexwholesale.co.uk', phone: '+44 20 8945 1109', address: '42 Depot Park, Croydon, CR0 4XX', createdAt: now },
    { id: 's2', name: 'Sustain & Nourish Farms Ltd', contactName: 'Angela Miller', email: 'supply@sustainnourish.co.uk', phone: '+44 141 229 0943', address: 'Oakridge Estate, Cheshire, CH5 9LL', createdAt: now }
  ];

  const initialCustomers: Customer[] = [
    { id: 'c1', name: 'William Vance', email: 'william.vance@gmail.com', phone: '+44 7700 900077', address: '124 Brompton Rd, Knightsbridge, SW3 1JD', loyaltyPointsBalance: 310, createdAt: now },
    { id: 'c2', name: 'Samantha Cole', email: 'sam.cole@icloud.com', phone: '+44 7700 900542', address: '28 Primrose Hill Rd, London, NW3 3AD', loyaltyPointsBalance: 85, createdAt: now },
    { id: 'c3', name: 'Ethan Patel', email: 'ethan.patel@outlook.com', phone: '+44 7700 900122', loyaltyPointsBalance: 12, createdAt: now }
  ];

  // Set up inventory counts: For each (Product, Branch) pair
  const initialInventoryItems: InventoryItem[] = [];
  const initialStockMovements: StockMovement[] = [];
  let itemCounter = 1;
  let movementCounter = 1;

  for (const branch of initialBranches) {
    for (const product of initialProducts) {
      const isLondon = branch.id === 'b1';
      // Vary stocks for realism and alerts
      let stockQuantity = 30;
      if (product.id === 'p1') stockQuantity = isLondon ? 18 : 6; // low on branch 2
      if (product.id === 'p2') stockQuantity = isLondon ? 3 : 12; // alarmingly low on flagship!
      if (product.id === 'p3') stockQuantity = isLondon ? 54 : 40;
      if (product.id === 'p4') stockQuantity = isLondon ? 2 : 18;  // low on flagship
      if (product.id === 'p5') stockQuantity = isLondon ? 9 : 3;   // low on branch 2
      if (product.id === 'p6') stockQuantity = isLondon ? 15 : 20;

      const invId = `inv-${itemCounter++}`;
      initialInventoryItems.push({
        id: invId,
        productId: product.id,
        branchId: branch.id,
        stockQuantity,
        updatedAt: now
      });

      // Stock movement logs
      initialStockMovements.push({
        id: `mov-${movementCounter++}`,
        inventoryItemId: invId,
        type: 'Adjustment_In',
        quantity: stockQuantity,
        reason: 'Initial system load',
        userId: 'u1',
        createdAt: now
      });
    }
  }

  // Pre-seed 3 past orders for rich graphs
  const orderDetails: Order[] = [
    {
      id: 'ord-1001',
      orderNumber: 'ORD-2026-0001',
      branchId: 'b1',
      cashierId: 'u3',
      customerId: 'c1',
      totalBeforeTax: 169.97,
      taxAmount: 33.99,
      discountPercentage: 10,
      discountAmount: 20.40,
      totalAmount: 183.56,
      loyaltyPointsEarned: 18,
      loyaltyPointsRedeemed: 0,
      paymentMethod: 'Card',
      status: 'Completed',
      items: [
        { id: 'item-1', orderId: 'ord-1001', productId: 'p1', quantity: 2, priceAtSale: 34.99, discountAmount: 7.00, subtotal: 62.98 },
        { id: 'item-2', orderId: 'ord-1001', productId: 'p2', quantity: 1, priceAtSale: 79.99, discountAmount: 8.00, subtotal: 71.99 },
        { id: 'item-3', orderId: 'ord-1001', productId: 'p6', quantity: 4, priceAtSale: 12.00, discountAmount: 4.80, subtotal: 43.20 }
      ],
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // yesterday
    },
    {
      id: 'ord-1002',
      orderNumber: 'ORD-2026-0002',
      branchId: 'b1',
      cashierId: 'u3',
      customerId: 'c2',
      totalBeforeTax: 20.40,
      taxAmount: 4.08,
      discountPercentage: 0,
      discountAmount: 0,
      totalAmount: 24.48,
      loyaltyPointsEarned: 2,
      loyaltyPointsRedeemed: 0,
      paymentMethod: 'Cash',
      cashReceived: 30.00,
      changeGiven: 5.52,
      status: 'Completed',
      items: [
        { id: 'item-4', orderId: 'ord-1002', productId: 'p3', quantity: 5, priceAtSale: 2.20, discountAmount: 0, subtotal: 11.00 },
        { id: 'item-5', orderId: 'ord-1002', productId: 'p5', quantity: 1, priceAtSale: 6.50, discountAmount: 0, subtotal: 6.50 },
        { id: 'item-6', orderId: 'ord-1002', productId: 'p4', quantity: 1, priceAtSale: 2.80, discountAmount: 0, subtotal: 2.80 }
      ],
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() // 5 hours ago
    },
    {
      id: 'ord-1003',
      orderNumber: 'ORD-2026-0003',
      branchId: 'b2',
      cashierId: 'u4',
      customerId: undefined,
      totalBeforeTax: 79.99,
      taxAmount: 16.00,
      discountPercentage: 0,
      discountAmount: 0,
      totalAmount: 95.99,
      loyaltyPointsEarned: 0,
      loyaltyPointsRedeemed: 0,
      paymentMethod: 'Card',
      status: 'Completed',
      items: [
        { id: 'item-7', orderId: 'ord-1003', productId: 'p2', quantity: 1, priceAtSale: 79.99, discountAmount: 0, subtotal: 79.99 }
      ],
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
    }
  ];

  // Pre-seed loyalty transaction
  const initialLoyalty: LoyaltyTransaction[] = [
    { id: 'loy-1', customerId: 'c1', orderId: 'ord-1001', points: 18, type: 'Earned', createdAt: now },
    { id: 'loy-2', customerId: 'c2', orderId: 'ord-1002', points: 2, type: 'Earned', createdAt: now }
  ];

  const initialPO: PurchaseOrder[] = [
    {
      id: 'po-1',
      supplierId: 's1',
      branchId: 'b1',
      poNumber: 'PO-2026-0001',
      status: 'Received',
      totalCost: 145.00,
      notes: 'Urgent restocking of power units for holiday season',
      items: [
        { id: 'poi-1', purchaseOrderId: 'po-1', productId: 'p1', quantity: 10, unitCost: 14.50 }
      ],
      orderedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      receivedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];

  const initialAudits: AuditLog[] = [
    { id: 'aud-1', userId: 'u1', action: 'DATABASE_SEED', details: 'Database initialized with demo enterprise datasets', createdAt: now }
  ];

  return {
    users: initialUsers,
    branches: initialBranches,
    categories: initialCategories,
    products: initialProducts,
    suppliers: initialSuppliers,
    purchaseOrders: initialPO,
    inventoryItems: initialInventoryItems,
    stockMovements: initialStockMovements,
    orders: orderDetails,
    customers: initialCustomers,
    loyaltyTransactions: initialLoyalty,
    refunds: [],
    auditLogs: initialAudits,
    settings: defaultSettings
  };
}

class DatabaseService {
  private cache: Schema;

  constructor() {
    this.cache = this.init();
  }

  private init(): Schema {
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(raw);
      } catch (e) {
        console.error('Error parsing JSON database, recreating default data', e);
        const data = getInitialData();
        this.save(data);
        return data;
      }
    } else {
      const data = getInitialData();
      this.save(data);
      return data;
    }
  }

  private save(data: Schema) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  public forceSync() {
    this.save(this.cache);
  }

  // Generic Getters
  public getUsers(): User[] { return this.cache.users; }
  public getBranches(): Branch[] { return this.cache.branches; }
  public getCategories(): Category[] { return this.cache.categories; }
  public getProducts(): Product[] { return this.cache.products; }
  public getSuppliers(): Supplier[] { return this.cache.suppliers; }
  public getPurchaseOrders(): PurchaseOrder[] { return this.cache.purchaseOrders; }
  public getInventory(): InventoryItem[] { return this.cache.inventoryItems; }
  public getMovements(): StockMovement[] { return this.cache.stockMovements; }
  public getOrders(): Order[] { return this.cache.orders; }
  public getCustomers(): Customer[] { return this.cache.customers; }
  public getLoyalty(): LoyaltyTransaction[] { return this.cache.loyaltyTransactions; }
  public getRefunds(): Refund[] { return this.cache.refunds; }
  public getAuditLogs(): AuditLog[] { return this.cache.auditLogs; }
  public getSettings(): Setting { return this.cache.settings; }

  // Add methods
  public addUser(user: User) { this.cache.users.push(user); this.forceSync(); }
  public addBranch(branch: Branch) { this.cache.branches.push(branch); this.forceSync(); }
  public addCategory(cat: Category) { this.cache.categories.push(cat); this.forceSync(); }
  public addProduct(p: Product) { this.cache.products.push(p); this.forceSync(); }
  public addSupplier(s: Supplier) { this.cache.suppliers.push(s); this.forceSync(); }
  public addPO(po: PurchaseOrder) { this.cache.purchaseOrders.push(po); this.forceSync(); }
  public addInventoryItem(item: InventoryItem) { this.cache.inventoryItems.push(item); this.forceSync(); }
  public addMovement(mov: StockMovement) { this.cache.stockMovements.push(mov); this.forceSync(); }
  public addOrder(o: Order) { this.cache.orders.push(o); this.forceSync(); }
  public addCustomer(c: Customer) { this.cache.customers.push(c); this.forceSync(); }
  public addLoyaltyTx(tx: LoyaltyTransaction) { this.cache.loyaltyTransactions.push(tx); this.forceSync(); }
  public addRefund(r: Refund) { this.cache.refunds.push(r); this.forceSync(); }
  public addAuditLog(log: AuditLog) { this.cache.auditLogs.unshift(log); this.forceSync(); }

  // Update methods
  public updateSettings(settings: Partial<Setting>) {
    this.cache.settings = { ...this.cache.settings, ...settings, updatedAt: new Date().toISOString() };
    this.forceSync();
  }

  public updateUser(userId: string, update: Partial<User>) {
    this.cache.users = this.cache.users.map(u => u.id === userId ? { ...u, ...update } as User : u);
    this.forceSync();
  }

  public updateProduct(productId: string, update: Partial<Product>) {
    this.cache.products = this.cache.products.map(p => p.id === productId ? { ...p, ...update } as Product : p);
    this.forceSync();
  }

  public updateCategory(catId: string, update: Partial<Category>) {
    this.cache.categories = this.cache.categories.map(c => c.id === catId ? { ...c, ...update } as Category : c);
    this.forceSync();
  }

  public updateSupplier(supplierId: string, update: Partial<Supplier>) {
    this.cache.suppliers = this.cache.suppliers.map(s => s.id === supplierId ? { ...s, ...update } as Supplier : s);
    this.forceSync();
  }

  public updateCustomer(custId: string, update: Partial<Customer>) {
    this.cache.customers = this.cache.customers.map(c => c.id === custId ? { ...c, ...update } as Customer : c);
    this.forceSync();
  }

  public updateInventoryQuantity(productId: string, branchId: string, change: number): InventoryItem {
    let item = this.cache.inventoryItems.find(i => i.productId === productId && i.branchId === branchId);
    const now = new Date().toISOString();
    if (!item) {
      item = {
        id: `inv-${crypto.randomUUID()}`,
        productId,
        branchId,
        stockQuantity: 0,
        updatedAt: now
      };
      this.cache.inventoryItems.push(item);
    }
    item.stockQuantity += change;
    item.updatedAt = now;
    this.forceSync();
    return item;
  }

  public updatePO(po: PurchaseOrder) {
    this.cache.purchaseOrders = this.cache.purchaseOrders.map(p => p.id === po.id ? po : p);
    this.forceSync();
  }

  public updateOrder(order: Order) {
    this.cache.orders = this.cache.orders.map(o => o.id === order.id ? order : o);
    this.forceSync();
  }

  // Deletion methods
  public deleteProduct(id: string) {
    this.cache.products = this.cache.products.filter(p => p.id !== id);
    this.cache.inventoryItems = this.cache.inventoryItems.filter(i => i.productId !== id);
    this.forceSync();
  }

  public deleteCategory(id: string) {
    this.cache.categories = this.cache.categories.filter(c => c.id !== id);
    // Unassign category from matching products (change categoryId or set dummy)
    this.forceSync();
  }

  public deleteSupplier(id: string) {
    this.cache.suppliers = this.cache.suppliers.filter(s => s.id !== id);
    this.forceSync();
  }

  public deleteCustomer(id: string) {
    this.cache.customers = this.cache.customers.filter(c => c.id !== id);
    this.forceSync();
  }
}

export const db = new DatabaseService();
export default db;
