import express from 'express';
import { db } from '../db/database.js';

const router = express.Router();

// Get Priority Queue sorted by Battery Urgency
router.get('/priority-queue', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM warm_leads w WHERE w.customer_id = c.id AND w.status != 'completed') as warm_lead_count,
        (SELECT title FROM life_events l WHERE l.customer_id = c.id ORDER BY l.detected_at DESC LIMIT 1) as latest_event_title,
        (SELECT source FROM life_events l WHERE l.customer_id = c.id ORDER BY l.detected_at DESC LIMIT 1) as latest_event_source,
        (SELECT COUNT(*) FROM policies p WHERE p.customer_id = c.id) as policy_count
      FROM customers c
      ORDER BY 
        CASE 
          WHEN c.battery_status = 'critical' THEN 1
          WHEN c.battery_status = 'review' THEN 2
          ELSE 3
        END ASC,
        c.battery_score ASC
    `).all();

    // Summary stats for Bento Grid
    const criticalCount = customers.filter(c => c.battery_status === 'critical').length;
    const warmLeadCount = db.prepare("SELECT COUNT(*) as count FROM warm_leads WHERE status != 'completed'").get().count;
    const hospitalSignals = db.prepare("SELECT COUNT(*) as count FROM life_events WHERE source LIKE '%Hospital%'").get().count;
    const totalClients = customers.length;

    const formattedCustomers = customers.map(c => ({
      ...c,
      battery_reasons: c.battery_reasons ? JSON.parse(c.battery_reasons) : []
    }));

    res.json({
      stats: {
        criticalCount,
        warmLeadCount,
        hospitalSignals,
        totalClients
      },
      customers: formattedCustomers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Pre-call Brief for a customer
router.get('/pre-call-brief/:customerId', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const policies = db.prepare('SELECT * FROM policies WHERE customer_id = ?').all(req.params.customerId);
    const lifeEvents = db.prepare('SELECT * FROM life_events WHERE customer_id = ? ORDER BY detected_at DESC').all(req.params.customerId);
    const warmLeads = db.prepare('SELECT * FROM warm_leads WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.customerId);
    const consents = db.prepare('SELECT * FROM consent_logs WHERE customer_id = ?').all(req.params.customerId);
    const brokerNotes = db.prepare('SELECT * FROM broker_notes WHERE customer_id = ? ORDER BY created_at DESC').all(req.params.customerId);

    const formattedWarmLeads = warmLeads.map(w => ({
      ...w,
      intent_details: w.intent_details ? JSON.parse(w.intent_details) : []
    }));

    res.json({
      customer: {
        ...customer,
        battery_reasons: customer.battery_reasons ? JSON.parse(customer.battery_reasons) : []
      },
      policies,
      lifeEvents,
      warmLeads: formattedWarmLeads,
      consents,
      brokerNotes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit Broker Notes / Post-Call confirmation
router.post('/notes', (req, res) => {
  try {
    const { customerId, callOutcome, notes, confirmedEvents, updatedBatteryScore } = req.body;

    const noteId = `NOT-${Date.now()}`;
    db.prepare(`
      INSERT INTO broker_notes (id, customer_id, call_outcome, notes, confirmed_events)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      noteId,
      customerId,
      callOutcome,
      notes,
      confirmedEvents ? JSON.stringify(confirmedEvents) : null
    );

    // If broker confirmed events or adjusted score
    if (updatedBatteryScore) {
      const status = updatedBatteryScore >= 80 ? 'optimal' : updatedBatteryScore >= 50 ? 'review' : 'critical';
      db.prepare(`
        UPDATE customers 
        SET battery_score = ?, battery_status = ? 
        WHERE id = ?
      `).run(updatedBatteryScore, status, customerId);
    }

    // Mark warm lead completed if applicable
    db.prepare(`
      UPDATE warm_leads 
      SET status = 'completed' 
      WHERE customer_id = ? AND status = 'submitted'
    `).run(customerId);

    res.json({ success: true, noteId, message: 'บันทึกผลการติดต่อและยืนยันข้อมูลเรียบร้อยแล้ว' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Customer Portfolio with Search & Filter
router.get('/portfolio', (req, res) => {
  try {
    const { search = '', segment = '', batteryStatus = '' } = req.query;

    let query = `
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM policies p WHERE p.customer_id = c.id) as active_policies_count,
        (SELECT GROUP_CONCAT(product_name, ' | ') FROM policies p WHERE p.customer_id = c.id) as policy_names
      FROM customers c
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      query += ` AND (c.name LIKE ? OR c.id LIKE ? OR c.phone LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (segment) {
      query += ` AND c.segment = ?`;
      params.push(segment);
    }

    if (batteryStatus) {
      query += ` AND c.battery_status = ?`;
      params.push(batteryStatus);
    }

    query += ` ORDER BY c.battery_score ASC`;

    const customers = db.prepare(query).all(...params);
    const allPolicies = db.prepare('SELECT * FROM policies ORDER BY start_date DESC').all();

    const formatted = customers.map(c => {
      const custPolicies = allPolicies.filter(p => p.customer_id === c.id);
      return {
        ...c,
        active_policies_count: custPolicies.length,
        policy_names: custPolicies.map(p => p.product_name).join(' | '),
        policies: custPolicies,
        battery_reasons: c.battery_reasons ? JSON.parse(c.battery_reasons) : []
      };
    });

    res.json({ customers: formatted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Analytics & Trends
router.get('/analytics', (req, res) => {
  try {
    const customers = db.prepare('SELECT battery_status, battery_score FROM customers').all();
    const optimal = customers.filter(c => c.battery_status === 'optimal').length;
    const review = customers.filter(c => c.battery_status === 'review').length;
    const critical = customers.filter(c => c.battery_status === 'critical').length;

    const lifeEvents = db.prepare('SELECT event_type, COUNT(*) as count FROM life_events GROUP BY event_type').all();

    const warmLeads = db.prepare('SELECT status, COUNT(*) as count FROM warm_leads GROUP BY status').all();

    res.json({
      batteryDistribution: {
        optimal,
        review,
        critical,
        total: customers.length
      },
      conversionComparison: {
        coldCallConversionRate: 4.8, // percent
        warmLeadConversionRate: 34.2, // percent (Coverage Pulse effect)
        prepTimeWithoutPulseMin: 15,
        prepTimeWithPulseMin: 1.2
      },
      lifeEventsBreakdown: lifeEvents,
      warmLeadsBreakdown: warmLeads
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get PDPA & Consent Audit Logs
router.get('/audit-log', (req, res) => {
  try {
    const { partner = '', search = '' } = req.query;

    let query = `
      SELECT 
        l.*,
        c.name as customer_name,
        c.segment
      FROM consent_logs l
      JOIN customers c ON l.customer_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (partner) {
      query += ` AND l.partner_name LIKE ?`;
      params.push(`%${partner}%`);
    }

    if (search) {
      query += ` AND (c.name LIKE ? OR l.customer_id LIKE ? OR l.consent_type LIKE ? OR l.partner_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY l.granted_at DESC`;

    const logs = db.prepare(query).all(...params);

    const partnerRows = db.prepare(`
      SELECT DISTINCT partner_name 
      FROM consent_logs 
      WHERE partner_name IS NOT NULL AND partner_name != '' 
      ORDER BY partner_name ASC
    `).all();
    const partners = partnerRows.map(r => r.partner_name);

    res.json({ logs, partners });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
