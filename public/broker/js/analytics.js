// Broker Analytics & Trends JS

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

  try {
    const res = await api.get('/api/broker/analytics');
    console.log('Analytics data:', res);
  } catch (err) {
    console.warn('Analytics fetch warning:', err);
  }
});
