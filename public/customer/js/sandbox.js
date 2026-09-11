// Customer AI Coverage Chat & Sandbox JS

document.addEventListener('DOMContentLoaded', () => {
  // Navigation Links Wireup
  document.querySelectorAll('nav a').forEach(a => {
    const path = a.getAttribute('data-path');
    if (path === 'customer-portal') a.href = '/customer/';
    else if (path === 'self-assessment-wizard') a.href = '/customer/assessment.html';
    else if (path === 'ai-coverage-sandbox') a.href = '/customer/sandbox.html';
    else if (path === 'broker-queue') a.href = '/customer/appointments.html';
  });

  if (window.injectRoleSwitcher) window.injectRoleSwitcher('customer');

  // Interactive Battery State
  let currentCustomerId = 'CUST-001';
  let activeRiders = [
    { id: 'opd', name: 'OPD เหมาจ่าย 2,000 บ./ครั้ง', boost: 15 },
    { id: 'ci', name: 'โรคร้ายแรงเงินก้อน 1,000,000 บ.', boost: 22 }
  ];

  const scoreDisplay = document.querySelector('.text-display-lg, .text-5xl, h2.font-bold') || document.getElementById('battery-score-num');
  const batteryBar = document.getElementById('battery-progress-bar') || document.querySelector('.bg-primary-container.h-full');

  // Recalculate and update battery UI
  async function updateBatterySimulation() {
    try {
      const res = await api.post('/api/customer/sandbox/simulate', {
        customerId: currentCustomerId,
        addedRiders: activeRiders
      });

      // Update score elements in DOM
      document.querySelectorAll('.font-display-lg, .text-display-lg').forEach(el => {
        if (el.innerText.includes('%') || !isNaN(parseInt(el.innerText))) {
          el.innerText = `${res.simulatedScore}%`;
        }
      });

      // Update battery bar
      const fillBar = document.querySelector('.h-3 .bg-primary-container, .h-4 .bg-primary-container, [style*="width:"]');
      if (fillBar) {
        fillBar.style.width = `${res.simulatedScore}%`;
        if (res.simulatedScore >= 80) {
          fillBar.className = fillBar.className.replace(/bg-\w+-container|bg-\w+/, 'bg-emerald-500');
        } else if (res.simulatedScore >= 50) {
          fillBar.className = fillBar.className.replace(/bg-\w+-container|bg-\w+/, 'bg-amber-400');
        } else {
          fillBar.className = fillBar.className.replace(/bg-\w+-container|bg-\w+/, 'bg-rose-500');
        }
      }
    } catch (err) {
      console.warn('Simulation update failed:', err);
    }
  }

  // Interactive Coverage Blocks Toggle
  const blockItems = document.querySelectorAll('.grid-cols-1 .group, .space-y-3 .p-4, [data-rider-id]');
  blockItems.forEach(item => {
    item.addEventListener('click', (e) => {
      // Toggle rider active state
      item.classList.toggle('ring-2');
      item.classList.toggle('ring-primary-container');
      item.classList.toggle('bg-amber-50/50');
      
      const checkMark = item.querySelector('.material-symbols-outlined');
      if (checkMark && (checkMark.innerText === 'check' || checkMark.innerText === 'add')) {
        checkMark.innerText = checkMark.innerText === 'check' ? 'add' : 'check';
      }

      updateBatterySimulation();
      showToast('ปรับปรุงระดับแบตเตอรี่ความคุ้มครองเรียลไทม์แล้ว', 'info');
    });
  });

  // AI Chat Copilot Integration
  const chatForm = document.getElementById('ai-chat-form');
  const chatInput = chatForm ? chatForm.querySelector('input') : null;
  const chatStream = document.getElementById('chat-stream');
  let chatHistory = [];

  async function sendChatMessage(userText) {
    if (!userText || !userText.trim()) return;

    // Append user message to UI
    const timeNow = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const userMsgHtml = `
      <div class="flex items-start justify-end gap-3 animate-in fade-in">
        <div class="max-w-[85%] space-y-1 text-right">
          <div class="bg-primary-container p-3.5 rounded-2xl rounded-tr-sm text-on-primary-container shadow-sm text-left">
            <p class="font-body-md text-body-md">${userText}</p>
          </div>
          <span class="font-label-sm text-label-sm text-on-surface-variant pr-2">${timeNow} น.</span>
        </div>
      </div>
    `;
    chatStream.insertAdjacentHTML('beforeend', userMsgHtml);
    chatStream.scrollTop = chatStream.scrollHeight;

    chatHistory.push({ role: 'user', content: userText });

    // Append loading placeholder
    const loadingId = 'ai-loading-' + Date.now();
    const loadingHtml = `
      <div id="${loadingId}" class="flex items-start gap-3 animate-pulse">
        <div class="w-8 h-8 rounded-full bg-primary-container shrink-0 flex items-center justify-center text-on-primary-container mt-1">
          <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
        </div>
        <div class="bg-surface-container-low p-4 rounded-2xl text-xs text-on-surface-variant">
          Coverage Pulse AI กำลังวิเคราะห์ข้อมูลความคุ้มครอง...
        </div>
      </div>
    `;
    chatStream.insertAdjacentHTML('beforeend', loadingHtml);
    chatStream.scrollTop = chatStream.scrollHeight;

    try {
      const data = await api.post('/api/ai/chat', {
        messages: chatHistory,
        customerId: currentCustomerId
      });

      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) loadingEl.remove();

      const aiReply = data.reply;
      chatHistory.push({ role: 'assistant', content: aiReply });

      const aiMsgHtml = `
        <div class="flex items-start gap-3 animate-in fade-in">
          <div class="w-8 h-8 rounded-full bg-primary-container shrink-0 flex items-center justify-center text-on-primary-container mt-1 shadow-sm">
            <span class="material-symbols-outlined text-[18px]">auto_awesome</span>
          </div>
          <div class="space-y-2 max-w-[88%]">
            <div class="bg-surface-container-low p-4 rounded-2xl rounded-tl-sm text-on-surface shadow-sm leading-relaxed text-sm">
              ${aiReply.replace(/\n/g, '<br>')}
            </div>
            <span class="font-label-sm text-label-sm text-on-surface-variant pl-2">${timeNow} น. • ขับเคลื่อนโดย Ollama qwen2.5</span>
          </div>
        </div>
      `;
      chatStream.insertAdjacentHTML('beforeend', aiMsgHtml);
      chatStream.scrollTop = chatStream.scrollHeight;
    } catch (err) {
      const loadingEl = document.getElementById(loadingId);
      if (loadingEl) loadingEl.remove();
      showToast('ไม่สามารถเชื่อมต่อ AI ได้ในขณะนี้: ' + err.message, 'error');
    }
  }

  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      sendChatMessage(text);
    });
  }

  // Quick Prompt Action Pills
  document.querySelectorAll('.overflow-x-auto button, .no-scrollbar button').forEach(pill => {
    pill.addEventListener('click', () => {
      const text = pill.innerText.replace(/^[💡💰🏥]\s*/, '').trim();
      sendChatMessage(text);
    });
  });

  // "อยากคุย" (Send Warm Lead) Button Click
  const warmLeadBtn = Array.from(document.querySelectorAll('button')).find(b => 
    b.innerText.includes('อยากคุย') || b.innerText.includes('ส่งแผนจำลองนี้ให้ Broker')
  );

  if (warmLeadBtn) {
    warmLeadBtn.addEventListener('click', () => {
      openWarmLeadModal();
    });
  }
});

