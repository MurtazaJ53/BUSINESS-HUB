import { AdminShell } from "@/components/admin-shell";
import { getSession, resolveActiveShop } from "@/lib/admin-api";
import { 
  Check, 
  AlertTriangle, 
  Info, 
  XOctagon, 
  Search, 
  Plus, 
  User, 
  Eye, 
  Layers 
} from "lucide-react";

export const metadata = {
  title: "Design System & Theme QA | Business Hub",
  description: "Visual quality assurance playground for the Business Hub centralized Web Design System.",
};

export default async function ThemePreviewPage() {
  const session = await getSession();
  const activeShop = resolveActiveShop(session);

  return (
    <AdminShell
      session={session}
      activeShop={activeShop}
      activeRoute="settings"
      title="Design System & Theme QA"
      subtitle="Visual playground to verify typography, color palettes, standard controls, and dark-mode compliance."
    >
      <div className="space-y-12 pb-16">
        
        {/* SECTION 1: TYPOGRAPHY */}
        <section className="bg-surface border border-border-soft rounded-[28px] p-6 sm:p-8 space-y-6 transition-colors duration-200">
          <div>
            <span className="eyebrow">Visual Tokens</span>
            <h2 className="text-xl font-black mt-1">1. Typography System</h2>
            <p className="text-xs text-text-secondary mt-1">Tuned relative to Google Fonts Outfit scale used in mobile APK.</p>
          </div>
          <hr className="border-border-soft" />
          
          <div className="grid gap-6">
            <div className="border-b border-border-soft pb-4">
              <span className="text-[10px] font-bold text-text-tertiary uppercase block mb-1">Display Text (bold, -0.03em)</span>
              <p className="text-4xl sm:text-5xl font-black text-text-primary tracking-tight">The quick brown fox jumps over the lazy dog</p>
            </div>
            
            <div className="border-b border-border-soft pb-4">
              <span className="text-[10px] font-bold text-text-tertiary uppercase block mb-1">H1 / Page Title (900 tracking-tight)</span>
              <h1 className="text-2xl sm:text-3xl font-[900] text-text-primary tracking-tight">Customer CRM & Udhaar Khata</h1>
            </div>

            <div className="border-b border-border-soft pb-4">
              <span className="text-[10px] font-bold text-text-tertiary uppercase block mb-1">H2 / Section Title (800)</span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-text-primary">Recorded launch-window decisions</h2>
            </div>

            <div className="border-b border-border-soft pb-4">
              <span className="text-[10px] font-bold text-text-tertiary uppercase block mb-1">H3 / Subheading (700)</span>
              <h3 className="text-base sm:text-lg font-bold text-text-primary">Financial Intelligence & Reports</h3>
            </div>

            <div className="border-b border-border-soft pb-4">
              <span className="text-[10px] font-bold text-text-tertiary uppercase block mb-1">Body Large (16px)</span>
              <p className="text-base text-text-secondary font-medium">Record new stock purchases, update inventory cost prices, and manage pending invoices.</p>
            </div>

            <div className="border-b border-border-soft pb-4">
              <span className="text-[10px] font-bold text-text-tertiary uppercase block mb-1">Body Normal (14px)</span>
              <p className="text-sm text-text-secondary">Track staff shifts, check-in timestamps, working hours, and leave records dynamically.</p>
            </div>

            <div className="border-b border-border-soft pb-4">
              <span className="text-[10px] font-bold text-text-tertiary uppercase block mb-1">Body Small / Caption (12px)</span>
              <p className="text-xs text-text-tertiary">Real-time POS sync active. Currency: INR. Timezone: Asia/Kolkata.</p>
            </div>

            <div>
              <span className="text-[10px] font-bold text-text-tertiary uppercase block mb-1">Eyebrow / Small Uppercase Bold (10px, 0.12em letter spacing)</span>
              <span className="eyebrow">Operator feedback</span>
            </div>
          </div>
        </section>

        {/* SECTION 2: COLORS */}
        <section className="bg-surface border border-border-soft rounded-[28px] p-6 sm:p-8 space-y-6 transition-colors duration-200">
          <div>
            <span className="eyebrow">Visual Tokens</span>
            <h2 className="text-xl font-black mt-1">2. Color Palettes</h2>
            <p className="text-xs text-text-secondary mt-1">Theme-aware brand, semantic, and neutral variables.</p>
          </div>
          <hr className="border-border-soft" />

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-4 rounded-2xl bg-primary text-white flex flex-col justify-between h-24">
              <span className="text-xs font-black">Primary</span>
              <span className="text-[10px] font-mono opacity-85">--primary</span>
            </div>
            <div className="p-4 rounded-2xl bg-accent text-white flex flex-col justify-between h-24">
              <span className="text-xs font-black">Accent</span>
              <span className="text-[10px] font-mono opacity-85">--accent</span>
            </div>
            <div className="p-4 rounded-2xl bg-success text-white flex flex-col justify-between h-24">
              <span className="text-xs font-black">Success</span>
              <span className="text-[10px] font-mono opacity-85">--success</span>
            </div>
            <div className="p-4 rounded-2xl bg-warning text-white flex flex-col justify-between h-24">
              <span className="text-xs font-black">Warning</span>
              <span className="text-[10px] font-mono opacity-85">--warning</span>
            </div>
            <div className="p-4 rounded-2xl bg-error text-white flex flex-col justify-between h-24">
              <span className="text-xs font-black">Error</span>
              <span className="text-[10px] font-mono opacity-85">--error</span>
            </div>
            <div className="p-4 rounded-2xl bg-info text-white flex flex-col justify-between h-24">
              <span className="text-xs font-black">Info</span>
              <span className="text-[10px] font-mono opacity-85">--info</span>
            </div>
            <div className="p-4 rounded-2xl bg-bg-app border border-border-soft text-text-primary flex flex-col justify-between h-24">
              <span className="text-xs font-black">App Bg</span>
              <span className="text-[10px] font-mono opacity-85">--bg-app</span>
            </div>
            <div className="p-4 rounded-2xl bg-bg-soft border border-border-soft text-text-primary flex flex-col justify-between h-24">
              <span className="text-xs font-black">Soft Bg</span>
              <span className="text-[10px] font-mono opacity-85">--bg-soft</span>
            </div>
            <div className="p-4 rounded-2xl bg-surface border border-border-soft text-text-primary flex flex-col justify-between h-24">
              <span className="text-xs font-black">Surface</span>
              <span className="text-[10px] font-mono opacity-85">--surface</span>
            </div>
            <div className="p-4 rounded-2xl bg-surface-strong border border-border-soft text-text-primary flex flex-col justify-between h-24">
              <span className="text-xs font-black">Surface Strong</span>
              <span className="text-[10px] font-mono opacity-85">--surface-strong</span>
            </div>
          </div>
        </section>

        {/* SECTION 3: BUTTONS & INPUTS */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Actions */}
          <div className="bg-surface border border-border-soft rounded-[28px] p-6 sm:p-8 space-y-6 transition-colors duration-200">
            <div>
              <span className="eyebrow">Interaction</span>
              <h2 className="text-xl font-black mt-1">3. Buttons & Actions</h2>
            </div>
            <hr className="border-border-soft" />
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary">Primary Button</button>
              <button className="btn-secondary">Secondary Button</button>
              <button className="btn-ghost">Ghost Button</button>
              <button className="btn-primary" disabled>Disabled Action</button>
            </div>
          </div>

          {/* Form inputs */}
          <div className="bg-surface border border-border-soft rounded-[28px] p-6 sm:p-8 space-y-6 transition-colors duration-200">
            <div>
              <span className="eyebrow">Controls</span>
              <h2 className="text-xl font-black mt-1">4. Form Inputs</h2>
            </div>
            <hr className="border-border-soft" />
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-text-tertiary" />
                <input 
                  type="text" 
                  placeholder="Search by product name, SKU, or barcode..." 
                  className="input pl-11" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <select className="input">
                  <option>Select Option #1</option>
                  <option>Select Option #2</option>
                </select>
                <input type="number" placeholder="Enter amount..." className="input" />
              </div>
              
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-text-primary">
                  <input type="checkbox" className="w-4 h-4 accent-primary rounded" defaultChecked />
                  <span>Checkbox</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-text-primary">
                  <input type="radio" name="demo-radio" className="w-4 h-4 accent-primary" defaultChecked />
                  <span>Radio Option</span>
                </label>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4: CONTAINERS & BADGES */}
        <section className="grid gap-6 md:grid-cols-3">
          {/* Card Styles */}
          <div className="bg-surface border border-border-soft rounded-[28px] p-6 space-y-4 transition-colors duration-200">
            <span className="eyebrow">Container Elevation</span>
            <div className="p-4 panel bg-surface border border-border-soft text-sm text-text-primary">
              Standard Panel Class (.panel)
            </div>
            <div className="p-4 panel-soft text-sm text-text-primary">
              Soft Panel Class (.panel-soft)
            </div>
            <div className="p-4 panel-strong text-sm text-text-primary">
              Strong Panel Class (.panel-strong)
            </div>
          </div>

          {/* Badges */}
          <div className="bg-surface border border-border-soft rounded-[28px] p-6 space-y-4 transition-colors duration-200">
            <span className="eyebrow">Status Indicators</span>
            <h3 className="text-base font-bold">Standard Badge Types</h3>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="badge badge-primary">Primary Status</span>
              <span className="badge badge-success">Success / Verified</span>
              <span className="badge badge-warning">Warning / Hold</span>
              <span className="badge badge-error">Danger / High Risk</span>
              <span className="badge badge-neutral">Neutral System</span>
            </div>
          </div>

          {/* Loading Skeletons */}
          <div className="bg-surface border border-border-soft rounded-[28px] p-6 space-y-4 transition-colors duration-200">
            <span className="eyebrow">Loading States</span>
            <h3 className="text-base font-bold">Skeleton Loaders</h3>
            <div className="space-y-3 pt-2">
              <div className="h-4 bg-bg-soft animate-pulse rounded-md w-3/4" />
              <div className="h-3 bg-bg-soft animate-pulse rounded-md w-full" />
              <div className="h-3 bg-bg-soft animate-pulse rounded-md w-5/6" />
              <div className="flex gap-2 pt-2">
                <div className="w-8 h-8 rounded-full bg-bg-soft animate-pulse" />
                <div className="h-8 bg-bg-soft animate-pulse rounded-xl flex-1" />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5: FEEDBACK ALERTS */}
        <section className="bg-surface border border-border-soft rounded-[28px] p-6 sm:p-8 space-y-6 transition-colors duration-200">
          <div>
            <span className="eyebrow">System Messages</span>
            <h2 className="text-xl font-black mt-1">5. Feedback & Alerts</h2>
          </div>
          <hr className="border-border-soft" />
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-start gap-2.5">
              <Check className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-black">Success State</p>
                <p className="font-medium opacity-90 mt-0.5">Checkout transaction completed successfully. Invoice #INV-8372 saved.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-black">Warning Alert</p>
                <p className="font-medium opacity-90 mt-0.5">Low stock limit reached for 4 inventory items. Please restock soon.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-start gap-2.5">
              <XOctagon className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-black">Error Message</p>
                <p className="font-medium opacity-90 mt-0.5">Could not authenticate payment. Please verify UPI transaction details.</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-[#0EA5E9]/10 border border-[#0EA5E9]/20 text-[#0284C7] dark:text-[#38BDF8] text-xs font-bold flex items-start gap-2.5">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-black">Information Message</p>
                <p className="font-medium opacity-90 mt-0.5">Platform backup completes automatically every night. Data encryption active.</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6: TABLES */}
        <section className="bg-surface border border-border-soft rounded-[28px] p-6 sm:p-8 space-y-6 transition-colors duration-200">
          <div>
            <span className="eyebrow">Data Presentation</span>
            <h2 className="text-xl font-black mt-1">6. Tables & Lists</h2>
          </div>
          <hr className="border-border-soft" />

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>Stock Status</th>
                  <th>Cost Price</th>
                  <th>Selling Price</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <p className="font-bold text-text-primary">Premium Basmati Rice</p>
                    <p className="text-[10px] font-mono text-text-tertiary mt-0.5">SKU: RICE-BAS-01</p>
                  </td>
                  <td>
                    <span className="badge badge-success">In Stock</span>
                  </td>
                  <td className="font-medium text-text-secondary">₹85.00</td>
                  <td className="font-extrabold text-primary">₹110.00</td>
                  <td>
                    <button className="p-1.5 rounded-lg hover:bg-bg-soft text-text-secondary hover:text-primary transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                <tr>
                  <td>
                    <p className="font-bold text-text-primary">Refined Sunflower Oil</p>
                    <p className="text-[10px] font-mono text-text-tertiary mt-0.5">SKU: OIL-SUN-02</p>
                  </td>
                  <td>
                    <span className="badge badge-warning">Low Stock</span>
                  </td>
                  <td className="font-medium text-text-secondary">₹140.00</td>
                  <td className="font-extrabold text-primary">₹175.00</td>
                  <td>
                    <button className="p-1.5 rounded-lg hover:bg-bg-soft text-text-secondary hover:text-primary transition-colors">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </AdminShell>
  );
}
