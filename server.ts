/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import db from './server/db.ts';
import {
  User, Product, Category, Customer, Supplier, Order,
  PurchaseOrder, StockMovement, Refund, Setting, AuditLog, Role, OrderItem
} from './src/types.ts';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'APEX-POS-ENTERPRISE-SECRET-9988';

app.use(express.json({ limit: '10mb' }));

// Set up SSE clients tracking
let sseClients: any[] = [];

// SSE Event Broadcast helper
function broadcastEvent(type: string, data: any) {
  sseClients.forEach(client => {
    client.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  });
}

// REST Middleware for Authorization check
const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: Role; branchId: string };
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Forbidden: Invalid metadata credentials' });
  }
};

// Check specific Role middleware
const roleCheck = (allowedRoles: Role[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient role permissions' });
    }
    next();
  };
};

// --- AUTHENTICATION ENDPOINTS ---
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Quick lookup
  const user = db.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user || user.isDeactivated) {
    return res.status(401).json({ error: 'Invalid or deactivated staff credentials' });
  }

  // Accept simple defaults corresponding to roles
  const validPass = password === 'admin123' || password === 'manager123' || password === 'cashier123';
  if (!validPass) {
    return res.status(401).json({ error: 'Incorrect credentials provided' });
  }

  // Issue Token
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, branchId: user.branchId },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: user.id,
    action: 'USER_LOGIN',
    details: `User logged in successfully from branchId: ${user.branchId}`,
    createdAt: new Date().toISOString()
  });

  return res.json({ token, user });
});

app.get('/api/auth/me', authMiddleware, (req: any, res) => {
  const user = db.getUsers().find(u => u.id === req.user.userId);
  if (!user || user.isDeactivated) {
    return res.status(404).json({ error: 'User does not exist or has been disabled' });
  }
  return res.json({ user });
});

// --- REAL-TIME EVENTS SUBSCRIPTION CHANNEL ---
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);
  
  // Initial ping
  res.write(`data: ${JSON.stringify({ status: 'connected' })}\n\n`);

  req.on('close', () => {
    sseClients = sseClients.filter(client => client !== res);
  });
});

// --- DASHBOARD ANALYTICS ---
app.get('/api/dashboard/stats', authMiddleware, (req: any, res) => {
  const { branchId } = req.user;
  const orders = db.getOrders();
  const products = db.getProducts();
  const inventory = db.getInventory();
  
  // Filter by branch if Cashier/Manager, or Admin selects specific
  const selectedBranch = req.query.branchId || branchId;
  const isAll = selectedBranch === 'ALL';

  const branchOrders = orders.filter(o => (isAll || o.branchId === selectedBranch) && o.status !== 'Refunded');
  
  // Sales computations
  let todaySales = 0;
  let todayRevenue = 0;
  const todayStr = new Date().toISOString().split('T')[0];

  branchOrders.forEach(o => {
    if (o.createdAt.startsWith(todayStr)) {
      todaySales += o.totalAmount;
      // Revenue is price - cost
      o.items.forEach(it => {
        const prod = products.find(p => p.id === it.productId);
        if (prod) {
          const c = prod.costPrice * it.quantity;
          todayRevenue += (it.subtotal - c);
        }
      });
    }
  });

  // Calculate Low Stock alarms
  const alerts: any[] = [];
  products.forEach(p => {
    const branchInv = inventory.filter(i => p.id === i.productId && (isAll || i.branchId === selectedBranch));
    const totalStock = branchInv.reduce((sum, item) => sum + item.stockQuantity, 0);
    
    if (totalStock <= p.lowStockThreshold) {
      alerts.push({
        productId: p.id,
        name: p.name,
        sku: p.sku,
        stock: totalStock,
        threshold: p.lowStockThreshold
      });
    }
  });

  // Top Selling products calculation
  const salesMap: Record<string, { quantity: number; amount: number; name: string }> = {};
  branchOrders.forEach(o => {
    o.items.forEach(it => {
      const prod = products.find(p => p.id === it.productId);
      if (prod) {
        if (!salesMap[prod.id]) {
          salesMap[prod.id] = { quantity: 0, amount: 0, name: prod.name };
        }
        salesMap[prod.id].quantity += it.quantity;
        salesMap[prod.id].amount += it.subtotal;
      }
    });
  });

  const topSelling = Object.values(salesMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const recentOrders = branchOrders
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)
    .map(o => ({
      ...o,
      customerName: db.getCustomers().find(c => c.id === o.customerId)?.name || 'Guest Customer',
      cashierName: db.getUsers().find(u => u.id === o.cashierId)?.name || 'Staff'
    }));

  return res.json({
    todaySales: parseFloat(todaySales.toFixed(2)),
    todayTransactionsCount: branchOrders.filter(o => o.createdAt.startsWith(todayStr)).length,
    todayRevenue: parseFloat(todayRevenue.toFixed(2)),
    lowStockCount: alerts.length,
    lowStockAlerts: alerts.slice(0, 6),
    topSelling,
    recentOrders
  });
});

