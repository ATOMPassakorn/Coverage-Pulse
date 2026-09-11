import express from 'express';
import { db } from '../db/database.js';
import { chatWithCopilot, generateNextBestAction, generatePreCallScript } from '../services/ollamaService.js';

const router = express.Router();

// AI Coverage Copilot Chat (Customer Sandbox)
router.post('/chat', async (req, res) => {
  try {
    const { messages = [], customerId = 'CUST-001' } = req.body;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    
    const context = customer ? {
      name: customer.name,
      age: customer.age,
      family_status: customer.family_status,
      battery_score: customer.battery_score,
      battery_status: customer.battery_status,
      battery_reasons: customer.battery_reasons ? JSON.parse(customer.battery_reasons) : []
    } : {};

    const reply = await chatWithCopilot(messages, context);
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Next-Best-Action (NBA) for a customer
router.post('/nba', async (req, res) => {
  try {
    const { customerId } = req.body;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const lifeEvents = db.prepare('SELECT * FROM life_events WHERE customer_id = ? ORDER BY detected_at DESC').all(customerId);
    const policies = db.prepare('SELECT * FROM policies WHERE customer_id = ?').all(customerId);

    const nba = await generateNextBestAction(customer, lifeEvents, policies);
    res.json({ nba });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate Pre-Call Script for broker
router.post('/script', async (req, res) => {
  try {
    const { customerId } = req.body;
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const lifeEvents = db.prepare('SELECT * FROM life_events WHERE customer_id = ? ORDER BY detected_at DESC').all(customerId);
    const policies = db.prepare('SELECT * FROM policies WHERE customer_id = ?').all(customerId);
    const warmLead = db.prepare('SELECT * FROM warm_leads WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1').get(customerId);

    const script = await generatePreCallScript(customer, lifeEvents, policies, warmLead);
    res.json({ script });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
