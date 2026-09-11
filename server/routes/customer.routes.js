import express from 'express';
import { db } from '../db/database.js';
import { calculateBatteryScore } from '../services/relevanceEngine.js';

const router = express.Router();

// Get list of all available customers for persona switching
router.get('/list', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT id, name, age, gender, occupation, occupation_detail, segment, battery_score, battery_status, avatar_url, welfare, debt_burden, family_status, primary_concern
      FROM customers
      ORDER BY id ASC
    `).all();
    res.json({ customers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer profile and details
router.get('/profile/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const policies = db.prepare('SELECT * FROM policies WHERE customer_id = ?').all(req.params.id);
    const lifeEvents = db.prepare('SELECT * FROM life_events WHERE customer_id = ? ORDER BY detected_at DESC').all(req.params.id);
    const consents = db.prepare('SELECT * FROM consent_logs WHERE customer_id = ?').all(req.params.id);

    res.json({
      customer: {
        ...customer,
        battery_reasons: customer.battery_reasons ? JSON.parse(customer.battery_reasons) : []
      },
      policies,
      lifeEvents,
      consents
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update customer profile and recalculate battery score
router.put('/profile/:id', (req, res) => {
  try {
    const customerId = req.params.id;
    const {
      name,
      age,
      gender,
      occupation,
      occupation_detail,
      family_status,
      income_bracket,
      phone,
      email,
      welfare,
      debt_burden,
      primary_concern
    } = req.body;

    const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Update customer fields (segment is strictly read-only from DB)
    db.prepare(`
      UPDATE customers
      SET name = COALESCE(?, name),
          age = COALESCE(?, age),
          gender = COALESCE(?, gender),
          occupation = COALESCE(?, occupation),
          occupation_detail = COALESCE(?, occupation_detail),
          family_status = COALESCE(?, family_status),
          income_bracket = COALESCE(?, income_bracket),
          phone = COALESCE(?, phone),
          email = COALESCE(?, email),
          welfare = COALESCE(?, welfare),
          debt_burden = COALESCE(?, debt_burden),
          primary_concern = COALESCE(?, primary_concern)
      WHERE id = ?
    `).run(
      name || null,
      age !== undefined && age !== '' ? parseInt(age) : null,
      gender || null,
      occupation || null,
      occupation_detail !== undefined ? occupation_detail : null,
      family_status || null,
      income_bracket || null,
      phone || null,
      email || null,
      welfare || null,
      debt_burden || null,
      primary_concern || null,
      customerId
    );

    // Recalculate battery score with new profile
    const updatedCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    const policies = db.prepare('SELECT * FROM policies WHERE customer_id = ?').all(customerId);
    const lifeEvents = db.prepare('SELECT * FROM life_events WHERE customer_id = ?').all(customerId);

    const calcResult = calculateBatteryScore({
      profile: {
        age: updatedCustomer.age,
        gender: updatedCustomer.gender,
        occupation: updatedCustomer.occupation,
        family_status: updatedCustomer.family_status,
        income_bracket: updatedCustomer.income_bracket,
        welfare: updatedCustomer.welfare,
        debt_burden: updatedCustomer.debt_burden,
        primary_concern: updatedCustomer.primary_concern
      },
      policies,
      lifeEvents
    });

    db.prepare(`
      UPDATE customers
      SET battery_score = ?, battery_status = ?, battery_reasons = ?
      WHERE id = ?
    `).run(
      calcResult.battery_score,
      calcResult.battery_status,
      JSON.stringify(calcResult.reasons),
      customerId
    );

    const finalCustomer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);

    res.json({
      success: true,
      message: 'อัปเดตข้อมูลโปรไฟล์และคำนวณชีพจรความคุ้มครองใหม่เรียบร้อยแล้ว',
      customer: {
        ...finalCustomer,
        battery_reasons: finalCustomer.battery_reasons ? JSON.parse(finalCustomer.battery_reasons) : []
      },
      policies,
      lifeEvents
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit Self-Service Assessment (Tier 1 & Tier 2)
router.post('/assessment', (req, res) => {
  try {
    const { customerId = 'CUST-001', tier1Profile = {}, tier2Categories = {} } = req.body;

    const policies = db.prepare('SELECT * FROM policies WHERE customer_id = ?').all(customerId);
    const lifeEvents = db.prepare('SELECT * FROM life_events WHERE customer_id = ?').all(customerId);

    // Calculate score using Relevance Engine
    const result = calculateBatteryScore({
      profile: tier1Profile,
      selectedCategories: tier2Categories,
      policies,
      lifeEvents
    });

    // Save assessment
    const assessmentId = `ASM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    db.prepare(`
      INSERT INTO assessments (id, customer_id, tier1_profile, tier2_answers, calculated_battery)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      assessmentId,
      customerId,
      JSON.stringify(tier1Profile),
      JSON.stringify(tier2Categories),
      result.battery_score
    );

    // Update customer battery score and profile
    db.prepare(`
      UPDATE customers 
      SET battery_score = ?, battery_status = ?, battery_reasons = ?, 
          age = COALESCE(?, age), 
          occupation = COALESCE(?, occupation), 
          family_status = COALESCE(?, family_status), 
          income_bracket = COALESCE(?, income_bracket),
          welfare = COALESCE(?, welfare),
          debt_burden = COALESCE(?, debt_burden),
          primary_concern = COALESCE(?, primary_concern)
      WHERE id = ?
    `).run(
      result.battery_score,
      result.battery_status,
      JSON.stringify(result.reasons),
      tier1Profile.age || null,
      tier1Profile.occupation || null,
      tier1Profile.family_status || null,
      tier1Profile.income_bracket || null,
      tier1Profile.welfare || null,
      tier1Profile.debt_burden || null,
      tier1Profile.primary_concern || null,
      customerId
    );

    res.json({
      success: true,
      assessmentId,
      result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simulate Sandbox additions
router.post('/sandbox/simulate', (req, res) => {
  try {
    const { customerId = 'CUST-001', addedRiders = [] } = req.body;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    const baseScore = customer ? customer.battery_score : 42;

    // Each added rider boosts coverage points
    let boost = 0;
    for (const rider of addedRiders) {
      if (rider.id === 'opd') boost += 15;
      else if (rider.id === 'ci') boost += 22;
      else if (rider.id === 'maternity') boost += 25;
      else if (rider.id === 'accident') boost += 12;
      else if (rider.id === 'income_protection') boost += 18;
      else boost += 10;
    }

    const newScore = Math.min(100, baseScore + boost);
    let newStatus = 'optimal';
    if (newScore < 50) newStatus = 'critical';
    else if (newScore < 80) newStatus = 'review';

    res.json({
      currentScore: baseScore,
      simulatedScore: newScore,
      status: newStatus,
      gain: boost
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit Warm Lead ("อยากคุยกับ Broker")
router.post('/warm-lead', (req, res) => {
  try {
    const today = new Date();
    const nextBiz = new Date(today);
    nextBiz.setDate(today.getDate() + 1);
    while (nextBiz.getDay() === 0 || nextBiz.getDay() === 6) {
      nextBiz.setDate(nextBiz.getDate() + 1);
    }
    const defaultDate = nextBiz.toISOString().split('T')[0];

    const {
      customerId = 'CUST-001',
      intentDetails = [],
      simulatedBattery = 85,
      preferredDate = defaultDate,
      preferredTime = '10:00 - 11:00 น.',
      notes = ''
    } = req.body;

    const leadId = `LEAD-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    db.prepare(`
      INSERT INTO warm_leads (id, customer_id, intent_details, simulated_battery, preferred_date, preferred_time, notes, status, assigned_broker_name)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', 'กิตติพงษ์ สิทธิเวช')
    `).run(
      leadId,
      customerId,
      JSON.stringify(intentDetails),
      simulatedBattery,
      preferredDate,
      preferredTime,
      notes
    );

    // Add life event trigger for warm lead
    const eventId = `EVT-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    db.prepare(`
      INSERT INTO life_events (id, customer_id, event_type, title, description, source, signal_urgency)
      VALUES (?, ?, 'sandbox_warm_lead', 'ลูกค้าส่งสัญญาณ "อยากคุย" จาก Sandbox', ?, 'Customer Self-Report', 'high')
    `).run(
      eventId,
      customerId,
      `จำลองเพิ่มความคุ้มครอง: ${Array.isArray(intentDetails) ? intentDetails.join(', ') : intentDetails} (เป้าหมายแบตเตอรี่ ${simulatedBattery}%)`
    );

    res.json({
      success: true,
      leadId,
      message: 'ส่งความจำนงค์ถึงที่ปรึกษาเรียบร้อยแล้ว ที่ปรึกษาจะติดต่อกลับตามเวลาที่นัดหมาย',
      assignedBroker: 'กิตติพงษ์ สิทธิเวช (Krungsri Certified Advisor)'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get customer appointments / warm lead tracker
router.get('/appointments/:customerId', (req, res) => {
  try {
    const leads = db.prepare(`
      SELECT * FROM warm_leads 
      WHERE customer_id = ? 
      ORDER BY created_at DESC
    `).all(req.params.customerId);

    const formatted = leads.map(l => ({
      ...l,
      intent_details: l.intent_details ? JSON.parse(l.intent_details) : []
    }));

    res.json({ leads: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// F10: Customer Consent Center - Get Status & Audit Trail
router.get('/consent-center/:customerId', (req, res) => {
  try {
    const { customerId } = req.params;
    const customer = db.prepare('SELECT id, name, segment FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // 4 Canonical Signal Sources defined in Coverage Pulse PRD
    const canonicalSources = [
      {
        key: 'hospital_touchpoint',
        title: 'ข้อมูลสัญญาณเหตุการณ์สุขภาพจากโรงพยาบาล (Hospital Touchpoints)',
        category: 'Sensitive Medical Event Signal',
        partner_name: 'BDMS Network (รพ.กรุงเทพ / สมิติเวช)',
        purpose: 'แจ้งเตือนเมื่อมีเหตุการณ์สุขภาพสำคัญ เช่น ตรวจสุขภาพประจำปี หรือคลอดบุตร (ระดับ Event-level เท่านั้น ไม่ดึงประวัติการรักษาเชิงลึก)',
        double_opt_in: true,
        icon: 'local_hospital',
        badge: 'Double Opt-in Verified',
        sensitive: true
      },
      {
        key: 'bank_transaction',
        title: 'ข้อมูลธุรกรรมและการเงิน (Bank Transaction & KYC Context)',
        category: 'Financial Context Signal',
        partner_name: 'Bank of Ayudhya PCL',
        purpose: 'วิเคราะห์ความมั่นคงทางการเงิน ความสามารถในการออม และภาระหนี้สินเพื่อแนะนำความคุ้มครองที่สมดุล',
        double_opt_in: false,
        icon: 'account_balance',
        badge: 'Bank-Grade Security',
        sensitive: false
      },
      {
        key: 'health_activity',
        title: 'ข้อมูลกิจกรรมและไลฟ์สไตล์สุขภาพ (Health Activity Signal)',
        category: 'Wellness & Wearable Signal',
        partner_name: 'Coverage Pulse Digital Engine',
        purpose: 'ติดตามระดับความเสี่ยงจากไลฟ์สไตล์และกิจกรรมสุขภาพ เช่น การออกกำลังกาย เพื่อใช้ประกอบการประเมินความสอดคล้อง',
        double_opt_in: false,
        icon: 'fitness_center',
        badge: 'Encrypted Stream',
        sensitive: false
      },
      {
        key: 'broker_consultation',
        title: 'การติดต่อและรับคำปรึกษาจากที่ปรึกษาการเงิน (Broker Proactive Outreach)',
        category: 'Advisor Communication Signal',
        partner_name: 'Krungsri Insurance Advisory',
        purpose: 'ยินยอมให้ที่ปรึกษาที่มีใบอนุญาตจัดเตรียม Pre-call Brief และติดต่อแนะนำแผนเมื่อระดับแบตเตอรี่ลดลง',
        double_opt_in: false,
        icon: 'support_agent',
        badge: 'Certified Brokers',
        sensitive: false
      }
    ];

    const logs = db.prepare(`
      SELECT * FROM consent_logs 
      WHERE customer_id = ? 
      ORDER BY granted_at DESC, rowid DESC
    `).all(customerId);

    const sourceStatus = canonicalSources.map(src => {
      const match = logs.find(l => 
        l.partner_name.includes(src.partner_name.split(' ')[0]) || 
        (src.key === 'hospital_touchpoint' && l.partner_name.includes('BDMS')) ||
        (src.key === 'bank_transaction' && (l.partner_name.includes('Bank') || l.partner_name.includes('Ayudhya'))) ||
        (src.key === 'health_activity' && (l.partner_name.includes('Digital Engine') || l.partner_name.includes('Coverage Pulse'))) ||
        (src.key === 'broker_consultation' && (l.partner_name.includes('Advisory') || l.partner_name.includes('Advisor') || l.partner_name.includes('Telephony')))
      );

      const status = match ? match.status : 'active';
      const granted_at = match ? match.granted_at : '2026-01-01 09:00:00';

      return {
        ...src,
        status: status === 'revoked' ? 'revoked' : 'active',
        last_updated: granted_at,
        ip_channel: match ? match.ip_channel : 'Krungsri Mobile (KMA) TLS 1.3'
      };
    });

    res.json({
      customer,
      sources: sourceStatus,
      recentLogs: logs.slice(0, 15)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// F10: Customer Consent Center - Toggle Specific Consent (Append-Only Immutable Audit Trail)
router.post('/consent-center/toggle', (req, res) => {
  try {
    const { customerId, sourceKey, status } = req.body;
    if (!customerId || !sourceKey || !status) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const partnerMap = {
      hospital_touchpoint: { name: 'BDMS Network (รพ.กรุงเทพ & สมิติเวช)', type: 'Hospital Touchpoint Signal (Event-level)', doubleOpt: 1 },
      bank_transaction: { name: 'Bank of Ayudhya PCL', type: 'Bank Transaction Context Signal', doubleOpt: 0 },
      health_activity: { name: 'Coverage Pulse Digital Engine', type: 'Health Activity Signal Processing', doubleOpt: 0 },
      broker_consultation: { name: 'Krungsri Insurance Advisory', type: 'Broker Proactive Consultation Outreach', doubleOpt: 0 }
    };

    const target = partnerMap[sourceKey] || { name: 'Krungsri Partner', type: 'Data Processing Consent', doubleOpt: 0 };
    const logId = `CNS-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`;
    const newStatus = status === 'active' ? 'active' : 'revoked';
    const channel = 'KMA Customer Consent Center (TLS 1.3)';
    const actionLabel = newStatus === 'active' 
      ? target.type 
      : `ระงับความยินยอม: ${target.type}`;

    // Insert new audit log entry (Do NOT overwrite historical logs to preserve immutable audit trail)
    db.prepare(`
      INSERT INTO consent_logs (id, customer_id, consent_type, partner_name, status, double_opt_in, granted_at, ip_channel)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), ?)
    `).run(
      logId,
      customerId,
      actionLabel,
      target.name,
      newStatus,
      target.doubleOpt,
      channel
    );

    res.json({
      success: true,
      logId,
      sourceKey,
      status: newStatus,
      message: newStatus === 'active' 
        ? 'ยินยอมเปิดรับสัญญาณข้อมูลเรียบร้อยแล้ว' 
        : 'ระงับ/เพิกถอนความยินยอมเรียบร้อยแล้ว ข้อมูลจะไม่ถูกประมวลผลต่อ'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// F10: Customer Consent Center - Revoke All Consents (Append-only PDPA Sec 34)
router.post('/consent-center/revoke-all', (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) {
      return res.status(400).json({ error: 'Missing customerId' });
    }

    const sources = [
      { key: 'hospital_touchpoint', name: 'BDMS Network (รพ.กรุงเทพ & สมิติเวช)', type: 'ระงับความยินยอม: Hospital Touchpoint Signal' },
      { key: 'bank_transaction', name: 'Bank of Ayudhya PCL', type: 'ระงับความยินยอม: Bank Transaction Context Signal' },
      { key: 'health_activity', name: 'Coverage Pulse Digital Engine', type: 'ระงับความยินยอม: Health Activity Signal' },
      { key: 'broker_consultation', name: 'Krungsri Insurance Advisory', type: 'ระงับความยินยอม: Broker Proactive Consultation' }
    ];

    // Append a revoke log for each source to update their latest status immutably
    for (const src of sources) {
      const logId = `CNS-${Date.now().toString().slice(-4)}${Math.floor(Math.random() * 1000)}`;
      db.prepare(`
        INSERT INTO consent_logs (id, customer_id, consent_type, partner_name, status, double_opt_in, granted_at, ip_channel)
        VALUES (?, ?, ?, ?, 'revoked', 0, datetime('now', 'localtime'), 'Customer Portal (PDPA Sec 34)')
      `).run(logId, customerId, src.type, src.name);
    }

    res.json({
      success: true,
      message: 'เพิกถอนความยินยอมในการประมวลผลข้อมูลทั้งหมดเรียบร้อยแล้วตามมาตรฐาน PDPA'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
