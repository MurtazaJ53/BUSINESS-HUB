import { BleClient, numbersToDataView } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import type { Sale } from './types';

// ESC/POS Commands
const ESC = 0x1B;
const GS = 0x1D;
const LF = 0x0A;

const PRINTER_SERVICE_UUID = '000018f0-0000-1000-8000-00805f9b34fb';
const PRINTER_CHARACTERISTIC_UUID = '00002af1-0000-1000-8000-00805f9b34fb';

class NativePrinter {
  private deviceId: string | null = null;

  async init() {
    try { await BleClient.initialize(); } catch (e) {}
  }

  async scanAndConnect(): Promise<boolean> {
    try {
      await this.init();
      const device = await BleClient.requestDevice({ optionalServices: [PRINTER_SERVICE_UUID] });
      this.deviceId = device.deviceId;
      await BleClient.connect(this.deviceId);
      return true;
    } catch (e) {
      console.warn('Printer connection failed', e);
      return false;
    }
  }

  async print(sale: Sale, shop: any) {
    if (!this.deviceId) {
      const ok = await this.scanAndConnect();
      if (!ok) throw new Error('Bluetooth printer not found');
    }

    const encoder = new TextEncoder();
    let bytes: number[] = [];

    bytes.push(ESC, 0x40); // Init
    bytes.push(ESC, 0x61, 0x01); // Center
    bytes.push(ESC, 0x21, 0x30); // Big font
    bytes.push(...Array.from(encoder.encode((shop.name || 'RECEIPT').toUpperCase() + '\n')));
    
    bytes.push(ESC, 0x21, 0x00); // Reset font
    if (shop.tagline) bytes.push(...Array.from(encoder.encode(shop.tagline + '\n')));
    bytes.push(...Array.from(encoder.encode('--------------------------------\n')));
    bytes.push(...Array.from(encoder.encode(`INV: ${sale.id.slice(-8).toUpperCase()} | ${sale.date}\n`)));

    bytes.push(ESC, 0x61, 0x00); // Left
    sale.items.forEach(item => {
      const line = `${item.name.slice(0, 18).padEnd(18)} ${item.quantity}x ${item.price}\n`;
      bytes.push(...Array.from(encoder.encode(line)));
    });

    bytes.push(...Array.from(encoder.encode('--------------------------------\n')));
    bytes.push(ESC, 0x61, 0x02); // Right
    bytes.push(...Array.from(encoder.encode(`TOTAL: RS ${sale.total}\n`)));

    bytes.push(LF, LF, LF, LF);
    bytes.push(GS, 0x56, 0x42, 0x00); // Cut

    const chunkSize = 20;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      await BleClient.write(this.deviceId!, PRINTER_SERVICE_UUID, PRINTER_CHARACTERISTIC_UUID, numbersToDataView(bytes.slice(i, i + chunkSize)));
    }
  }
}

const nativePrinter = new NativePrinter();

export async function printReceipt(sale: Sale, shop: any) {
  if (Capacitor.isNativePlatform()) {
    try {
      await nativePrinter.print(sale, shop);
      return;
    } catch (e) {
      console.error('Native print failed, falling back to web', e);
    }
  }

  // WEB FALLBACK (from original printReceipt.ts logic)
  const invoiceNo = `INV-${sale.id.replace('sale-', '').slice(-6).toUpperCase()}`;
  const html = `
    <html>
      <body style="font-family: monospace; width: 80mm; padding: 20px;">
        <div style="text-align: center;">
          <h2>${shop.name || 'BUSINESS HUB'}</h2>
          <p>${shop.tagline || ''}</p>
        </div>
        <hr/>
        <p>No: ${invoiceNo}</p>
        <p>Date: ${sale.date}</p>
        <hr/>
        <table style="width: 100%;">
          ${sale.items.map(i => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${i.price}</td></tr>`).join('')}
        </table>
        <hr/>
        <div style="text-align: right;"><b>TOTAL: RS ${sale.total}</b></div>
        <p style="text-align: center; margin-top: 20px;">${shop.footer || 'Thank You!'}</p>
        <script>window.onload = () => { window.print(); window.onfocus = () => window.close(); }</script>
      </body>
    </html>
  `;

  const win = window.open('', '_blank', 'width=400,height=600');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
