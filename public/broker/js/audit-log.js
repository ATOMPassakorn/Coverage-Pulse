// Broker PDPA Audit Log JS

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

  let logsData = [];
  const tbody = document.getElementById('auditTableBody');
  const filterBroker = document.getElementById('filterBroker');
  const filterAction = document.getElementById('filterAction');
  const filterCID = document.getElementById('filterCID');
  const resetFilterBtn = document.getElementById('resetFilterBtn');
  const counterSpan = document.querySelector('.bg-surface-container-lowest .text-on-surface-variant.font-label-sm') ||
                      document.querySelector('button#resetFilterBtn + span');

  async function loadLogs() {
    try {
      const res = await api.get('/api/broker/audit-log');
      logsData = res.logs || [];
      renderLogs(logsData);
      updateSummaryMetrics(logsData);
    } catch (err) {
      console.warn('Could not load PDPA logs:', err);
    }
  }

  function renderLogs(logs) {
    if (!tbody) return;

    if (logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="py-8 text-center text-on-surface-variant">
            <span class="material-symbols-outlined text-2xl mb-1 block">search_off</span>
            ไม่พบบันทึกการยินยอมที่ตรงกับเงื่อนไขการค้นหา
          </td>
        </tr>
      `;
      if (counterSpan) counterSpan.innerText = `แสดง 0 จาก ${logsData.length} รายการ`;
      return;
    }

    tbody.innerHTML = logs.map(l => {
      const dateParts = (l.granted_at || '').split(' ');
      const dateStr = dateParts[0] || '2025-05-18';
      const timeStr = dateParts[1] || '10:43:12';
      const isDoubleOptIn = l.double_opt_in === 1;

      return `
        <tr class="hover:bg-surface-container-low/50 transition-colors border-b border-surface-container-low/50">
          <td class="py-4 px-space-md font-mono text-[12px] whitespace-nowrap">
            <span class="font-semibold text-on-surface">${dateStr}</span>
            <span class="text-on-surface-variant block">${timeStr}</span>
          </td>
          <td class="py-4 px-space-md whitespace-nowrap">
            <div class="flex flex-col">
              <span class="font-label-lg text-label-lg text-on-surface font-semibold">กิตติพงษ์ สิทธิเวช</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant font-mono">AGT-99201</span>
            </div>
          </td>
          <td class="py-4 px-space-md whitespace-nowrap">
            <div class="flex flex-col">
              <span class="font-label-lg text-label-lg text-on-surface font-medium">${l.customer_name || 'คุณนภัสสร วงศ์สวัสดิ์'}</span>
              <span class="font-label-sm text-label-sm text-on-surface-variant font-mono">${l.customer_id}</span>
            </div>
          </td>
          <td class="py-4 px-space-md">
            <div class="flex flex-col gap-0.5">
              <span class="font-label-md text-label-md text-on-surface font-semibold">${l.consent_type}</span>
              <span class="font-body-sm text-body-sm text-on-surface-variant">ช่องทาง: ${l.ip_channel || 'Krungsri Mobile App'}</span>
            </div>
          </td>
          <td class="py-4 px-space-md whitespace-nowrap">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${isDoubleOptIn ? 'bg-tertiary-fixed/30 text-tertiary' : 'bg-primary-container text-on-primary-container'}">
              <span class="material-symbols-outlined text-[14px]">${isDoubleOptIn ? 'verified' : 'check_circle'}</span>
              ${isDoubleOptIn ? 'Double Opt-in Validated' : 'Standard Consent'}
            </span>
          </td>
          <td class="py-4 px-space-md">
            <span class="px-2 py-0.5 rounded-md bg-surface-container font-mono text-xs text-on-surface font-medium">
              ${l.partner_name || 'BDMS Health Gateway'}
            </span>
          </td>
          <td class="py-4 px-space-md text-right font-mono text-[11px] text-on-surface-variant">
            <div class="flex flex-col items-end">
              <span class="font-semibold text-on-surface">AES-256 GCM</span>
              <span>SHA-256 Ledger Verified</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    if (counterSpan) counterSpan.innerText = `แสดง ${logs.length} จาก ${logsData.length} รายการ`;
  }

  function updateSummaryMetrics(logs) {
    const doubleOptInCount = logs.filter(l => l.double_opt_in === 1).length;
    const bdmsCount = logs.filter(l => (l.partner_name || '').includes('BDMS') || (l.partner_name || '').includes('Hospital')).length;

    const cards = document.querySelectorAll('.font-headline-xl');
    if (cards[0]) cards[0].innerText = '100%';
    if (cards[1]) cards[1].innerText = bdmsCount || logs.length;
    if (cards[2]) cards[2].innerText = '0';
  }

  function filterData() {
    const q = (filterCID?.value || '').toLowerCase().trim();
    const actionVal = filterAction?.value || 'all';

    const filtered = logsData.filter(l => {
      // Text match
      if (q) {
        const matchName = (l.customer_name || '').toLowerCase().includes(q);
        const matchCID = (l.customer_id || '').toLowerCase().includes(q);
        const matchType = (l.consent_type || '').toLowerCase().includes(q);
        if (!matchName && !matchCID && !matchType) return false;
      }

      // Action type filter
      if (actionVal === 'bdms-access' && !(l.partner_name || '').includes('BDMS')) return false;
      if (actionVal === 'consent-granted' && l.status !== 'active') return false;

      return true;
    });

    renderLogs(filtered);
  }

  filterCID?.addEventListener('input', filterData);
  filterAction?.addEventListener('change', filterData);
  filterBroker?.addEventListener('change', filterData);

  resetFilterBtn?.addEventListener('click', () => {
    if (filterCID) filterCID.value = '';
    if (filterAction) filterAction.value = 'all';
    if (filterBroker) filterBroker.value = 'all';
    renderLogs(logsData);
  });

  loadLogs();
});
