import React, { useState } from 'react';
import { X, Printer, Check, Calendar, Clock, Hash, Info } from 'lucide-react';
import ErrorModal from './ErrorModal';
import type { Sale } from '@/lib/types';
import { loadShopSettings } from '@/lib/shopSettings';
import { printReceipt } from '@/lib/printerService';

interface Props {
  sale: Sale;
  onClose: () => void;
  onConfirm?: () => void; // Finalize the sale
}

export default function ReceiptModal({ sale, onClose, onConfirm }: Props) {
  const [errorModal, setErrorModal] = useState({ show: false, title: '', message: '' });
  const shop = loadShopSettings();
  const now = new Date();
  const invoiceNo = `INV-${sale.id.replace('sale-', '').slice(-8).toUpperCase()}`;
  const subtotal = sale.items.reduce((s, i) => s + i.price * i.quantity, 0);

  const handlePrint = () => {
    if (onConfirm) {
      onConfirm();
    }
    printReceipt(sale, shop);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-xl no-print" onClick={onClose} />

      <div className="relative z-10 w-full max-w-sm animate-in flex flex-col max-h-[92vh] shadow-[0_0_50px_rgba(0,0,0,0.3)]">
        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 glass-card rounded-t-3xl border-b border-border/50 no-print">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center transition-transform hover:scale-110">
              <Printer className="h-4 w-4 text-primary" />
            </div>
            <span className="font-black text-sm tracking-tight">Receipt Preview</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-xl transition-all hover:rotate-90">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Receipt scroll area */}
        <div className="overflow-y-auto flex-1 bg-[#eeeee8] px-6 py-6 scrollbar-none">
          {/* Receipt paper with realistic shadows and edges */}
          <div
            id="printable-receipt"
            className="bg-white mx-auto relative shadow-[0_10px_30px_rgba(0,0,0,0.1)] before:absolute before:inset-x-0 before:-top-3 before:h-3 before:bg-[radial-gradient(circle,transparent_0,transparent_4px,#fff_4px,#fff_8px)] before:bg-[length:16px_8px] after:absolute after:inset-x-0 after:-bottom-3 after:h-3 after:bg-[radial-gradient(circle,transparent_0,transparent_4px,#fff_4px,#fff_8px)] after:bg-[length:16px_8px] after:rotate-180"
            style={{ width: '100%', maxWidth: '300px', fontFamily: "'Courier New', Courier, monospace" }}
          >
            <div className="p-6 text-[#111]">
              {/* Shop info section */}
              <div className="text-center mb-6">
                <div className="text-xl font-black tracking-widest uppercase mb-1">{shop.name || 'BUSINESS HUB'}</div>
                {shop.tagline && <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter mb-2">{shop.tagline}</div>}
                
                <div className="space-y-0.5 text-[10px] text-zinc-600 font-medium">
                  {shop.address && <p className="leading-tight">📍 {shop.address}</p>}
                  {shop.phone && <p>📞 {shop.phone}</p>}
                  {shop.gst && <p className="font-mono">GST: {shop.gst}</p>}
                </div>
              </div>

              {/* Decorative separator */}
              <div className="border-t border-dashed border-zinc-300 my-4" />

              {/* Metadata */}
              <div className="space-y-1 text-[11px] mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 flex items-center gap-1"><Hash className="h-3 w-3" /> NO</span>
                  <span className="font-bold">{invoiceNo}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 flex items-center gap-1"><Calendar className="h-3 w-3" /> DATE</span>
                  <span className="font-bold">{now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 flex items-center gap-1"><Clock className="h-3 w-3" /> TIME</span>
                  <span className="font-bold">{now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                {sale.customerName && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">CUSTOMER</span>
                    <span className="font-bold uppercase">{sale.customerName}</span>
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="border-y-2 border-zinc-800 py-2 mb-4">
                <div className="grid grid-cols-[1fr_30px_60px_70px] gap-2 text-[9px] font-black uppercase tracking-wider mb-2">
                  <span>ITEM</span>
                  <span className="text-center">QTY</span>
                  <span className="text-right">PRICE</span>
                  <span className="text-right">TOTAL</span>
                </div>
                <div className="space-y-3">
                  {sale.items.map((item, i) => (
                    <div key={i} className="grid grid-cols-[1fr_30px_60px_70px] gap-2 text-[11px] items-start">
                      <span className="font-bold uppercase leading-tight">{item.name}</span>
                      <span className="text-center text-zinc-500">{item.quantity}</span>
                      <span className="text-right text-zinc-500">₹{item.price.toFixed(0)}</span>
                      <span className="text-right font-black">₹{(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Section */}
              <div className="space-y-1.5 mb-6">
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>SUBTOTAL</span><span>₹{subtotal.toFixed(2)}</span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between text-[11px] text-zinc-500">
                    <span>DISCOUNT</span><span>-₹{sale.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t-2 border-double border-zinc-800 pt-2 flex justify-between items-center">
                  <span className="text-sm font-black italic">GRAND TOTAL</span>
                  <span className="text-lg font-black tracking-tight">₹{sale.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Details Section */}
              <div className="border-t border-zinc-200 pt-3 mb-6 space-y-1">
                <p className="text-[9px] font-black tracking-widest uppercase text-center mb-2 opacity-60">Payment Breakdown</p>
                {sale.payments && sale.payments.length > 0 ? (
                  sale.payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-[11px] font-bold px-2">
                      <span className="uppercase text-zinc-500">{p.mode}</span>
                      <span className="font-black">₹{p.amount.toFixed(2)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center">
                    <div className="inline-block border-2 border-zinc-800 px-4 py-1 rounded-sm">
                      <span className="text-[10px] font-black tracking-widest uppercase">PAID VIA {sale.paymentMode}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer text */}
              <div className="text-center space-y-2">
                <div className="text-[12px] font-black uppercase tracking-wider">{sale.footerNote || shop.footer || 'THANK YOU! VISIT AGAIN'}</div>
                <div className="text-[9px] text-zinc-400 font-bold">
                  {sale.items.length} ITEM(S) SCANNED · SAVE THIS RECEIPT
                </div>
                {/* Visual barcode mockup */}
                <div className="barcode-container flex justify-center gap-0.5 h-6 mt-4 opacity-70">
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} className={`bg-black ${Math.random() > 0.5 ? 'w-0.5' : 'w-px'}`} style={{ height: Math.random() > 0.3 ? '100%' : '80%' }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action footer */}
        <div className="flex flex-col gap-2 p-4 glass-card rounded-b-3xl border-t border-border/50 no-print">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-2xl font-bold text-xs border border-border hover:bg-accent transition-all uppercase tracking-widest text-muted-foreground"
            >
              {onConfirm ? 'Edit Order' : 'Close'}
            </button>
            
            {onConfirm ? (
              <button
                onClick={() => { handlePrint(); onConfirm(); onClose(); }}
                className="flex-[2] premium-gradient text-white py-3 rounded-2xl font-black text-xs hover:shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest shadow-lg shadow-primary/20"
              >
                <Printer className="h-4 w-4" />
                Print & Complete
              </button>
            ) : (
              <button
                onClick={handlePrint}
                className="flex-[2] premium-gradient text-white py-3 rounded-2xl font-black text-xs hover:shadow-xl transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
              >
                <Printer className="h-4 w-4" />
                Reprint Receipt
              </button>
            )}
          </div>

          {onConfirm && (
            <div className="space-y-2 mt-2">
              <button
                onClick={() => { onConfirm(); onClose(); }}
                className="w-full py-2 px-4 rounded-xl font-bold text-[10px] text-muted-foreground hover:text-foreground transition-all uppercase tracking-[0.2em] flex items-center justify-center gap-2 opacity-60 hover:opacity-100"
              >
                <Check className="h-3 w-3" /> Just Complete (No Print)
              </button>
              
              <div className="flex justify-center">
                <button 
                  onClick={() => setErrorModal({
                    show: true,
                    title: 'Speed Tip',
                    message: "To skip this preview box automatically:\n1. Close Chrome\n2. Right-click Chrome Shortcut > Properties\n3. Add '--kiosk-printing' at the end of the Target field\n4. Restart!"
                  })}
                  className="text-[9px] font-black uppercase tracking-widest text-primary/60 hover:text-primary transition-colors underline decoration-dotted"
                >
                  ⚡ Want to skip this preview box?
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ErrorModal 
        isOpen={errorModal.show}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => setErrorModal({ ...errorModal, show: false })}
      />
    </div>
  );
}
