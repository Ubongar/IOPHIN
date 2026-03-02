/**
 * Alert Subscription System for IOPHIN
 * Email + WebSocket notifications for risk tier changes and anomalies.
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '../.env') });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });

async function sendEmail(to, subject, html) {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('Email skipped: SMTP_USER or SMTP_PASS not configured');
      return false;
    }
    const nodemailer = (await import('nodemailer')).default;
    const smtpPort = parseInt(process.env.SMTP_PORT || '465');
    const isSecure = smtpPort === 465;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: smtpPort,
      secure: isSecure,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
    });
    const info = await transporter.sendMail({ from: process.env.SMTP_USER, to, subject, html });
    console.log(`Email sent to ${to}: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message, err.code || '');
    return false;
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
  const sub = result.rows[0];

  // Send confirmation email to the subscriber
  let emailSent = false;
  if (notifyEmail !== false) {
    try {
      const userRes = await pool.query('SELECT email, full_name FROM users WHERE id = $1', [userId]);
      if (userRes.rows.length > 0 && userRes.rows[0].email) {
        const { email, full_name } = userRes.rows[0];
        const name = full_name || email.split('@')[0];
        const area = lgaName || state || 'All areas';
        const typeLabel = (alertType || 'risk_change').replace(/_/g, ' ');
        emailSent = await sendEmail(email,
          `IOPHIN: Subscription confirmed for ${area}`,
          `
          <div style="font-family:'Inter',Arial,sans-serif;max-width:560px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:12px;overflow:hidden">
            <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px">
              <h1 style="margin:0;font-size:20px;color:#fff">IOPHIN Alert Subscription</h1>
            </div>
            <div style="padding:28px 32px">
              <p style="margin:0 0 16px">Hi <strong>${name}</strong>,</p>
              <p style="margin:0 0 16px">You have successfully subscribed to <strong>${typeLabel}</strong> alerts for:</p>
              <div style="background:#1e293b;border-left:4px solid #6366f1;padding:14px 18px;border-radius:6px;margin:0 0 16px">
                <p style="margin:0;font-size:18px;font-weight:700;color:#fff">${area}</p>
              </div>
              <p style="margin:0 0 16px;color:#94a3b8">You will receive email notifications whenever there are ${typeLabel} events for this area. Updates include risk level changes, anomaly detections, and relevant intelligence.</p>
              <p style="margin:0;color:#64748b;font-size:13px">You can manage or remove this subscription at any time from the IOPHIN dashboard.</p>
            </div>
            <div style="padding:16px 32px;background:#1e1b4b;text-align:center">
              <p style="margin:0;font-size:11px;color:#6366f1">IOPHIN &mdash; Poverty Hotspot Intelligence System</p>
            </div>
          </div>
          `
        );
      }
    } catch (emailErr) {
      console.error('Failed to send subscription confirmation email:', emailErr.message);
    }
  }

  sub.emailSent = emailSent;
  return sub;
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
