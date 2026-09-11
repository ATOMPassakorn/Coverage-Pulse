// Customer Self-Service Assessment JS

document.addEventListener('DOMContentLoaded', () => {
  // Navigation Links Wireup
  document.querySelectorAll('nav a').forEach(a => {
    const path = a.getAttribute('data-path');
    if (path === 'customer-portal') a.href = '/customer/';
    else if (path === 'self-assessment-wizard') a.href = '/customer/assessment.html';
    else if (path === 'ai-coverage-sandbox') a.href = '/customer/sandbox.html';
    else if (path === 'broker-queue') a.href = '/customer/appointments.html';
  });

  // Inject floating role switcher
  if (window.injectRoleSwitcher) window.injectRoleSwitcher('customer');

  // Submit button
  const submitBtn = Array.from(document.querySelectorAll('button')).find(b => 
    b.innerText.includes('คำนวณแบตเตอรี่') || b.innerText.includes('ดูผลลัพธ์')
  );

  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      submitBtn.disabled = true;
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = `
        <span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
        <span>กำลังประมวลผล Relevance Engine...</span>
      `;

      try {
        const payload = {
          customerId: 'CUST-001',
          tier1Profile: {
            age: 32,
            family_status: 'แต่งงานแล้ว ตั้งครรภ์ไตรมาสที่ 2',
            occupation: 'Marketing Director',
            income_bracket: '80,000 - 150,000 บาท/เดือน'
          },
          tier2Categories: {
            health_ci: { has_insurance: 'no', feeling: 'worried' },
            savings: { target: 'ทุนการศึกษาบุตรและลดหย่อนภาษี', monthly_budget: '5,000 - 10,000 บ.' }
          }
        };

        const response = await api.post('/api/customer/assessment', payload);
        const res = response.result;

        // Show Results Modal
        showAssessmentResultModal(res);
      } catch (err) {
        showToast('เกิดข้อผิดพลาดในการคำนวณ: ' + err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
});

function showAssessmentResultModal(result) {
  let modal = document.getElementById('assessment-result-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'assessment-result-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all duration-300';
    document.body.appendChild(modal);
  }

  const isCritical = result.battery_score < 50;
  const isReview = result.battery_score >= 50 && result.battery_score < 80;
  const statusColor = isCritical ? 'text-red-500' : isReview ? 'text-amber-500' : 'text-emerald-500';
  const statusBg = isCritical ? 'bg-red-50 border-red-200' : isReview ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';
  const statusText = isCritical ? 'ระดับวิกฤต (Coverage Blindspots Detected)' : isReview ? 'ควรทบทวน (Review Needed)' : 'ระดับเหมาะสม (Optimal)';

  modal.innerHTML = `
    <div class="bg-surface-container-lowest rounded-2xl max-w-xl w-full p-8 shadow-2xl border border-surface-container-high transform scale-95 transition-transform animate-in fade-in zoom-in-95">
      <div class="flex items-center justify-between pb-4 border-b border-surface-container">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center font-bold text-on-primary-container">
            <span class="material-symbols-outlined text-xl">speed</span>
          </div>
          <div>
            <h3 class="font-bold text-lg text-on-surface">ผลลัพธ์ชีพจรความคุ้มครอง (Pulse Score)</h3>
            <p class="text-xs text-on-surface-variant">Relevance Engine Version 2.4</p>
          </div>
        </div>
        <button onclick="document.getElementById('assessment-result-modal').remove()" class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container">
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <div class="my-6 p-6 rounded-2xl ${statusBg} border flex items-center justify-between">
        <div>
          <span class="text-xs font-semibold uppercase tracking-wider ${statusColor}">สถานะสุขภาพกรมธรรม์</span>
          <h2 class="text-2xl font-bold ${statusColor} mt-0.5">${statusText}</h2>
          <p class="text-xs text-on-surface-variant mt-1">อ้างอิงจากบริบทครอบครัวและเหตุการณ์ชีวิตล่าสุด</p>
        </div>
        <div class="text-right">
          <div class="text-5xl font-black ${statusColor} tabular-nums">${result.battery_score}%</div>
          <span class="text-xs font-medium text-on-surface-variant">Battery Health</span>
        </div>
      </div>

      <div class="space-y-4 mb-6">
        <h4 class="text-xs font-bold uppercase tracking-wider text-on-surface-variant">จุดเปราะบางที่ตรวจพบ (Coverage Gaps):</h4>
        <div class="space-y-2">
          ${result.reasons.map(r => `
            <div class="flex items-start gap-2.5 p-3 rounded-xl bg-surface-container-low text-xs text-on-surface">
              <span class="material-symbols-outlined text-amber-600 text-base shrink-0 mt-0.5">priority_high</span>
              <span>${r}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 pt-2">
        <button onclick="document.getElementById('assessment-result-modal').remove()" class="flex-1 py-3 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors">
          ปรับแต่งคำตอบใหม่อีกครั้ง
        </button>
        <a href="/customer/sandbox.html" class="flex-1 py-3 px-4 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold flex items-center justify-center gap-2 shadow-md transition-all">
          <span>ทดลองเติมแบตเตอรี่ใน Sandbox</span>
          <span class="material-symbols-outlined text-base">arrow_forward</span>
        </a>
      </div>
    </div>
  `;
}