// --- PRODUCTS MANAGEMENT ---
app.get('/api/products', authMiddleware, (req, res) => {
  const products = db.getProducts();
  const categories = db.getCategories();
  const inventory = db.getInventory();

  const enriched = products.map(p => {
    const cat = categories.find(c => c.id === p.categoryId);
    const itemInv = inventory.filter(inv => inv.productId === p.id);
    const totalStock = itemInv.reduce((sum, item) => sum + item.stockQuantity, 0);
    return {
      ...p,
      categoryName: cat ? cat.name : 'Uncategorized',
      stockInSelectedBranch: totalStock,
      branchStocks: itemInv.reduce((acc, item) => {
        acc[item.branchId] = item.stockQuantity;
        return acc;
      }, {} as Record<string, number>)
    };
  });

  return res.json(enriched);
});

app.post('/api/products', authMiddleware, roleCheck(['Admin', 'Manager']), (req: any, res) => {
  const { name, sku, barcode, categoryId, price, costPrice, lowStockThreshold, imageUrl, description, initialBranchStocks } = req.body;
  if (!name || !sku || !barcode || !categoryId || price === undefined || costPrice === undefined) {
    return res.status(400).json({ error: 'Missing compulsory product fields' });
  }

  // Duplicate check
  const existing = db.getProducts().find(p => p.sku === sku || p.barcode === barcode);
  if (existing) {
    return res.status(400).json({ error: 'Product SKU or Barcode already exists' });
  }

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    name, sku, barcode, categoryId,
    price: parseFloat(price),
    costPrice: parseFloat(costPrice),
    lowStockThreshold: parseInt(lowStockThreshold || '5'),
    imageUrl, description,
    createdAt: new Date().toISOString()
  };

  db.addProduct(newProduct);

  // Initialize stock configurations per branch
  const branches = db.getBranches();
  branches.forEach(br => {
    const qty = initialBranchStocks && initialBranchStocks[br.id] !== undefined ? parseInt(initialBranchStocks[br.id]) : 0;
    db.updateInventoryQuantity(newProduct.id, br.id, qty);
    
    // Add movement tracking
    if (qty > 0) {
      const invRow = db.getInventory().find(i => i.productId === newProduct.id && i.branchId === br.id);
      if (invRow) {
        db.addMovement({
          id: `mov-${Date.now()}-${br.id}`,
          inventoryItemId: invRow.id,
          type: 'Adjustment_In',
          quantity: qty,
          reason: 'Initial items creation stock entry',
          userId: req.user.userId,
          createdAt: new Date().toISOString()
        });
      }
    }
  });

  // Log Audit
  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'CREATE_PRODUCT',
    details: `Created product "${name}" SKU: ${sku}`,
    createdAt: new Date().toISOString()
  });

  return res.status(211).json(newProduct);
});

app.put('/api/products/:id', authMiddleware, roleCheck(['Admin', 'Manager']), (req: any, res) => {
  const { id } = req.params;
  const updates = req.body;

  const product = db.getProducts().find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Handle floats cleanly
  if (updates.price !== undefined) updates.price = parseFloat(updates.price);
  if (updates.costPrice !== undefined) updates.costPrice = parseFloat(updates.costPrice);
  if (updates.lowStockThreshold !== undefined) updates.lowStockThreshold = parseInt(updates.lowStockThreshold);

  db.updateProduct(id, updates);

  // Audit Logs
  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'UPDATE_PRODUCT',
    details: `Updated product "${product.name}" modifications`,
    createdAt: new Date().toISOString()
  });

  return res.json({ success: true, product: { ...product, ...updates } });
});

app.delete('/api/products/:id', authMiddleware, roleCheck(['Admin']), (req: any, res) => {
  const { id } = req.params;
  const product = db.getProducts().find(p => p.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  db.deleteProduct(id);

  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'DELETE_PRODUCT',
    details: `Removed product "${product.name}" SKU: ${product.sku}`,
    createdAt: new Date().toISOString()
  });

  return res.json({ success: true, message: 'Product deleted successfully' });
});

