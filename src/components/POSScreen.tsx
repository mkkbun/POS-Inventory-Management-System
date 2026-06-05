/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from '../store.ts';
import { BriefProduct, Customer, Category } from '../types.ts';
import {
  Search, Barcode, Trash2, Plus, Minus, CreditCard, Banknote,
  Users, CheckCircle, AlertCircle, Printer, Pause, Play, Tag, Percent
} from 'lucide-react';

export default function POSScreen() {
  const {
    token,
    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    cartDiscountPercentage,
    setTotalCartDiscount,
    clearCart,
    holdCurrentOrder,
    heldOrders,
    recallOrder,
    deleteHeldOrder,
    selectedBranchId
  } = useAppStore();

  const [products, setProducts] = useState<BriefProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Barcode Scanning Emulator
  const [barcodeInput, setBarcodeInput] = useState('');
  const [scanStatus, setScanStatus] = useState<'idle' | 'success' | 'notFound'>('idle');
  const [scannedProduct, setScannedProduct] = useState<string | null>(null);

  // Active customer links
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  // Checkout Modal State
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'Split'>('Cash');
  const [cashTendered, setCashTendered] = useState('');
  const [cardAmount, setCardAmount] = useState('0'); // for Split
  const [cashAmount, setCashAmount] = useState('0'); // for Split
  const [submittingCheckout, setSubmittingCheckout] = useState(false);
  const [receiptOrder, setReceiptOrder] = useState<any | null>(null);

  // System tax multiplier
  const taxRate = 20; // Default 20%
  const currencySymbol = '£';

  // Load products, categories, customers
  const loadData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [resP, resC, resCust] = await Promise.all([
        fetch('/api/products', { headers }),
        fetch('/api/categories', { headers }),
        fetch('/api/customers', { headers })
      ]);
      if (resP.ok) setProducts(await resP.json());
      if (resC.ok) setCategories(await resC.json());
      if (resCust.ok) setCustomers(await resCust.json());
    } catch (e) {
      console.error('Failed to reload POS details', e);
    }
  };

  useEffect(() => {
    if (token) {
      loadData();
    }
  }, [token, selectedBranchId]);

  // Handle Keyboard Barcode Emulation
  // Listening to physical keyboard inputs in rapid sequence to handle scanner guns
  useEffect(() => {
    let rawBarcode = '';
    let lastKeyTime = Date.now();

    const handleKeyPress = (e: KeyboardEvent) => {
      const now = Date.now();
      // Scanners typically send keystrokes extremely rapidly (<30ms)
      if (now - lastKeyTime > 120) {
        rawBarcode = ''; // Timeout Reset
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        if (rawBarcode.length >= 8) {
          handleBarcodeScan(rawBarcode);
          rawBarcode = '';
          e.preventDefault();
        }
      } else if (/^[0-9]$/.test(e.key)) {
        rawBarcode += e.key;
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => window.removeEventListener('keypress', handleKeyPress);
  }, [products]);

  const handleBarcodeScan = (barcodeToScan: string) => {
    const target = products.find(p => p.barcode === barcodeToScan);
    if (target) {
      addToCart(target);
      setScannedProduct(target.name);
      setScanStatus('success');
      setTimeout(() => {
        setScanStatus('idle');
        setScannedProduct(null);
      }, 1500);
    } else {
      setScanStatus('notFound');
      setTimeout(() => setScanStatus('idle'), 1500);
    }
  };

  const handleManualBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput) return;
    handleBarcodeScan(barcodeInput);
    setBarcodeInput('');
  };

  // Filter products by category and query
  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategoryId === 'ALL' || p.categoryId === selectedCategoryId;
    const matchQuery = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase()) || p.barcode.includes(searchQuery);
    return matchCat && matchQuery;
  });

  // Calculations
  const cartSubtotal = cart.reduce((acc, c) => {
    const linePrice = c.product.price * c.quantity;
    const lineDiscount = (c.appliedDiscountPercentage / 100) * linePrice;
    return acc + (linePrice - lineDiscount);
  }, 0);

  const cartDiscountVal = (cartDiscountPercentage / 100) * cartSubtotal;
  const taxableBasis = cartSubtotal - cartDiscountVal;
  const taxVal = taxableBasis * (taxRate / 100);
  const cartTotal = taxableBasis + taxVal;

  // Change computation
  const cashAmountNum = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, cashAmountNum - cartTotal);

  // Trigger Checkout Submission
  const processCheckout = async () => {
    if (cart.length === 0) return;
    setSubmittingCheckout(true);

    try {
      const payload = {
        customerId: selectedCustomerId || undefined,
        items: cart.map(item => ({
          productId: item.product.id,
          quantity: item.quantity,
          appliedDiscountPercentage: item.appliedDiscountPercentage
        })),
        discountPercentage: cartDiscountPercentage,
        paymentMethod,
        cashReceived: paymentMethod === 'Cash' ? parseFloat(cashTendered) : paymentMethod === 'Split' ? parseFloat(cashAmount) : undefined,
        changeGiven: paymentMethod === 'Cash' ? changeDue : undefined
      };

      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Checkout transaction failed.');
        return;
      }

      // Success
      setReceiptOrder(data.order);
      clearCart();
      setSelectedCustomerId('');
      setCashTendered('');
      setCardAmount('0');
      setCashAmount('0');
      // Refresh local product quantities status
      loadData();
    } catch (e) {
      alert('Internal network connection failure.');
    } finally {
      setSubmittingCheckout(false);
    }
  };
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[calc(100vh-140px)]">
      {/* Left Column: Products picker grid and Category Filters */}
      <div className="xl:col-span-2 flex flex-col space-y-4 h-full overflow-hidden">
        
        {/* Top Search & Barcode row */}
        <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 border border-slate-200 rounded-md shadow-sm">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product SKU, name or barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-sans focus:outline-hidden focus:border-indigo-500 transition"
            />
          </div>

          {/* Barcode Trigger Emulator */}
          <form onSubmit={handleManualBarcodeSubmit} className="flex gap-2 min-w-[280px]">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Simulate barcode laser..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs font-mono focus:outline-hidden focus:border-indigo-600"
              />
            </div>
            <button type="submit" className="px-4 bg-slate-905 hover:bg-slate-800 border border-slate-900 text-white rounded-md text-xs font-mono transition cursor-pointer font-bold">
              Scan
            </button>
          </form>
        </div>

        {/* Scan emulator response line */}
        {scanStatus !== 'idle' && (
          <div className={`p-2.5 rounded-md flex items-center gap-2 text-xs font-mono animate-pulse ${scanStatus === 'success' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'}`}>
            {scanStatus === 'success' ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Scanned: {scannedProduct} added to cart!
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 text-rose-600" />
                Barcode not registered in database catalog.
              </>
            )}
          </div>
        )}

        {/* Categories Tabs Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
          <button
            onClick={() => setSelectedCategoryId('ALL')}
            className={`px-3 py-1.5 rounded-md text-xs font-mono border whitespace-nowrap transition cursor-pointer ${selectedCategoryId === 'ALL' ? 'bg-indigo-600 border-indigo-600 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-sans font-medium border whitespace-nowrap transition cursor-pointer ${selectedCategoryId === cat.id ? 'bg-indigo-600 border-indigo-600 text-white font-bold' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {cat.name}
            </button>
          ))}        </div>

        {/* Product Items Selection Tiles */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 gap-3 pr-2 scrollbar-thin">
          {filteredProducts.map(p => {
            const branchStock = p.branchStocks && p.branchStocks[selectedBranchId] !== undefined ? p.branchStocks[selectedBranchId] : 0;
            const isOutOfStock = branchStock <= 0;
            return (
              <button
                key={p.id}
                onClick={() => !isOutOfStock && addToCart(p)}
                disabled={isOutOfStock}
                className={`relative bg-white border border-slate-200 hover:border-indigo-400 rounded-md p-3 flex flex-col justify-between text-left shadow-2xs hover:shadow-xs transition select-none cursor-pointer h-fit min-h-[140px] focus:outline-hidden ${isOutOfStock ? 'opacity-55 cursor-not-allowed' : ''}`}
              >
                <div>
                  <div className="flex justify-between items-start gap-1 pb-1">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{p.sku}</span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full ${isOutOfStock ? 'bg-rose-100 text-rose-800' : branchStock <= p.lowStockThreshold ? 'bg-amber-100 text-amber-850' : 'bg-slate-100 text-slate-600'}`}>
                      {isOutOfStock ? 'OUT_OF_STOCK' : `${branchStock} units`}
                    </span>
                  </div>
                  <h4 className="text-xs font-sans font-semibold text-slate-800 line-clamp-2 leading-snug">{p.name}</h4>
                </div>
                <div className="flex items-end justify-between mt-2 pt-2 border-t border-slate-100/60">
                  <span className="text-sm font-sans font-extrabold text-slate-955 font-mono">£{p.price.toFixed(2)}</span>
                  <span className="text-[9px] text-slate-400 font-mono line-clamp-1">{p.barcode.slice(-4)}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Column: Checkout Cart Workspace */}
      <div className="bg-white border border-slate-200 rounded-md shadow-sm flex flex-col h-full overflow-hidden">
        
        {/* Customer & Hold/Recall head segment */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-sans font-bold text-slate-900">Current checkout Cart</h3>
            <div className="flex gap-1.5">
              <button
                title="Hold checkout session"
                onClick={() => holdCurrentOrder(selectedCustomerId || undefined)}
                disabled={cart.length === 0}
                className="p-1 px-2 border border-slate-200 hover:bg-slate-100 rounded-lg text-xs font-mono text-slate-600 flex items-center gap-1 disabled:opacity-50 transition cursor-pointer"
              >
                <Pause className="w-3 h-3" /> Hold
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Users className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full bg-white select-none text-slate-700 pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs font-sans focus:outline-hidden"
              >
                <option value="">Guest checkout (No customer linked)</option>
                {customers.map(cust => (
                  <option key={cust.id} value={cust.id}>
                    {cust.name} ({cust.loyaltyPointsBalance} pts)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Held Orders quick list if any present */}
        {heldOrders.length > 0 && (
          <div className="bg-amber-50/50 border-b border-amber-100 px-4 py-2 flex flex-col gap-1.5">
            <span className="text-[10px] font-mono text-amber-800 uppercase tracking-widest leading-none">Held instances ({heldOrders.length}):</span>
            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              {heldOrders.map(held => (
                <div key={held.id} className="flex items-center gap-1 bg-white border border-amber-200 p-1 px-2 rounded-lg text-[10px] font-mono whitespace-nowrap">
                  <span>{new Date(held.createdAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}</span>
                  <button onClick={() => recallOrder(held.id)} className="text-indigo-600 font-bold hover:underline ml-1 cursor-pointer">Restore</button>
                  <button onClick={() => deleteHeldOrder(held.id)} className="text-rose-600 hover:text-rose-800 font-bold ml-1 cursor-pointer">×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cart Item rows list */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100 scrollbar-thin">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 font-mono text-center space-y-2 py-12">
              <span className="text-3xl">🛒</span>
              <p className="text-xs">Checkout transaction is completely empty.</p>
              <p className="text-[10px] max-w-[200px] leading-relaxed">Select products or scan barcodes to pop carts.</p>
            </div>
          ) : (
            cart.map(item => {
              const lineCost = item.product.price * item.quantity;
              const lineDiscountValue = (item.appliedDiscountPercentage / 100) * lineCost;
              return (
                <div key={item.product.id} className="py-3 flex flex-col gap-1.5">
                  <div className="flex justify-between items-start gap-1">
                    <div className="flex-1 leading-tight">
                      <h4 className="text-xs font-sans font-semibold text-slate-800 line-clamp-1">{item.product.name}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">£{item.product.price.toFixed(2)} each</span>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1 text-slate-350 hover:text-rose-600 rounded-lg transition hover:bg-slate-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex justify-between items-center gap-2">
                    {/* Stepper adjustment */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                        className="p-1 border border-slate-200 hover:bg-slate-50 rounded text-slate-600 cursor-pointer"
                      >
                        <Minus className="w-2.5 h-2.5" />
                      </button>
                      <span className="w-6 text-center text-xs font-mono font-bold text-slate-800">{item.quantity}</span>
                      <button
                        onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                        className="p-1 border border-slate-200 hover:bg-slate-50 rounded text-slate-600 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    </div>

                    {/* Cost pricing details */}
                    <div className="text-right">
                      {lineDiscountValue > 0 && (
                        <span className="text-[10px] text-rose-500 font-mono line-through block leading-tight">£{lineCost.toFixed(2)}</span>
                      )}
                      <span className="text-xs font-sans font-extrabold text-slate-900 font-mono">£{(lineCost - lineDiscountValue).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pricing Summary Block & Checkout Triggers */}
        <div className="border-t border-slate-100 p-4 bg-slate-50/50 space-y-4">
          <div className="space-y-1.5 text-xs text-slate-600">
            {/* Discount selector button line */}
            <div className="flex justify-between items-center pb-1">
              <span className="flex items-center gap-1 text-slate-400 font-mono text-[10px] uppercase font-bold"><Tag className="w-3 h-3" /> Applied Discount</span>
              <div className="flex gap-1">
                {[0, 5, 10, 20].map(pct => (
                  <button
                    key={pct}
                    onClick={() => setTotalCartDiscount(pct)}
                    className={`p-1 px-2 rounded-md font-mono text-[9px] border transition cursor-pointer ${cartDiscountPercentage === pct ? 'bg-indigo-650 border-indigo-650 text-white' : 'bg-white border-slate-200 hover:bg-slate-100'}`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between font-sans">
              <span>Subtotal:</span>
              <span className="font-mono">£{cartSubtotal.toFixed(2)}</span>
            </div>
            {cartDiscountPercentage > 0 && (
              <div className="flex justify-between font-sans text-rose-600 font-medium">
                <span>Discount ({cartDiscountPercentage}%):</span>
                <span className="font-mono">-£{cartDiscountVal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-sans">
              <span>Vat standard ({taxRate}%):</span>
              <span className="font-mono">£{taxVal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-sans text-sm font-extrabold text-slate-950 border-t border-slate-200/60 pt-2 font-mono">
              <span>Grand Total:</span>
              <span className="text-lg text-emerald-700">£{cartTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={() => setCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono font-medium py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition drop-shadow-xs cursor-pointer"
          >
            <CheckCircle className="w-4 h-4" /> Go to Payment Gateway
          </button>
        </div>
      </div>

      {/* CHECKOUT MODAL WINDOW */}
      {checkoutOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 flex flex-col gap-4 relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-sans font-extrabold text-slate-900 uppercase tracking-widest">Select Payment Method</h3>
              <button onClick={() => setCheckoutOpen(false)} className="text-slate-400 text-xl font-bold hover:text-slate-600 cursor-pointer">×</button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('Cash')}
                className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1.5 border transition cursor-pointer ${paymentMethod === 'Cash' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
              >
                <Banknote className="w-5 h-5" />
                <span className="text-[10px] font-mono leading-none">CASH</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('Card')}
                className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1.5 border transition cursor-pointer ${paymentMethod === 'Card' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
              >
                <CreditCard className="w-5 h-5" />
                <span className="text-[10px] font-mono leading-none">CARD</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('Split')}
                className={`py-3 rounded-xl flex flex-col items-center justify-center gap-1.5 border transition cursor-pointer ${paymentMethod === 'Split' ? 'bg-indigo-50 border-indigo-600 text-indigo-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
              >
                <Percent className="w-5 h-5" />
                <span className="text-[10px] font-mono leading-none">SPLIT</span>
              </button>
            </div>

            {/* Cash Pay form field */}
            {paymentMethod === 'Cash' && (
              <div className="space-y-3 p-3 bg-slate-50 border border-slate-250/70 rounded-xl">
                <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wide">Cash Received Calculator</span>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Enter cash tendered..."
                    value={cashTendered}
                    onChange={(e) => setCashTendered(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 pl-3 py-2 rounded-lg text-xs font-mono"
                    autoFocus
                  />
                  <button
                    onClick={() => setCashTendered(cartTotal.toFixed(2))}
                    className="px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-mono rounded-lg transition"
                  >
                    Exact
                  </button>
                </div>
                {/* Fast Tender suggestions */}
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {[5, 10, 20, 50].map(bill => (
                    <button
                      key={bill}
                      onClick={() => setCashTendered(bill.toString())}
                      className="p-1 px-2 border border-slate-200 bg-white rounded text-[10px] font-mono hover:bg-slate-150 transition cursor-pointer"
                    >
                      £{bill}
                    </button>
                  ))}
                </div>
                {cashAmountNum > 0 && (
                  <div className="flex justify-between items-center text-xs border-t border-slate-200 pt-2 font-mono">
                    <span className="text-slate-500">Change Due:</span>
                    <span className="text-base font-bold text-emerald-700">£{changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Split Pay fields */}
            {paymentMethod === 'Split' && (
              <div className="space-y-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono space-y-2">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Input allocations</span>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Card Portion:</label>
                  <input
                    type="number"
                    value={cardAmount}
                    onChange={(e) => setCardAmount(e.target.value)}
                    className="w-full bg-white border border-slate-200 pl-2.5 py-1.5 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 mb-1 block">Cash Portion:</label>
                  <input
                    type="number"
                    value={cashAmount}
                    onChange={(e) => setCashAmount(e.target.value)}
                    className="w-full bg-white border border-slate-200 pl-2.5 py-1.5 rounded-lg text-xs"
                  />
                </div>
                <div className="text-[10px] flex justify-between pt-1 border-t border-slate-200">
                  <span>Due: £{cartTotal.toFixed(2)}</span>
                  <span className={`${(parseFloat(cardAmount) || 0) + (parseFloat(cashAmount) || 0) === cartTotal ? 'text-emerald-700 font-bold' : 'text-red-500'}`}>
                    Sum: £{((parseFloat(cardAmount) || 0) + (parseFloat(cashAmount) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Submission triggers */}
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setCheckoutOpen(false)}
                className="flex-1 py-2 rounded-xl text-xs font-mono border border-slate-200 hover:bg-slate-50 transition cursor-pointer"
              >
                Back to Cart
              </button>
              <button
                onClick={processCheckout}
                disabled={submittingCheckout || (paymentMethod === 'Cash' && cashAmountNum < cartTotal)}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-mono rounded-xl disabled:opacity-50 transition cursor-pointer"
              >
                {submittingCheckout ? 'Authorizing...' : 'Process Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POS THERMAL RECEIPT MODAL PRINT-OUT */}
      {receiptOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 flex flex-col gap-4 border border-slate-200 shadow-2xl scale-in duration-200 my-auto">
            
            {/* Thermal Print representation container */}
            <div className="border border-dashed border-slate-350 p-5 bg-stone-50 rounded-lg text-xs font-mono text-slate-800 space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-sm font-sans font-bold text-slate-900 leading-tight">APEX ENTERPRISE RETAIL</h3>
                <p className="text-[10px] text-slate-500 font-mono">Branch ID: {receiptOrder.branchId}</p>
                <p className="text-[9px] text-slate-405">Phone: +44 20 7496 0122</p>
              </div>

              <div className="border-t border-slate-250 border-dashed my-2"></div>

              <div className="space-y-1 text-[10px]">
                <p>Order Number: <span className="font-bold flex-1 text-right">{receiptOrder.orderNumber}</span></p>
                <p>Cashier ID: {receiptOrder.cashierId}</p>
                <p>Payment Mode: {receiptOrder.paymentMethod}</p>
                <p>Timestamp: {new Date(receiptOrder.createdAt).toLocaleString('en-GB')}</p>
              </div>

              <div className="border-t border-slate-250 border-dashed my-2"></div>

              <div className="space-y-1.5">
                <div className="flex justify-between font-bold text-[10px]">
                  <span>Item Description</span>
                  <span>Qty / Price</span>
                </div>
                {receiptOrder.items.map((it: any) => {
                  const prodRec = products.find(prod => prod.id === it.productId);
                  return (
                    <div key={it.id} className="flex justify-between text-[10px] pl-1 h-fit">
                      <span className="truncate max-w-[180px]">{prodRec?.name || 'Retail Item'}</span>
                      <span>{it.quantity}x £{(it.priceAtSale).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-250 border-dashed my-2"></div>

              <div className="text-[10px] space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal basis:</span>
                  <span>£{(receiptOrder.totalBeforeTax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>VAT tax standard ({taxRate}%):</span>
                  <span>£{(receiptOrder.taxAmount).toFixed(2)}</span>
                </div>
                {receiptOrder.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Discount applied ({receiptOrder.discountPercentage}%):</span>
                    <span>-£{receiptOrder.discountAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-[11px] border-t border-slate-205 border-dashed pt-1 mt-1 text-slate-950">
                  <span>Total Amount Due:</span>
                  <span>£{receiptOrder.totalAmount.toFixed(2)}</span>
                </div>
                {receiptOrder.cashReceived !== undefined && (
                  <>
                    <div className="flex justify-between pt-1">
                      <span>Cash Tendered:</span>
                      <span>£{(receiptOrder.cashReceived).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-slate-900">
                      <span>Change Out:</span>
                      <span>£{(receiptOrder.changeGiven || 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="border-t border-slate-250 border-dashed my-2"></div>

              <div className="text-center font-sans text-[10px] text-slate-500 mt-2">
                Thank you for shopping with Apex!
              </div>
            </div>

            {/* Print trigger overlay actions */}
            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-mono flex items-center justify-center gap-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" /> Print Copy
              </button>
              <button
                onClick={() => setReceiptOrder(null)}
                className="flex-1 py-1.5 bg-slate-900 hover:border-black text-white rounded-lg text-xs font-mono transition text-center cursor-pointer"
              >
                Next transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
