// Shared Frontend Utility for Coverage Pulse

const API_BASE = '';

const api = {
  async get(endpoint) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error(`API GET error on ${endpoint}:`, err);
      showToast(err.message, 'error');
      throw err;
    }
  },

  async post(endpoint, data = {}) {
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (err) {
      console.error(`API POST error on ${endpoint}:`, err);
      showToast(err.message, 'error');
      throw err;
    }
  }
};

function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    info: 'bg-primary-container text-on-primary-container font-semibold',
    warning: 'bg-amber-500 text-white'
  };

  toast.className = `px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm transition-all duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.success}`;
  
  const icon = type === 'error' ? 'error' : type === 'info' ? 'info' : type === 'warning' ? 'warning' : 'check_circle';
  toast.innerHTML = `<span class="material-symbols-outlined text-[20px]">${icon}</span><span>${message}</span>`;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Add Floating Switcher to easily jump between Customer and Broker portals
function injectRoleSwitcher(activeRole = 'customer') {
  const switcher = document.createElement('div');
  switcher.className = 'fixed bottom-6 left-6 z-50 flex items-center gap-1.5 p-1.5 rounded-full bg-surface-container-lowest/90 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-outline-variant/30 text-xs font-semibold';
  switcher.innerHTML = `
    <span class="px-2.5 py-1 text-on-surface-variant font-medium flex items-center gap-1">
      <span class="w-2 h-2 rounded-full bg-primary-container animate-pulse"></span> โหมด:
    </span>
    <a href="/customer/" class="px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${activeRole === 'customer' ? 'bg-primary-container text-on-primary-container font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
      <span class="material-symbols-outlined text-[15px]">person</span> ลูกค้า (Customer)
    </a>
    <a href="/broker/" class="px-3 py-1.5 rounded-full transition-all flex items-center gap-1 ${activeRole === 'broker' ? 'bg-inverse-surface text-inverse-on-surface font-bold shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}">
      <span class="material-symbols-outlined text-[15px]">badge</span> โบรกเกอร์ (Broker)
    </a>
    <a href="/" title="กลับหน้าเลือกระบบหลัก" class="w-7 h-7 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all">
      <span class="material-symbols-outlined text-[16px]">home</span>
    </a>
  `;
  document.body.appendChild(switcher);
}

window.api = api;
window.showToast = showToast;
window.injectRoleSwitcher = injectRoleSwitcher;