// CSV Bulk import API
app.post('/api/products/bulk-import', authMiddleware, roleCheck(['Admin', 'Manager']), (req: any, res) => {
  const { csvText } = req.body;
  if (!csvText) {
    return res.status(400).json({ error: 'Missing CSV metadata strings' });
  }

  const lines = csvText.trim().split('\n');
  if (lines.length <= 1) {
    return res.status(400).json({ error: 'CSV file contains no records content' });
  }

  // Expect layout: name,sku,barcode,categoryId,price,costPrice,lowStockThreshold,description
  const imported: Product[] = [];
  const now = new Date().toISOString();
  let addedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''));
    if (cells.length < 6) continue;

    const [name, sku, barcode, categoryId, priceStr, costPriceStr, thresholdStr, desc] = cells;
    
    // Duplicate check
    const duplicate = db.getProducts().find(p => p.sku === sku || p.barcode === barcode);
    if (duplicate) continue;

    const newF: Product = {
      id: `prod-${Date.now()}-${i}`,
      name,
      sku,
      barcode,
      categoryId: categoryId || 'cat1',
      price: parseFloat(priceStr || '0'),
      costPrice: parseFloat(costPriceStr || '0'),
      lowStockThreshold: parseInt(thresholdStr || '5'),
      description: desc || '',
      createdAt: now
    };
    db.addProduct(newF);
    
    // Add default inventories
    db.getBranches().forEach(br => {
      db.updateInventoryQuantity(newF.id, br.id, 10); // Standard initial default batch stock 10
    });

    imported.push(newF);
    addedCount++;
  }

  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'BULK_IMPORT',
    details: `Imported ${addedCount} products successfully via CSV`,
    createdAt: now
  });

  return res.json({ success: true, count: addedCount, products: imported });
});


// --- CATEGORIES MANAGEMENT ---
app.get('/api/categories', authMiddleware, (req, res) => {
  return res.json(db.getCategories());
});

app.post('/api/categories', authMiddleware, roleCheck(['Admin', 'Manager']), (req: any, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Category name is required' });

  const newCat: Category = {
    id: `cat-${Date.now()}`,
    name,
    description: description || '',
    createdAt: new Date().toISOString()
  };
  db.addCategory(newCat);
  return res.json(newCat);
});

app.put('/api/categories/:id', authMiddleware, roleCheck(['Admin', 'Manager']), (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  db.updateCategory(id, { name, description });
  return res.json({ success: true });
});

app.delete('/api/categories/:id', authMiddleware, roleCheck(['Admin']), (req, res) => {
  const { id } = req.params;
  db.deleteCategory(id);
  return res.json({ success: true });
});


// --- INVENTORY MANAGEMENT ---
app.get('/api/inventory/status', authMiddleware, (req, res) => {
  const inventory = db.getInventory();
  const products = db.getProducts();
  const branches = db.getBranches();

  const data = inventory.map(item => {
    const prod = products.find(p => p.id === item.productId);
    const br = branches.find(b => b.id === item.branchId);
    return {
      ...item,
      productName: prod ? prod.name : 'Unknown Product',
      sku: prod ? prod.sku : '',
      barcode: prod ? prod.barcode : '',
      threshold: prod ? prod.lowStockThreshold : 0,
      branchName: br ? br.name : 'Unknown Branch',
      isLowStock: prod ? item.stockQuantity <= prod.lowStockThreshold : false
    };
  });
  return res.json(data);
});

app.post('/api/inventory/adjust', authMiddleware, roleCheck(['Admin', 'Manager']), (req: any, res) => {
  const { productId, branchId, quantityChange, reason } = req.body;
  if (!productId || !branchId || quantityChange === undefined || !reason) {
    return res.status(400).json({ error: 'Missing compulsory adjustments details' });
  }

  const updatedInv = db.updateInventoryQuantity(productId, branchId, parseInt(quantityChange));
  
  // Log stock movement
  const mov: StockMovement = {
    id: `mov-${Date.now()}`,
    inventoryItemId: updatedInv.id,
    type: quantityChange >= 0 ? 'Adjustment_In' : 'Adjustment_Out',
    quantity: parseInt(quantityChange),
    reason,
    userId: req.user.userId,
    createdAt: new Date().toISOString()
  };
  db.addMovement(mov);

  // SSE broadcast real-time stock adjustment
  const prodObj = db.getProducts().find(p => p.id === productId);
  broadcastEvent('stock:updated', { productId, branchId, currentStock: updatedInv.stockQuantity });

  if (prodObj && updatedInv.stockQuantity <= prodObj.lowStockThreshold) {
    broadcastEvent('alert:lowstock', {
      productId,
      name: prodObj.name,
      stock: updatedInv.stockQuantity,
      branchId
    });
  }

  // Log Audit
  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'ADJUST_STOCK',
    details: `Adjusted product stock: ${prodObj?.name || productId} in branch ${branchId} by ${quantityChange} units`,
    createdAt: new Date().toISOString()
  });

  return res.json({ success: true, currentStock: updatedInv.stockQuantity });
});

