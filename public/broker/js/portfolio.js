// Broker Customer Portfolio JS

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Links Wireup
  document.querySelectorAll('nav a').forEach(a => {
    const path = a.getAttribute('data-path');
    if (path === 'priority-queue') a.href = '/broker/';
    else if (path === 'customer-portfolio') a.href = '/broker/portfolio.html';
    else if (path === 'analytics-trends' || path === 'analytics-and-trends') a.href = '/broker/analytics.html';
    else if (path === 'pre-call-brief') a.href = '/broker/#brief';
    else if (path === 'pdpa-audit-log') a.href = '/broker/audit-log.html';
  });

  if (window.injectRoleSwitcher) window.injectRoleSwitcher('broker');

  const searchInput = document.querySelector('input[placeholder*="Search client"], input[type="text"]');

  async function loadPortfolio(search = '') {
    try {
      const data = await api.get(`/api/broker/portfolio?search=${encodeURIComponent(search)}`);
      console.log('Loaded portfolio clients:', data.customers.length);
    } catch (err) {
      console.warn('Portfolio load error:', err);
    }
  }

  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadPortfolio(e.target.value.trim());
      }, 300);
    });
  }

  loadPortfolio();
});
