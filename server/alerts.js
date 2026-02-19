/**
 * Alert Subscription System for IOPHIN
 * Email + WebSocket notifications for risk tier changes and anomalies.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function sendEmail(to, subject, html) {
  try {
    const nodemailer = (await import('nodemailer')).default;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
  } catch (err) {
    console.warn('Email send failed:', err.message);
  }
}

async function sendWebhook(url, payload) {
  try {
    // SSRF protection: only allow https:// and block private/loopback ranges
    if (!url || typeof url !== 'string') return;
    if (!url.startsWith('https://')) {
      console.warn('Webhook blocked: only https:// URLs are allowed');
      return;
    }
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    // Block localhost, link-local, and private ranges
    const BLOCKED = /^(localhost|127\.|0\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc00:|fe80:)/;
    if (BLOCKED.test(hostname)) {
      console.warn(`Webhook blocked: private/internal host "${hostname}"`);
      return;
    }
    const { default: fetch } = await import('node-fetch').catch(() => ({ default: null }));
    if (!fetch) return;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.warn('Webhook delivery failed:', err.message);
  }
}

export async function createSubscription(userId, lgaName, state, alertType, notifyEmail, notifyWebhook, webhookUrl) {
  const result = await pool.query(
    `INSERT INTO alert_subscriptions (user_id, lga_name, state, alert_type, notify_email, notify_webhook, webhook_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [userId, lgaName || null, state || null, alertType || 'risk_change', notifyEmail !== false, notifyWebhook === true, webhookUrl || null]
  );
  return result.rows[0];
}

export async function deleteSubscription(id, userId) {
  const result = await pool.query(
    'DELETE FROM alert_subscriptions WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );
  return result.rows.length > 0;
}

export async function getUserSubscriptions(userId) {
  const result = await pool.query(
    'SELECT * FROM alert_subscriptions WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return result.rows;
}

export async function triggerRiskChangeAlerts(io, lgaName, state, oldRisk, newRisk, deltaComposite) {
  try {
    // Get all matching subscriptions
    const result = await pool.query(
      `SELECT s.*, u.email FROM alert_subscriptions s
       JOIN users u ON u.id = s.user_id
       WHERE (s.lga_name = $1 OR s.state = $2)
         AND s.alert_type = 'risk_change'`,
      [lgaName, state]
    );

    const payload = { lga_name: lgaName, state, old_risk: oldRisk, new_risk: newRisk,
      delta_composite: deltaComposite, timestamp: new Date().toISOString() };

    // WebSocket broadcast
    if (io) {
      const { emitAlert } = await import('./websocket.js');
      emitAlert(io, 'risk_change', payload);
    }

    // Email + webhook per subscriber — sent in parallel
    await Promise.all(result.rows.map(async (sub) => {
      const sends = [];
      if (sub.notify_email && sub.email) {
        sends.push(sendEmail(sub.email,
          `IOPHIN Alert: Risk change in ${lgaName}`,
          `<b>${lgaName}</b> (${state}) risk changed from <b>${oldRisk}</b> to <b>${newRisk}</b>.`
        ));
      }
      if (sub.notify_webhook && sub.webhook_url) {
        sends.push(sendWebhook(sub.webhook_url, payload));
      }
      await Promise.all(sends);
    }));
  } catch (err) {
    console.error('Alert dispatch failed:', err.message);
  }
}