app.post('/api/inventory/transfer', authMiddleware, roleCheck(['Admin', 'Manager']), (req: any, res) => {
  const { productId, fromBranchId, toBranchId, quantity } = req.body;
  const qty = parseInt(quantity);
  if (!productId || !fromBranchId || !toBranchId || !qty || qty <= 0) {
    return res.status(400).json({ error: 'Invalid parameters for inventory branch transfer' });
  }

  const fromInv = db.getInventory().find(i => i.productId === productId && i.branchId === fromBranchId);
  if (!fromInv || fromInv.stockQuantity < qty) {
    return res.status(400).json({ error: 'Insufficient stock in the forwarding source branch' });
  }

  // Process transfer adjustments
  const updatedFrom = db.updateInventoryQuantity(productId, fromBranchId, -qty);
  const updatedTo = db.updateInventoryQuantity(productId, toBranchId, qty);

  // Movements log
  db.addMovement({
    id: `mov-${Date.now()}-out`,
    inventoryItemId: fromInv.id,
    type: 'Transfer_Out',
    quantity: -qty,
    reason: `Branch stock transfer to ${toBranchId}`,
    userId: req.user.userId,
    createdAt: new Date().toISOString()
  });

  const targetInv = db.getInventory().find(i => i.productId === productId && i.branchId === toBranchId);
  if (targetInv) {
    db.addMovement({
      id: `mov-${Date.now()}-in`,
      inventoryItemId: targetInv.id,
      type: 'Transfer_In',
      quantity: qty,
      reason: `Branch stock transfer from ${fromBranchId}`,
      userId: req.user.userId,
      createdAt: new Date().toISOString()
    });
  }

  broadcastEvent('stock:updated', { productId, branchId: fromBranchId, currentStock: updatedFrom.stockQuantity });
  broadcastEvent('stock:updated', { productId, branchId: toBranchId, currentStock: updatedTo.stockQuantity });

  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'STOCK_TRANSFER',
    details: `Transferred ${qty} units of Product ${productId} from branch ${fromBranchId} to ${toBranchId}`,
    createdAt: new Date().toISOString()
  });

  return res.json({ success: true, fromStock: updatedFrom.stockQuantity, toStock: updatedTo.stockQuantity });
});

app.get('/api/inventory/movements', authMiddleware, (req, res) => {
  const movements = db.getMovements();
  const inventory = db.getInventory();
  const products = db.getProducts();
  const branches = db.getBranches();
  const users = db.getUsers();

  const enriched = movements.map(mov => {
    const inv = inventory.find(i => i.id === mov.inventoryItemId);
    const prod = inv ? products.find(p => p.id === inv.productId) : null;
    const br = inv ? branches.find(b => b.id === inv.branchId) : null;
    const usr = users.find(u => u.id === mov.userId);

    return {
      ...mov,
      productName: prod ? prod.name : 'Unknown Product',
      sku: prod ? prod.sku : '',
      branchName: br ? br.name : 'Unknown Branch',
      userName: usr ? usr.name : 'System staff'
    };
  });

  return res.json(enriched);
});