function openWarmLeadModal() {
  let modal = document.getElementById('warm-lead-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'warm-lead-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-all';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="bg-surface-container-lowest rounded-2xl max-w-lg w-full p-8 shadow-2xl border border-surface-container-high animate-in fade-in zoom-in-95">
      <div class="flex items-center justify-between pb-4 border-b border-surface-container">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary-container flex items-center justify-center text-on-primary-container font-bold">
            <span class="material-symbols-outlined text-2xl">bolt</span>
          </div>
          <div>
            <h3 class="font-bold text-lg text-on-surface">ส่งสัญญาณ "อยากคุย" (Warm Lead)</h3>
            <p class="text-xs text-on-surface-variant">นัดหมายที่ปรึกษาผู้เชี่ยวชาญ Krungsri Certified Advisor</p>
          </div>
        </div>
        <button onclick="document.getElementById('warm-lead-modal').remove()" class="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container">
          <span class="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      <div class="my-5 space-y-4">
        <div class="p-4 rounded-xl bg-surface-container-low text-xs text-on-surface space-y-1.5">
          <div class="font-semibold flex items-center gap-1.5 text-primary">
            <span class="material-symbols-outlined text-base">verified</span>
            <span>ที่ปรึกษาที่ดูแลคุณ: กิตติพงษ์ สิทธิเวช</span>
          </div>
          <p class="text-on-surface-variant leading-relaxed">
            ระบบจะส่งสรุปผลการจัดแผนจาก Sandbox นี้ พร้อมข้อมูลความจำเป็นของคุณไปเป็น Pre-call Brief เพื่อให้ที่ปรึกษาเตรียมข้อเสนอที่แม่นยำล่วงหน้า โดยไม่ต้องเสียเวลาตอบคำถามซ้ำ
          </p>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-on-surface">วันที่สะดวกรับการติดต่อ</label>
          <input type="date" id="lead-date" value="${new Date().toISOString().split('T')[0]}" class="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary">
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-on-surface">ช่วงเวลาที่สะดวก</label>
          <select id="lead-time" class="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary">
            <option value="10:00 - 11:30 น.">10:00 - 11:30 น. (เช้า)</option>
            <option value="13:30 - 15:00 น." selected>13:30 - 15:00 น. (บ่ายต้น)</option>
            <option value="15:30 - 17:00 น.">15:30 - 17:00 น. (บ่ายแก่)</option>
            <option value="17:30 - 19:00 น.">17:30 - 19:00 น. (หลังเลิกงาน)</option>
          </select>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs font-semibold text-on-surface">ข้อความเพิ่มเติมถึงที่ปรึกษา (ถ้ามี)</label>
          <textarea id="lead-notes" rows="2" placeholder="เช่น กังวลเรื่องค่าคลอดและ รพ. เครือข่ายแถวทองหล่อ" class="w-full px-4 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-primary"></textarea>
        </div>
      </div>

      <div class="flex gap-3 pt-2">
        <button onclick="document.getElementById('warm-lead-modal').remove()" class="flex-1 py-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface">
          ยกเลิก
        </button>
        <button id="confirm-lead-btn" class="flex-1 py-3 rounded-xl bg-primary-container hover:bg-primary-fixed-dim text-on-primary-container text-xs font-bold shadow-md flex items-center justify-center gap-1.5">
          <span class="material-symbols-outlined text-base">send</span>
          <span>ยืนยันส่งข้อมูล</span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('confirm-lead-btn').addEventListener('click', async () => {
    const btn = document.getElementById('confirm-lead-btn');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-base animate-spin">progress_activity</span> กำลังส่ง...`;

    try {
      const preferredDate = document.getElementById('lead-date').value;
      const preferredTime = document.getElementById('lead-time').value;
      const notes = document.getElementById('lead-notes').value;

      const res = await api.post('/api/customer/warm-lead', {
        customerId: 'CUST-001',
        intentDetails: ['OPD เหมาจ่าย 2,000 บ./ครั้ง', 'โรคร้ายแรงเงินก้อน 1,000,000 บ.', 'คุ้มครองค่าคลอดบุตร'],
        simulatedBattery: 92,
        preferredDate,
        preferredTime,
        notes
      });

      document.getElementById('warm-lead-modal').remove();
      showToast('ส่งคำขอปรึกษาสำเร็จ! ที่ปรึกษาจะติดต่อกลับตามเวลานัดหมาย', 'success');

      setTimeout(() => {
        window.location.href = '/customer/appointments.html';
      }, 1200);
    } catch (err) {
      showToast('ไม่สามารถส่งคำขอได้: ' + err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = 'ลองอีกครั้ง';
    }
  });
}
