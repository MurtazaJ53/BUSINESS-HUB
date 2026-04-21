/**
 * Minimalist Toast Utility
 * Simple global feedback for elite UI.
 */

export const showToast = (message: string, isError = false) => {
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `
    animate-in slide-in-from-bottom-2 fade-in duration-300
    px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl backdrop-blur-xl border
    ${isError 
      ? 'bg-red-500/10 border-red-500/20 text-red-500' 
      : 'bg-primary/10 border-primary/20 text-primary'}
  `;
  toast.textContent = message;

  container.appendChild(toast);

  // Remove toast after delay
  setTimeout(() => {
    toast.classList.add('animate-out', 'fade-out', 'slide-out-to-bottom-2');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};