// --- POINT OF SALE (CHECKOUT POS) ---
app.post('/api/pos/checkout', authMiddleware, (req: any, res) => {
  const {
    customerId,
    items, // array of { productId, quantity, appliedDiscountPercentage }
    discountPercentage,
    paymentMethod,
    cashReceived,
    changeGiven
  } = req.body;

  const activeBranch = req.user.branchId;
  const products = db.getProducts();
  
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Checkout cart is empty' });
  }

  // Validate stock quantities first
  const invItems = db.getInventory();
  for (const item of items) {
    const currentInv = invItems.find(i => i.productId === item.productId && i.branchId === activeBranch);
    if (!currentInv || currentInv.stockQuantity < item.quantity) {
      const pName = products.find(p => p.id === item.productId)?.name || 'Product';
      return res.status(400).json({ error: `Insufficient stock for SKU/product "${pName}". Only ${currentInv?.stockQuantity || 0} left in this branch.` });
    }
  }

  // Calculate pricing elements
  let subtotalSum = 0;
  let linesAccumulator: OrderItem[] = [];
  const settings = db.getSettings();

  items.forEach((cartItem: any) => {
    const prod = products.find(p => p.id === cartItem.productId);
    if (prod) {
      const lineCost = prod.price * cartItem.quantity;
      const discountVal = (cartItem.appliedDiscountPercentage || 0) / 100 * lineCost;
      const lineTotal = lineCost - discountVal;

      linesAccumulator.push({
        id: `oi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderId: '', // Filled below
        productId: prod.id,
        quantity: cartItem.quantity,
        priceAtSale: prod.price,
        discountAmount: parseFloat(discountVal.toFixed(2)),
        subtotal: parseFloat(lineTotal.toFixed(2))
      });

      subtotalSum += lineTotal;
    }
  });

  const docDiscount = (discountPercentage || 0) / 100 * subtotalSum;
  const remainingBeforeTax = subtotalSum - docDiscount;
  const computedTax = remainingBeforeTax * (settings.taxRatePercentage / 100);
  const totalCompleted = remainingBeforeTax + computedTax;

  // Set up Loyalty System
  let loyaltyPointsEarned = Math.floor(remainingBeforeTax / 10); // Standard point per £10 spent
  let loyaltyPointsToRedeem = 0;

  if (customerId) {
    const customer = db.getCustomers().find(c => c.id === customerId);
    if (customer) {
      // Awarding steps
      db.updateCustomer(customerId, {
        loyaltyPointsBalance: customer.loyaltyPointsBalance + loyaltyPointsEarned
      });
      db.addLoyaltyTx({
        id: `loy-${Date.now()}-e`,
        customerId,
        points: loyaltyPointsEarned,
        type: 'Earned',
        createdAt: new Date().toISOString()
      });
    }
  }

  const orderId = `ord-${Date.now()}`;
  const transactionNumber = `ORD-TX-${Date.now().toString().slice(-6)}`;

  const newOrder: Order = {
    id: orderId,
    orderNumber: transactionNumber,
    branchId: activeBranch,
    cashierId: req.user.userId,
    customerId,
    totalBeforeTax: parseFloat(remainingBeforeTax.toFixed(2)),
    taxAmount: parseFloat(computedTax.toFixed(2)),
    discountPercentage: discountPercentage || 0,
    discountAmount: parseFloat(docDiscount.toFixed(2)),
    totalAmount: parseFloat(totalCompleted.toFixed(2)),
    loyaltyPointsEarned,
    loyaltyPointsRedeemed: loyaltyPointsToRedeem,
    paymentMethod,
    cashReceived: cashReceived ? parseFloat(cashReceived) : undefined,
    changeGiven: changeGiven ? parseFloat(changeGiven) : undefined,
    status: 'Completed',
    items: linesAccumulator.map(it => ({ ...it, orderId })),
    createdAt: new Date().toISOString()
  };

  db.addOrder(newOrder);

  // Deduct actual products inventory counts
  items.forEach((cartItem: any) => {
    const updatedInv = db.updateInventoryQuantity(cartItem.productId, activeBranch, -cartItem.quantity);
    
    // Log stock movement
    db.addMovement({
      id: `mov-${Date.now()}-${cartItem.productId}`,
      inventoryItemId: updatedInv.id,
      type: 'Sale',
      quantity: -cartItem.quantity,
      reason: `Point of sale transaction order ${transactionNumber}`,
      userId: req.user.userId,
      createdAt: new Date().toISOString()
    });

    const prodObj = products.find(p => p.id === cartItem.productId);
    broadcastEvent('stock:updated', { productId: cartItem.productId, branchId: activeBranch, currentStock: updatedInv.stockQuantity });

    if (prodObj && updatedInv.stockQuantity <= prodObj.lowStockThreshold) {
      broadcastEvent('alert:lowstock', {
        productId: cartItem.productId,
        name: prodObj.name,
        stock: updatedInv.stockQuantity,
        branchId: activeBranch
      });
    }
  });

  // Notify clients
  broadcastEvent('order:created', {
    orderNumber: transactionNumber,
    totalAmount: newOrder.totalAmount,
    branchId: activeBranch,
    cashierName: db.getUsers().find(u => u.id === req.user.userId)?.name || 'Cashier'
  });

  // Audit Log
  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'CREATE_SALE',
    details: `Processed retail order ${transactionNumber} totaling ${settings.currency}${newOrder.totalAmount}`,
    createdAt: new Date().toISOString()
  });

  return res.json({ success: true, order: newOrder });
});


// --- HISTORICAL ORDERS ---
app.get('/api/orders', authMiddleware, (req, res) => {
  const orders = db.getOrders();
  const customers = db.getCustomers();
  const users = db.getUsers();
  const branches = db.getBranches();

  const data = orders.map(o => ({
    ...o,
    customerName: customers.find(c => c.id === o.customerId)?.name || 'Guest Customer',
    cashierName: users.find(u => u.id === o.cashierId)?.name || 'Cashier',
    branchName: branches.find(b => b.id === o.branchId)?.name || 'Branch'
  }));

  return res.json(data);
});

app.post('/api/orders/:id/void', authMiddleware, roleCheck(['Admin', 'Manager']), (req: any, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  
  if (!reason) {
    return res.status(400).json({ error: 'A valid reason for reversal must be provided' });
  }

  const order = db.getOrders().find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order transaction file not found' });
  }

  if (order.status === 'Refunded') {
    return res.status(400).json({ error: 'Order transaction is already voided' });
  }

  // Update order status
  order.status = 'Refunded';
  db.updateOrder(order);

  // Reverse inventory items
  const products = db.getProducts();
  order.items.forEach(it => {
    const updatedInv = db.updateInventoryQuantity(it.productId, order.branchId, it.quantity);
    
    db.addMovement({
      id: `mov-${Date.now()}-void-${it.productId}`,
      inventoryItemId: updatedInv.id,
      type: 'Refund',
      quantity: it.quantity,
      reason: `Void / Refund of transaction ${order.orderNumber}. Reason: ${reason}`,
      userId: req.user.userId,
      createdAt: new Date().toISOString()
    });

    broadcastEvent('stock:updated', { productId: it.productId, branchId: order.branchId, currentStock: updatedInv.stockQuantity });
  });

  // Deduct customer points if applicable
  if (order.customerId && order.loyaltyPointsEarned > 0) {
    const cust = db.getCustomers().find(c => c.id === order.customerId);
    if (cust) {
      db.updateCustomer(order.customerId, {
        loyaltyPointsBalance: Math.max(0, cust.loyaltyPointsBalance - order.loyaltyPointsEarned)
      });
      db.addLoyaltyTx({
        id: `loy-${Date.now()}-refund`,
        customerId: order.customerId,
        points: -order.loyaltyPointsEarned,
        type: 'Adjusted',
        createdAt: new Date().toISOString()
      });
    }
  }

  // Log refund model record
  db.addRefund({
    id: `ref-${Date.now()}`,
    orderId: id,
    reason,
    processedByUserId: req.user.userId,
    refundedAmount: order.totalAmount,
    createdAt: new Date().toISOString()
  });

  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'VOID_ORDER',
    details: `Voided order ${order.orderNumber} with full stock reversal. Reason: ${reason}`,
    createdAt: new Date().toISOString()
  });

  return res.json({ success: true, message: 'Transaction fully refunded and inventories restored.' });
});


// --- CUSTOMERS CRUD MODULE ---
app.get('/api/customers', authMiddleware, (req, res) => {
  return res.json(db.getCustomers());
});

app.post('/api/customers', authMiddleware, (req, res) => {
  const { name, email, phone, address } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'Name and phone numbers are compulsory' });

  const customObj: Customer = {
    id: `cust-${Date.now()}`,
    name, email: email || '', phone, address,
    loyaltyPointsBalance: 0,
    createdAt: new Date().toISOString()
  };
  db.addCustomer(customObj);
  return res.json(customObj);
});

app.put('/api/customers/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  db.updateCustomer(id, req.body);
  return res.json({ success: true });
});

app.delete('/api/customers/:id', authMiddleware, roleCheck(['Admin', 'Manager']), (req, res) => {
  const { id } = req.params;
  db.deleteCustomer(id);
  return res.json({ success: true });
});


// --- SUPPLIERS & PURCHASE ORDERS ---
app.get('/api/suppliers', authMiddleware, (req, res) => {
  return res.json(db.getSuppliers());
});

app.post('/api/suppliers', authMiddleware, roleCheck(['Admin', 'Manager']), (req, res) => {
  const { name, contactName, email, phone, address } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Supplier company name and email are mandatory' });

  const sup: Supplier = {
    id: `sup-${Date.now()}`,
    name, contactName: contactName || '', email, phone: phone || '', address: address || '',
    createdAt: new Date().toISOString()
  };
  db.addSupplier(sup);
  return res.json(sup);
});

app.put('/api/suppliers/:id', authMiddleware, roleCheck(['Admin', 'Manager']), (req, res) => {
  const { id } = req.params;
  db.updateSupplier(id, req.body);
  return res.json({ success: true });
});

app.delete('/api/suppliers/:id', authMiddleware, roleCheck(['Admin']), (req, res) => {
  const { id } = req.params;
  db.deleteSupplier(id);
  return res.json({ success: true });
});

// Purchase orders APIs
app.get('/api/purchase-orders', authMiddleware, (req, res) => {
  const pos = db.getPurchaseOrders();
  const suppliers = db.getSuppliers();
  const branches = db.getBranches();

  const enriched = pos.map(p => ({
    ...p,
    supplierName: suppliers.find(s => s.id === p.supplierId)?.name || 'Unknown Supplier',
    branchName: branches.find(b => b.id === p.branchId)?.name || 'Unknown Branch'
  }));
  return res.json(enriched);
});

app.post('/api/purchase-orders', authMiddleware, roleCheck(['Admin', 'Manager']), (req: any, res) => {
  const { supplierId, branchId, items, notes } = req.body; // items: array of { productId, quantity, unitCost }
  if (!supplierId || !branchId || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing core Purchase Order requirements' });
  }

  let totalCost = 0;
  const itemsMapped = items.map((it: any) => {
    const cost = parseFloat(it.unitCost) * parseInt(it.quantity);
    totalCost += cost;
    return {
      id: `poi-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      purchaseOrderId: '',
      productId: it.productId,
      quantity: parseInt(it.quantity),
      unitCost: parseFloat(it.unitCost)
    };
  });

  const pOrderId = `po-${Date.now()}`;
  const po: PurchaseOrder = {
    id: pOrderId,
    supplierId,
    branchId,
    poNumber: `PO-ENTERPRISE-${Date.now().toString().slice(-4)}`,
    status: 'Pending',
    items: itemsMapped.map((it: any) => ({ ...it, purchaseOrderId: pOrderId })),
    totalCost: parseFloat(totalCost.toFixed(2)),
    notes: notes || '',
    createdAt: new Date().toISOString()
  };

  db.addPO(po);
  return res.json(po);
});

app.post('/api/purchase-orders/:id/receive', authMiddleware, roleCheck(['Admin', 'Manager']), (req: any, res) => {
  const { id } = req.params;
  const po = db.getPurchaseOrders().find(p => p.id === id);
  if (!po) return res.status(404).json({ error: 'Purchase order document not found' });

  if (po.status === 'Received') {
    return res.status(400).json({ error: 'Stock units have already been absorbed from this PO' });
  }

  // Update Stock levels
  po.status = 'Received';
  po.receivedAt = new Date().toISOString();
  db.updatePO(po);

  // Influx inventories
  po.items.forEach(it => {
    const updatedInv = db.updateInventoryQuantity(it.productId, po.branchId, it.quantity);
    
    // Log Movement
    db.addMovement({
      id: `mov-${Date.now()}-po-${it.productId}`,
      inventoryItemId: updatedInv.id,
      type: 'PO_Received',
      quantity: it.quantity,
      reason: `Received PO ref: ${po.poNumber}`,
      userId: req.user.userId,
      createdAt: new Date().toISOString()
    });

    broadcastEvent('stock:updated', { productId: it.productId, branchId: po.branchId, currentStock: updatedInv.stockQuantity });
  });

  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'RECEIVE_PO',
    details: `Successfully received purchase order cargo stock ${po.poNumber}`,
    createdAt: new Date().toISOString()
  });

  return res.json({ success: true, message: 'Stock ingested into the local inventory branch successfully' });
});


