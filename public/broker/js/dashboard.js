// Broker Proactive Dashboard & Pre-call Brief JS

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Links Wireup
  document.querySelectorAll('nav a').forEach(a => {
    const path = a.getAttribute('data-path');
    if (path === 'priority-queue') a.href = '/broker/';
    else if (path === 'customer-portfolio') a.href = '/broker/portfolio.html';
    else if (path === 'analytics-trends') a.href = '/broker/analytics.html';
    else if (path === 'pre-call-brief') a.href = '/broker/#brief';
    else if (path === 'pdpa-audit-log') a.href = '/broker/audit-log.html';
  });

  if (window.injectRoleSwitcher) window.injectRoleSwitcher('broker');

  // Check URL param for cid
  const urlParams = new URLSearchParams(window.location.search);
  let selectedCustomerId = urlParams.get('cid') || 'CUST-001';
  let queueData = [];
  let currentFilter = 'all';
  let currentSearch = '';

  // Load Priority Queue from Backend
  async function loadPriorityQueue() {
    try {
      const data = await api.get('/api/broker/priority-queue');
      queueData = data.customers || [];

      // Update Bento numbers if available
      const statDisplays = document.querySelectorAll('.font-display-lg, .text-display-lg');
      if (statDisplays[0] && data.stats) statDisplays[0].innerText = data.stats.criticalCount;
      if (statDisplays[1] && data.stats) statDisplays[1].innerText = data.stats.warmLeadCount;

      applyFilterAndRender();
      loadPreCallBrief(selectedCustomerId);
    } catch (err) {
      console.error('Failed to load priority queue:', err);
    }
  }

  // Filter and render
  function applyFilterAndRender() {
    let filtered = queueData.filter(c => {
      // Search match
      if (currentSearch) {
        const s = currentSearch.toLowerCase();
        const matchName = (c.name || '').toLowerCase().includes(s);
        const matchId = (c.id || '').toLowerCase().includes(s);
        const matchPhone = (c.phone || '').includes(s);
        if (!matchName && !matchId && !matchPhone) return false;
      }

      // Pill filter
      if (currentFilter === 'critical') return c.battery_score < 50;
      if (currentFilter === 'review') return c.battery_score >= 50 && c.battery_score < 80;
      if (currentFilter === 'optimal') return c.battery_score >= 80;
      if (currentFilter === 'hospital') return (c.latest_event_source || '').toLowerCase().includes('hospital') || (c.latest_event_source || '').includes('รพ.') || (c.latest_event_source || '').includes('BDMS');
      if (currentFilter === 'family') return (c.family_status || '').includes('ครรภ์') || (c.family_status || '').includes('บุตร') || (c.family_status || '').includes('สมรส') || (c.family_status || '').includes('แต่งงาน');
      return true;
    });

    renderQueueList(filtered);
  }

  // Render rows
  function renderQueueList(customers) {
    const queueContainer = document.querySelector('.flex.flex-col.gap-space-sm, .space-y-3');
    if (!queueContainer) return;

    if (customers.length === 0) {
      queueContainer.innerHTML = `
        <div class="p-8 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl shadow-sm">
          <span class="material-symbols-outlined text-3xl mb-2 text-on-surface-variant">person_off</span>
          <p class="font-body-sm text-body-sm">ไม่พบลูกค้ารายการที่ตรงกับตัวกรอง</p>
        </div>
      `;
      return;
    }

    const html = customers.map(c => {
      const isSelected = c.id === selectedCustomerId;
      const isCritical = c.battery_status === 'critical' || c.battery_score < 50;
      const isReview = (c.battery_status === 'review' || (c.battery_score >= 50 && c.battery_score < 80));
      const batteryColor = isCritical ? 'text-error' : isReview ? 'text-amber-500' : 'text-tertiary';
      const barColor = isCritical ? 'bg-error' : isReview ? 'bg-amber-400' : 'bg-tertiary';

      return `
        <div data-customer-id="${c.id}" class="queue-row relative p-space-md rounded-xl ${isSelected ? 'bg-surface-container-low ring-2 ring-primary-container' : 'bg-surface-container-lowest hover:bg-surface-container-low'} transition-all duration-200 cursor-pointer shadow-sm">
          <div class="absolute left-0 top-0 bottom-0 w-1.5 ${barColor} rounded-l-xl"></div>
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-space-sm pl-space-xs">
            <div class="flex items-start gap-space-sm">
              <div class="relative w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex-shrink-0">
                <img class="w-full h-full object-cover" src="${c.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" alt="${c.name}">
              </div>
              <div>
                <div class="flex items-center gap-space-xs flex-wrap">
                  <span class="font-headline-md text-headline-md text-on-surface font-bold">${c.name}</span>
                  <span class="px-space-xs py-0.5 rounded-full bg-surface-container-highest text-on-surface font-label-sm text-label-sm">${c.age} ปี</span>
                  <span class="px-space-xs py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm font-semibold">${c.segment || 'Premier Wealth'}</span>
                  ${c.warm_lead_count > 0 ? `<span class="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed font-label-sm text-label-sm font-bold animate-pulse">⚡ Warm Lead</span>` : ''}
                </div>
                <div class="flex items-center gap-space-xs mt-1 text-on-surface-variant font-body-sm text-body-sm flex-wrap">
                  <span class="inline-flex items-center gap-1 text-on-surface font-label-sm text-label-sm font-medium">
                    <span class="material-symbols-outlined text-[16px] text-primary">priority_high</span>
                    ${c.latest_event_title || c.occupation || 'ทบทวนสิทธิประโยชน์'}
                  </span>
                  ${c.latest_event_source ? `<span>•</span><span class="font-label-sm text-label-sm text-tertiary">${c.latest_event_source}</span>` : ''}
                </div>
              </div>
            </div>

            <div class="flex items-center gap-space-md justify-between md:justify-end">
              <div class="flex flex-col items-end">
                <div class="flex items-center gap-1.5">
                  <div class="w-16 h-2 bg-surface-container rounded-full overflow-hidden">
                    <div class="h-full ${barColor}" style="width: ${c.battery_score}%"></div>
                  </div>
                  <span class="font-headline-md text-headline-md font-bold ${batteryColor} tabular-nums">${c.battery_score}%</span>
                </div>
                <span class="font-label-sm text-label-sm text-on-surface-variant mt-0.5">สถานะแบตเตอรี่</span>
              </div>
              <button class="select-brief-btn p-space-xs rounded-full bg-surface-container-high hover:bg-primary-container text-on-surface transition-colors flex items-center justify-center" title="เปิด Pre-call Brief">
                <span class="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    queueContainer.innerHTML = html;

    // Attach click listeners
    document.querySelectorAll('.queue-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-customer-id');
        if (id) {
          selectedCustomerId = id;
          document.querySelectorAll('.queue-row').forEach(r => {
            r.classList.remove('bg-surface-container-low', 'ring-2', 'ring-primary-container');
            r.classList.add('bg-surface-container-lowest');
          });
          row.classList.remove('bg-surface-container-lowest');
          row.classList.add('bg-surface-container-low', 'ring-2', 'ring-primary-container');
          loadPreCallBrief(selectedCustomerId);
        }
      });
    });
  }

  // Load and Render Pre-call Brief Details
  async function loadPreCallBrief(customerId) {
    try {
      const data = await api.get(`/api/broker/pre-call-brief/${customerId}`);
      const c = data.customer;

      // Update Header Info
      const cidTag = document.querySelector('.font-mono');
      if (cidTag) cidTag.innerText = `CID: ${c.id}`;

      // Update Customer Name & Persona in Brief
      const briefTitle = document.querySelector('#brief h2, .lg\\:col-span-5 h2');
      if (briefTitle && !briefTitle.innerText.includes('Pre-call')) {
        briefTitle.innerText = `${c.name} (${c.segment || 'Premier Wealth'})`;
      }

      // Update Section 1: Customer Trigger
      const triggerSection = document.querySelector('.bg-surface-container-low.p-space-md, [data-trigger-box]');
      if (triggerSection) {
        const latestEvent = data.lifeEvents && data.lifeEvents[0] ? data.lifeEvents[0] : null;
        triggerSection.innerHTML = `
          <div class="flex items-center justify-between mb-1">
            <span class="font-label-md text-label-md font-bold text-on-surface uppercase tracking-wider flex items-center gap-1.5">
              <span class="material-symbols-outlined text-primary text-[18px]">verified</span>
              Life-Event Trigger & ข้อมูลความเสี่ยง
            </span>
            <span class="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-primary-container font-semibold">${c.segment || 'Wealth'}</span>
          </div>
          <div class="flex flex-col gap-1.5 mt-2 font-body-sm text-body-sm text-on-surface">
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-tertiary text-[18px] flex-shrink-0 mt-0.5">event</span>
              <div>
                <span class="font-semibold text-on-surface">${latestEvent ? latestEvent.title : 'ทบทวนสิทธิประโยชน์ประจำปี'}</span>
                <span class="text-on-surface-variant block text-label-sm font-label-sm">${latestEvent ? `${latestEvent.description} • แหล่งที่มา: ${latestEvent.source}` : 'บริบททั่วไป'}</span>
              </div>
            </div>
            <div class="flex items-start gap-2 mt-1">
              <span class="material-symbols-outlined text-error text-[18px] flex-shrink-0 mt-0.5">health_and_safety</span>
              <div>
                <span class="font-semibold text-error">สถานะความคุ้มครอง:</span>
                <span class="text-on-surface-variant"> แบตเตอรี่ ${c.battery_score}% (${c.battery_status === 'critical' || c.battery_score < 50 ? 'ระดับวิกฤต' : 'ควรทบทวน'}) ขาดความคุ้มครองสำคัญ</span>
              </div>
            </div>
            ${c.battery_reasons && c.battery_reasons.length ? `
              <div class="mt-1 pl-6 space-y-1">
                ${c.battery_reasons.map(r => `<div class="text-[12px] text-on-surface-variant flex items-center gap-1">• ${r}</div>`).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }

      // Update Call Button
      const callBtn = document.querySelector('a[href^="tel:"]');
      if (callBtn) {
        callBtn.href = `tel:${c.phone || '081-445-9821'}`;
        const label = callBtn.querySelector('span:last-child');
        if (label) label.innerText = `เริ่มโทรออกหาคุณ${c.name.split(' ')[0]} (${c.phone || '081-445-9821'})`;
      }

      // Render NBA and Script
      renderAiBrief(c);

    } catch (err) {
      console.error('Failed to load pre-call brief:', err);
    }
  }

  // Render NBA and Script instantly from DB, with option to re-generate with Ollama
  function renderAiBrief(customer) {
    const nbaContainer = document.querySelector('.bg-primary-container\\/15, [data-nba-box]');
    const scriptContainer = document.getElementById('call-script-text');

    if (nbaContainer) {
      nbaContainer.innerHTML = `
        <div class="flex items-center justify-between mb-2">
          <span class="font-label-md text-label-md font-bold text-on-surface flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary text-[20px]">recommend</span>
            แผนแนะนำ Next-Best-Action (NBA)
          </span>
          <div class="flex items-center gap-1">
            <span class="px-space-xs py-0.5 rounded-full bg-primary-container text-on-primary-container font-label-sm text-label-sm font-bold">AI Verified</span>
            <button id="regen-ai-btn" class="px-2 py-0.5 rounded-full bg-surface-container-high hover:bg-surface-container text-on-surface font-label-sm text-label-sm flex items-center gap-1 transition-colors" title="ขอคำแนะนำสดใหม่จาก Ollama LLM">
              <span class="material-symbols-outlined text-[14px]">autorenew</span>
              <span>สดใหม่</span>
            </button>
          </div>
        </div>
        <div id="nba-content-box" class="mt-1 text-xs text-on-surface leading-relaxed whitespace-pre-line">
          ${customer.ai_nba || 'กำลังจัดทำข้อเสนอแนะ Next-Best-Action...'}
        </div>
      `;

      // Wire regenerate button
      document.getElementById('regen-ai-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerLiveAiGeneration(customer.id);
      });
    }

    if (scriptContainer) {
      if (customer.ai_script) {
        scriptContainer.innerHTML = `“${customer.ai_script.replace(/\n/g, '<br>')}”`;
      } else {
        scriptContainer.innerHTML = `<span class="italic text-on-surface-variant">กดปุ่มขอสคริปต์เพื่อสร้างบทสนทนาเฉพาะบุคคล</span>`;
      }
    }
  }

  // Live AI Generation with Ollama on user request
  async function triggerLiveAiGeneration(customerId) {
    const nbaContentBox = document.getElementById('nba-content-box');
    const scriptContainer = document.getElementById('call-script-text');
    const regenBtn = document.getElementById('regen-ai-btn');

    if (regenBtn) {
      regenBtn.disabled = true;
      regenBtn.innerHTML = `<span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> ประมวลผล...`;
    }

    if (nbaContentBox) {
      nbaContentBox.innerHTML = `
        <div class="flex items-center gap-2 text-xs text-on-surface-variant animate-pulse py-2">
          <span class="material-symbols-outlined text-primary animate-spin">progress_activity</span>
          <span>Ollama qwen2.5 กำลังคำนวณข้อเสนอสด...</span>
        </div>
      `;
    }

    if (scriptContainer) {
      scriptContainer.innerHTML = `<span class="italic text-on-surface-variant animate-pulse">กำลังร่างสคริปต์การโทรเฉพาะบุคคลด้วย Ollama LLM...</span>`;
    }

    try {
      // Call NBA and Script sequentially
      const nbaData = await api.post('/api/ai/nba', { customerId });
      if (nbaContentBox && nbaData.nba) {
        nbaContentBox.innerHTML = nbaData.nba;
      }

      const scriptData = await api.post('/api/ai/script', { customerId });
      if (scriptContainer && scriptData.script) {
        scriptContainer.innerHTML = `“${scriptData.script.replace(/\n/g, '<br>')}”`;
      }

      showToast('Ollama วิเคราะห์แผนและสคริปต์สำเร็จแล้ว', 'success');
    } catch (err) {
      console.warn('Live AI generation error:', err);
      showToast('ใช้สคริปต์มาตรฐานที่เตรียมไว้เนื่องจาก AI มีการตอบสนองช้า', 'info');
    } finally {
      if (regenBtn) {
        regenBtn.disabled = false;
        regenBtn.innerHTML = `<span class="material-symbols-outlined text-[14px]">autorenew</span> <span>สดใหม่</span>`;
      }
    }
  }

  // Wire Header Search Input
  const headerSearchInput = document.querySelector('header input[type="text"], input[placeholder*="Search client"]');
  if (headerSearchInput) {
    headerSearchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.trim();
      applyFilterAndRender();
    });
  }

  // Wire Filter Pills
  const filterButtons = document.querySelectorAll('.flex-wrap.items-center.gap-space-xs button');
  filterButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      // Clear active style on all buttons
      filterButtons.forEach(b => {
        b.classList.remove('bg-primary-container', 'text-on-primary-container', 'shadow-sm');
        b.classList.add('bg-surface-container', 'text-on-surface-variant');
      });
      btn.classList.remove('bg-surface-container', 'text-on-surface-variant');
      btn.classList.add('bg-primary-container', 'text-on-primary-container', 'shadow-sm');

      const text = btn.innerText;
      if (text.includes('ทั้งหมด')) currentFilter = 'all';
      else if (text.includes('วิกฤต')) currentFilter = 'critical';
      else if (text.includes('ควรทบทวน')) currentFilter = 'review';
      else if (text.includes('เหมาะสม')) currentFilter = 'optimal';
      else if (text.includes('Partner') || text.includes('รพ')) currentFilter = 'hospital';
      else if (text.includes('บุตร') || text.includes('แต่งงาน')) currentFilter = 'family';
      else currentFilter = 'all';

      applyFilterAndRender();
    });
  });

  // Wire Post-Call Quick Log Buttons
  document.querySelectorAll('.grid-cols-3 button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const outcome = btn.innerText.trim();
      btn.disabled = true;
      try {
        await api.post('/api/broker/notes', {
          customerId: selectedCustomerId,
          callOutcome: outcome,
          notes: `บันทึกผลการติดต่อ: ${outcome} เมื่อเวลา ${new Date().toLocaleTimeString('th-TH')}`,
          updatedBatteryScore: 85
        });
        showToast(`บันทึกสถานะ "${outcome}" เรียบร้อยแล้ว`, 'success');
        loadPriorityQueue();
      } catch (err) {
        showToast('บันทึกไม่สำเร็จ: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });

  // Initial Load
  loadPriorityQueue();
});
