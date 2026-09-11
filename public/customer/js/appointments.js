// Customer Broker Queue & Appointment Tracker JS

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Links Wireup
  document.querySelectorAll('nav a').forEach(a => {
    const path = a.getAttribute('data-path');
    if (path === 'customer-portal') a.href = '/customer/';
    else if (path === 'self-assessment-wizard') a.href = '/customer/assessment.html';
    else if (path === 'ai-coverage-sandbox') a.href = '/customer/sandbox.html';
    else if (path === 'broker-queue') a.href = '/customer/appointments.html';
  });

  if (window.injectRoleSwitcher) window.injectRoleSwitcher('customer');

  // Load appointments from API
  try {
    const res = await api.get('/api/customer/appointments/CUST-001');
    if (res.leads && res.leads.length > 0) {
      const latest = res.leads[0];
      // Update appointment date & time in UI if found
      const apptDisplay = document.getElementById('latest-appointment-time');
      if (apptDisplay) {
        apptDisplay.innerText = `${latest.preferred_date || 'พรุ่งนี้'} • ${latest.preferred_time || '14:00 - 15:00 น.'}`;
      }
    }
  } catch (err) {
    console.warn('Could not fetch appointments:', err);
  }

  // Interactive Reschedule Button
  const rescheduleBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('เปลี่ยนเวลานัด'));
  if (rescheduleBtn) {
    rescheduleBtn.addEventListener('click', () => {
      const newTime = prompt('ระบุวันและเวลาใหม่ที่สะดวกรับสาย (เช่น พรุ่งนี้ 15:30 น.):', 'วันพรุ่งนี้ 15:30 น.');
      if (newTime) {
        showToast('อัปเดตเวลานัดหมายใหม่เป็น: ' + newTime, 'success');
      }
    });
  }
});