// --- REPORTS & FINANCIAL ANALYTICS ---
app.get('/api/reports/analytics', authMiddleware, (req, res) => {
  const orders = db.getOrders();
  const products = db.getProducts();
  const inventory = db.getInventory();

  // Basic Sales analytics across periods
  let salesTotal = 0;
  let costOfGoodsSold = 0;
  let validOrderCount = 0;

  orders.forEach(o => {
    if (o.status !== 'Refunded') {
      salesTotal += o.totalAmount;
      validOrderCount++;
      o.items.forEach(it => {
        const prod = products.find(p => p.id === it.productId);
        if (prod) {
          costOfGoodsSold += prod.costPrice * it.quantity;
        }
      });
    }
  });

  const grossProfit = salesTotal - costOfGoodsSold;

  // Inventory Valuation computes total products cost price x current quantities
  let totalValuationCostValue = 0;
  let totalValuationRetailValue = 0;

  inventory.forEach(item => {
    const prod = products.find(p => p.id === item.productId);
    if (prod) {
      totalValuationCostValue += (prod.costPrice * item.stockQuantity);
      totalValuationRetailValue += (prod.price * item.stockQuantity);
    }
  });

  // Daily Sales aggregation metrics (past 7 days)
  const chartSales: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    chartSales[dateStr] = 0;
  }

  orders.forEach(o => {
    if (o.status !== 'Refunded') {
      const dayStr = o.createdAt.split('T')[0];
      if (chartSales[dayStr] !== undefined) {
        chartSales[dayStr] += o.totalAmount;
      }
    }
  });

  const processedChart = Object.keys(chartSales).map(key => ({
    date: key,
    amount: parseFloat(chartSales[key].toFixed(2))
  }));

  return res.json({
    grossSales: parseFloat(salesTotal.toFixed(2)),
    cogs: parseFloat(costOfGoodsSold.toFixed(2)),
    grossProfit: parseFloat(grossProfit.toFixed(2)),
    netProfit: parseFloat((grossProfit * 0.85).toFixed(2)), // Approx assuming 15% business general costs
    transactionsCount: validOrderCount,
    inventoryValuationCost: parseFloat(totalValuationCostValue.toFixed(2)),
    revenueValuationRetail: parseFloat(totalValuationRetailValue.toFixed(2)),
    dailyVolumeChart: processedChart
  });
});


