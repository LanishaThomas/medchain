const crypto = require('crypto');
const { RtcTokenBuilder, RtcRole } = require('agora-access-token');
const Consultation = require('../models/Consultation');

function getAgoraConfig() {
  return {
    appId: String(process.env.AGORA_APP_ID || '').trim(),
    appCertificate: String(process.env.AGORA_APP_CERTIFICATE || '').trim(),
    tokenTtlSeconds: Number(process.env.CONSULTATION_TOKEN_TTL_SECONDS || 900),
    forceDemoMode: String(process.env.CONSULTATION_FORCE_DEMO_MODE || '').toLowerCase() === 'true'
  };
}

function isValidAgoraAppId(appId) {
  return /^[A-Za-z0-9]{32}$/.test(appId);
}

function hasAgoraConfig(appId, appCertificate) {
  return Boolean(isValidAgoraAppId(appId) && appCertificate);
}

function buildRoomId(appointmentId) {
  return `consult_${appointmentId}_${crypto.randomBytes(4).toString('hex')}`;
}

async function createConsultationRoom(appointmentId, doctorId, patientId) {
  const existing = await Consultation.findOne({ appointmentId });
  if (existing) {
    return existing;
  }

  try {
    const consultation = await Consultation.create({
      appointmentId,
      doctorId,
      patientId,
      roomId: buildRoomId(appointmentId),
      status: 'scheduled'
    });

    return consultation;
  } catch (error) {
    if (error && error.code === 11000) {
      const raceCreated = await Consultation.findOne({ appointmentId });
      if (raceCreated) {
        return raceCreated;
      }
    }

    throw error;
  }
}

function generateJoinToken(userId, roomId, role) {
  const { appId, appCertificate, tokenTtlSeconds, forceDemoMode } = getAgoraConfig();

  if (forceDemoMode || !hasAgoraConfig(appId, appCertificate)) {
    return {
      provider: 'demo',
      appId: '',
      token: '',
      expiresAt: new Date(Date.now() + tokenTtlSeconds * 1000).toISOString(),
      ttlSeconds: tokenTtlSeconds
    };
  }

  const agoraRole = role === 'doctor' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expireAt = Math.floor(Date.now() / 1000) + tokenTtlSeconds;
  const rtcUid = crypto.randomInt(1, 2147483647);
  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    roomId,
    rtcUid,
    agoraRole,
    expireAt
  );

  return {
    provider: 'agora',
    appId,
    token,
    rtcUid,
    expiresAt: new Date(expireAt * 1000).toISOString(),
    ttlSeconds: tokenTtlSeconds
  };
}

module.exports = {
  createConsultationRoom,
  generateJoinToken
};
