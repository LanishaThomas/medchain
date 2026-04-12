/**
 * paymentController.js
 * Production-grade Razorpay payment integration for online consultations.
 *
 * Routes:
 *   POST /api/payment/create-order/:appointmentId  — create Razorpay order
 *   POST /api/payment/verify                       — verify payment signature (frontend callback)
 *   POST /api/payment/webhook                      — Razorpay webhook (source of truth)
 *   GET  /api/payment/status/:appointmentId        — get payment status
 */

const crypto = require('crypto');
const Razorpay = require('razorpay');
const Appointment = require('../models/Appointment');
const Payment = require('../models/Payment');
const User = require('../models/User');

// ─── Razorpay client (lazy-init so missing keys don't crash on import) ────────
function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error('RAZORPAY_KEY_ID and RAZORPAY_SECRET must be set in .env');
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function verifyRazorpaySignature(orderId, paymentId, signature) {
  const secret = process.env.RAZORPAY_SECRET;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return expected === signature;
}

function verifyWebhookSignature(rawBody, receivedSignature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Payment] RAZORPAY_WEBHOOK_SECRET not set — webhook rejected');
    return false;
  }
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return expected === receivedSignature;
}

// ─── POST /api/payment/create-order/:appointmentId ────────────────────────────
exports.createOrder = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const patientId = req.user.id;

    const appointment = await Appointment.findById(appointmentId)
      .populate('doctor', 'firstName lastName doctorProfile');

    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Ownership check
    if (appointment.patient.toString() !== patientId.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Must be an online consultation
    if (appointment.consultationType !== 'online') {
      return res.status(400).json({
        success: false,
        message: 'Payment is only required for online consultations'
      });
    }

    // Idempotency — already paid
    if (appointment.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'This appointment has already been paid'
      });
    }

    if (appointment.paymentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Payment is not required for this appointment'
      });
    }

    // Check for an existing non-failed order (idempotency)
    const existingPayment = await Payment.findOne({
      appointmentId,
      status: 'created'
    });
    if (existingPayment) {
      return res.status(200).json({
        success: true,
        data: {
          orderId: existingPayment.razorpayOrderId,
          amount: existingPayment.amount,
          currency: existingPayment.currency,
          key_id: process.env.RAZORPAY_KEY_ID
        }
      });
    }

    // Fetch fee from doctor profile
    const fee = appointment.doctor?.doctorProfile?.onlineConsultationFee;
    if (!fee || fee <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Doctor has not set an online consultation fee'
      });
    }

    const amountInPaise = Math.round(fee * 100);

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: appointmentId.toString(),
      notes: {
        appointmentId: appointmentId.toString(),
        patientId: patientId.toString(),
        doctorId: appointment.doctor._id.toString()
      }
    });

    // Persist order
    await Payment.create({
      appointmentId,
      patientId,
      doctorId: appointment.doctor._id,
      amount: amountInPaise,
      currency: 'INR',
      razorpayOrderId: order.id,
      status: 'created'
    });

    // Update appointment amount
    await Appointment.findByIdAndUpdate(appointmentId, {
      amount: fee,
      currency: 'INR'
    });

    console.log(`[Payment] Order created: ${order.id} for appointment ${appointmentId}`);

    return res.status(201).json({
      success: true,
      data: {
        orderId: order.id,
        amount: amountInPaise,
        currency: 'INR',
        key_id: process.env.RAZORPAY_KEY_ID
      }
    });
  } catch (err) {
    // Razorpay SDK throws objects like { statusCode, error: { description } }
    // not standard Error instances — extract properly
    let message = 'Unknown payment error';
    if (err instanceof Error) {
      message = err.message;
    } else if (err?.error?.description) {
      message = err.error.description;
    } else if (err?.error?.reason) {
      message = err.error.reason;
    } else if (typeof err === 'object') {
      message = JSON.stringify(err);
    }

    console.error('[Payment] createOrder error:', message);

    if (message.includes('RAZORPAY_KEY_ID') || message.includes('RAZORPAY_SECRET')) {
      return res.status(503).json({
        success: false,
        message: 'Payment gateway not configured. Add RAZORPAY_KEY_ID and RAZORPAY_SECRET to .env'
      });
    }

    // Razorpay auth failure — bad key
    if (err?.statusCode === 401 || message.includes('authenticate')) {
      return res.status(503).json({
        success: false,
        message: 'Razorpay authentication failed — check your RAZORPAY_KEY_ID and RAZORPAY_SECRET in .env'
      });
    }

    return res.status(500).json({ success: false, message });
  }
};

// ─── POST /api/payment/verify ─────────────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Missing payment fields' });
    }

    // CRITICAL: verify signature server-side — never trust frontend
    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    );

    if (!isValid) {
      console.error(
        `[Payment] INVALID SIGNATURE — orderId: ${razorpay_order_id}, paymentId: ${razorpay_payment_id}`
      );
      return res.status(400).json({ success: false, message: 'Invalid payment signature' });
    }

    const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    if (payment.status === 'paid') {
      return res.status(200).json({ success: true, message: 'Already verified' });
    }

    // Mark payment as paid
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.status = 'paid';
    await payment.save();

    // Update appointment
    await Appointment.findByIdAndUpdate(payment.appointmentId, {
      paymentStatus: 'paid'
    });

    console.log(`[Payment] Verified: ${razorpay_payment_id} for order ${razorpay_order_id}`);

    return res.status(200).json({ success: true, message: 'Payment verified successfully' });
  } catch (err) {
    console.error('[Payment] verifyPayment error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/payment/webhook ────────────────────────────────────────────────
// Disabled for local dev — webhook requires a public URL (ngrok/production).
// Payment confirmation is handled securely by /verify with HMAC-SHA256 validation.
// Re-enable this when deploying to production with a real public URL.
exports.webhook = async (req, res) => {
  console.log('[Webhook] Received — disabled in local mode, use /verify instead.');
  return res.status(200).json({ success: true });
};

// ─── GET /api/payment/status/:appointmentId ───────────────────────────────────
exports.getPaymentStatus = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id;

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    // Only patient or doctor of this appointment can check
    const isOwner =
      appointment.patient.toString() === userId.toString() ||
      appointment.doctor.toString() === userId.toString();
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const payment = await Payment.findOne({ appointmentId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: {
        consultationType: appointment.consultationType,
        paymentStatus: appointment.paymentStatus,
        amount: appointment.amount,
        currency: appointment.currency,
        payment: payment
          ? {
              status: payment.status,
              razorpayOrderId: payment.razorpayOrderId,
              razorpayPaymentId: payment.razorpayPaymentId,
              createdAt: payment.createdAt
            }
          : null
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