// --- SYSTEM SETTINGS & USERS MAINTENANCE ---
app.get('/api/settings', authMiddleware, (req, res) => {
  return res.json(db.getSettings());
});

app.put('/api/settings', authMiddleware, roleCheck(['Admin']), (req: any, res) => {
  db.updateSettings(req.body);
  
  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'UPDATE_SETTINGS',
    details: 'System business settings parameters modified',
    createdAt: new Date().toISOString()
  });

  return res.json({ success: true, settings: db.getSettings() });
});

// User Accounts Management inside Settings
app.get('/api/settings/users', authMiddleware, roleCheck(['Admin', 'Manager']), (req, res) => {
  const branches = db.getBranches();
  const enriched = db.getUsers().map(u => ({
    ...u,
    branchName: branches.find(b => b.id === u.branchId)?.name || 'Headquarters'
  }));
  return res.json(enriched);
});

app.post('/api/settings/users', authMiddleware, roleCheck(['Admin']), (req: any, res) => {
  const { name, email, role, branchId } = req.body;
  if (!name || !email || !role || !branchId) {
    return res.status(400).json({ error: 'Missing critical staff account fields' });
  }

  const existing = db.getUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'E-mail is already allocated to active team member' });
  }

  const newStaff: User = {
    id: `u-${Date.now()}`,
    email,
    name,
    role,
    branchId,
    isDeactivated: false,
    createdAt: new Date().toISOString()
  };

  db.addUser(newStaff);

  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'CREATE_STAFF',
    details: `Created user account for "${name}" (${role})`,
    createdAt: new Date().toISOString()
  });

  return res.json(newStaff);
});

app.put('/api/settings/users/:id', authMiddleware, roleCheck(['Admin']), (req: any, res) => {
  const { id } = req.params;
  const { name, role, branchId, isDeactivated } = req.body;

  db.updateUser(id, { name, role, branchId, isDeactivated });

  db.addAuditLog({
    id: `aud-${Date.now()}`,
    userId: req.user.userId,
    action: 'UPDATE_STAFF',
    details: `Modified configurations details of employee ${id}`,
    createdAt: new Date().toISOString()
  });

  return res.json({ success: true });
});

app.get('/api/settings/branches', authMiddleware, (req, res) => {
  return res.json(db.getBranches());
});

app.get('/api/settings/audit-logs', authMiddleware, roleCheck(['Admin', 'Manager']), (req, res) => {
  const logs = db.getAuditLogs();
  const users = db.getUsers();

  const enriched = logs.map(l => ({
    ...l,
    userName: users.find(u => u.id === l.userId)?.name || 'Admin System'
  }));

  return res.json(enriched);
});


// --- INTEGRATING EXTRA GEMINI INSIGHTS FOR THE REPORTS AND CHANNELS ---
app.post('/api/ai/insights', authMiddleware, async (req: any, res) => {
  try {
    const products = db.getProducts();
    const orders = db.getOrders();
    const systemSettings = db.getSettings();

    // Prepare quick summary metrics for Gemini
    const simpleMetrics = {
      business: systemSettings.businessName,
      total_products: products.length,
      orders_count: orders.filter(o => o.status !== 'Refunded').length,
      revenue_sum: orders.filter(o => o.status !== 'Refunded').reduce((acc, o) => acc + o.totalAmount, 0)
    };

    const promptMessage = `Analyze this retail POS sales environment metrics: ${JSON.stringify(simpleMetrics)}. Write a bulleted list of 3 strategic recommendations formatted in clean markdown for a retail operations manager. Seek optimization in inventory, pricing, or product groupings. Be direct, crisp, and executive. Do not mention system paths.`;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'MY_GEMINI_API_KEY') {
      // Fallback if key missing
      return res.json({
        insights: `### Operational Recommendations for ${systemSettings.businessName}\n\n` +
          `*   **Optimize Overstocked Lines**: Review the consumer electronics stock ratio, specifically high-cost products such as "Aura Wireless Earbuds Pro", allocating surplus to high-traffic local branches.\n` +
          `*   **Integrate Value Bundles**: Combine fresh daily delicacies (e.g. Club Sandwich) with beverage options to increase the Average Transaction Value (ATV).\n` +
          `*   **Deploy Targeted Campaigns**: Offer custom promotions for top loyalty high-rollers to generate incremental weekday retail traffic volume.`
      });
    }

    // Lazy load standard SDK
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const aiResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: promptMessage
    });

    return res.json({ insights: aiResponse.text || 'Unable to generate live insights at this moment.' });
  } catch (err) {
    console.error('Gemini Insights Service Error:', err);
    return res.json({
      insights: `### Operational Insights & General Guidelines\n\n` +
        `*   **Stock Threshold Safeguards**: Set proactive stock audits on products falling below minimum thresholds to prevent stock-outs.\n` +
        `*   **Upsell Fresh Foods**: Maximize afternoon high-margin transactions by introducing snack bundles at register terminal points.\n` +
        `*   **Promotional Loyalty Ties**: Capitalize on accumulated loyalty point transactions by hosting points multiplier events.`
    });
  }
});


// --- VITE DEV AND PROD SERVING LOGIC ---
async function bootstrap() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Global exception handling
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Fatal Server Error:', err);
    res.status(500).json({ error: 'Internal Server Error occurring on base system framework API.' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Enterprise Full-Stack Retail POS Server running on http://localhost:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('Bootstrap failure:', err);
});
