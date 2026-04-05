const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Protect all AI routes
router.use(protect);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Models to try in order (flash models first — lower quota cost)
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3-flash',
  'gemini-2.5-pro',
  'gemini-3-pro'
];

// Helper: sleep for ms
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SYSTEM_PROMPTS = {
  en: `You are MedChain Health Assistant. Be empathetic, concise, and evidence-based. Support physical and mental health. Never diagnose or prescribe — recommend doctors for serious issues. Keep answers to 2-3 short paragraphs. For emergencies direct to 911.`,

  hi: `आप मेडचेन स्वास्थ्य सहायक हैं। केवल हिंदी में उत्तर दें। सहानुभूतिपूर्ण, संक्षिप्त और सुरक्षित उत्तर दें। गंभीर मामलों में डॉक्टर से मिलने की सलाह दें।`,

  ta: `நீங்கள் MedChain சுகாதார உதவியாளர். தமிழில் மட்டும் பதிலளிக்கவும். பதில்கள் எளிமையாகவும், அக்கறையுடனும், பாதுகாப்பாகவும் இருக்கட்டும். தீவிர பிரச்சினைகளுக்கு மருத்துவரை அணுகுமாறு பரிந்துரைக்கவும்.`,

  mr: `तुम्ही MedChain आरोग्य सहाय्यक आहात. फक्त मराठीत उत्तर द्या. उत्तर सहानुभूतीपूर्ण, संक्षिप्त आणि सुरक्षित असू द्या. गंभीर प्रकरणांमध्ये डॉक्टरांचा सल्ला घ्या.`
};

// Local fallback responses when AI API is down
const FALLBACK_RESPONSES = {
  en: {
    greeting: "Hello! I'm MedChain Health Assistant. While I'm having trouble connecting to my AI services right now, I'm still here to help! Please try again in a moment, or here are some general wellness tips:\n\n• Stay hydrated - aim for 8 glasses of water daily\n• Take regular breaks if working at a screen\n• Practice deep breathing: inhale 4 seconds, hold 4, exhale 4\n• Get 7-9 hours of sleep per night\n\n**For emergencies, call 911. For crisis support, call 988.**",
    health: "I'm currently experiencing connectivity issues with my AI services. For your health question, I'd recommend:\n\n• Consulting with your healthcare provider for personalized advice\n• Using trusted resources like CDC.gov or WHO.int\n• For urgent symptoms, visit your nearest emergency room\n\n**For emergencies, call 911.**\n\nPlease try asking again in a moment!",
    mental: "I appreciate you reaching out. While I'm having technical difficulties right now, your mental health matters:\n\n• Practice grounding: name 5 things you see, 4 you hear, 3 you feel, 2 you smell, 1 you taste\n• Take slow, deep breaths\n• Consider talking to a trusted friend or family member\n\n**Crisis Resources:**\n🆘 Crisis Lifeline: 988\n💬 Crisis Text: Text HOME to 741741\n🚑 Emergency: 911\n\nPlease try again in a moment!"
  },
  hi: {
    greeting: "नमस्ते! मैं मेडचेन स्वास्थ्य सहायक हूँ। कृपया कुछ देर बाद पुनः प्रयास करें।\n\n🆘 आपातकालीन: 112",
    health: "कृपया अपने डॉक्टर से सलाह लें। आपातकालीन: 112",
    mental: "आपकी मानसिक स्वास्थ्य महत्वपूर्ण है। कृपया किसी विश्वसनीय व्यक्ति से बात करें।\n\n🆘 आपातकालीन: 112"
  },
  ta: {
    greeting: "வணக்கம்! சிறிது நேரம் கழித்து முயற்சிக்கவும்.\n\n🆘 அவசர உதவி: 112",
    health: "உங்கள் மருத்துவரை அணுகவும்.\n\n🆘 அவசர உதவி: 112",
    mental: "உங்கள் மன ஆரோக்கியம் முக்கியம். நம்பகமான நபரிடம் பேசுங்கள்.\n\n🆘 அவசர உதவி: 112"
  },
  mr: {
    greeting: "नमस्कार! कृपया काही वेळाने पुन्हा प्रयत्न करा.\n\n🆘 आणीबाणी: 112",
    health: "कृपया तुमच्या डॉक्टरांचा सल्ला घ्या.\n\n🆘 आणीबाणी: 112",
    mental: "तुमचे मानसिक आरोग्य महत्त्वाचे आहे. विश्वासू व्यक्तीशी बोला.\n\n🆘 आणीबाणी: 112"
  }
};

// Track in-flight requests per user to prevent duplicate calls
const inFlightByUser = new Set();

/**
 * Call Gemini API with model fallback
 */
async function callGeminiWithFallback(promptText) {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  const body = {
    contents: [{ parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
      topP: 0.85,
      topK: 40
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
    ]
  };

  let lastErr = 'All Gemini models failed';

  for (const model of GEMINI_MODELS) {
    // Try each model with up to 1 retry on rate-limit
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        // v1beta supports all models including newer 2.5/3.x variants
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        
        if (attempt === 0) console.log(`🤖 Trying model: ${model}`);
        else console.log(`🔄 Retrying model: ${model} (attempt ${attempt + 1})`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout
        
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });

        clearTimeout(timeout);

        if (resp.status === 429) {
          // Rate limited — wait and retry this model once
          const retryMatch = (await resp.text()).match(/retry in ([\d.]+)s/i);
          const waitSec = retryMatch ? Math.min(parseFloat(retryMatch[1]), 30) : 5;
          console.warn(`⏳ Model ${model} rate-limited, waiting ${waitSec}s...`);
          if (attempt === 0) {
            await sleep(waitSec * 1000);
            continue; // retry same model
          }
          lastErr = `Model ${model} rate-limited`;
          break; // move to next model
        }

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          lastErr = errData?.error?.message || `Gemini ${model} returned ${resp.status}`;
          console.warn(`⚠️ Model ${model} failed: ${lastErr}`);
          break; // move to next model
        }

        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
          console.log(`✅ Model ${model} responded successfully`);
          return text;
        }
        
        // Check if response was blocked by safety filters
        if (data?.candidates?.[0]?.finishReason === 'SAFETY') {
          console.warn(`⚠️ Model ${model}: response blocked by safety filters`);
          lastErr = 'Response was blocked by safety filters. Please rephrase your question.';
          break;
        }
        
        lastErr = `Model ${model} returned empty response`;
        console.warn(`⚠️ ${lastErr}`);
        break;
      } catch (err) {
        if (err.name === 'AbortError') {
          lastErr = `Model ${model} timed out`;
        } else {
          lastErr = err.message || `Model ${model} network error`;
        }
        console.warn(`⚠️ ${lastErr}`);
        break; // move to next model
      }
    }
  }

  throw new Error(lastErr);
}

/**
 * Determine the type of query for fallback responses
 */
function classifyQuery(message) {
  const lower = message.toLowerCase();
  const mentalKeywords = ['stress', 'anxious', 'anxiety', 'depress', 'sad', 'mental', 'mood', 'sleep', 'lonely', 'panic', 'worry', 'fear', 'तनाव', 'चिंता', 'மன அழுத்தம்', 'तणाव'];
  const greetingKeywords = ['hello', 'hi', 'hey', 'namaste', 'good morning', 'good evening', 'नमस्ते', 'வணக்கம்', 'नमस्कार'];
  
  if (greetingKeywords.some(kw => lower.includes(kw))) return 'greeting';
  if (mentalKeywords.some(kw => lower.includes(kw))) return 'mental';
  return 'health';
}

/**
 * POST /api/ai/chat
 * Send a message to the AI health assistant
 */
router.post('/chat', async (req, res) => {
  const userId = req.user?.id ? String(req.user.id) : null;
  
  try {
    // Auth check
    if (!req.user || !req.user.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized - please log in' });
    }

    // Extract request body
    const { message, language = 'en', conversationHistory = [] } = req.body || {};
    
    console.log(`💬 AI Chat request from user ${userId}: "${message?.substring(0, 50)}..." [${language}]`);

    // Validate message
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    // Prevent concurrent requests from same user
    if (inFlightByUser.has(userId)) {
      return res.status(429).json({ success: false, message: 'Please wait for your current response to complete' });
    }

    inFlightByUser.add(userId);

    // Check if Gemini API key is configured
    if (!GEMINI_API_KEY) {
      console.warn('⚠️ GEMINI_API_KEY not configured - using fallback response');
      const queryType = classifyQuery(message);
      const lang = FALLBACK_RESPONSES[language] ? language : 'en';
      const fallbackText = FALLBACK_RESPONSES[lang][queryType] || FALLBACK_RESPONSES[lang].greeting;
      
      return res.status(200).json({
        success: true,
        data: { message: fallbackText, language, fallback: true }
      });
    }

    // Build the prompt
    const systemPrompt = SYSTEM_PROMPTS[language] || SYSTEM_PROMPTS.en;
    
    // Build conversation context from history (last 6 messages)
    const historyText = Array.isArray(conversationHistory)
      ? conversationHistory
          .slice(-6)
          .map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`)
          .join('\n')
      : '';

    const fullPrompt = `${systemPrompt}\n\n${historyText ? `Recent conversation:\n${historyText}\n\n` : ''}User: ${message.trim()}\n\nAssistant:`;

    // Call Gemini API
    const aiText = await callGeminiWithFallback(fullPrompt);

    console.log(`✅ AI response generated for user ${userId}`);

    return res.status(200).json({
      success: true,
      data: {
        message: aiText.trim(),
        language,
        model: 'gemini'
      }
    });

  } catch (error) {
    console.error(`❌ AI Chat error for user ${userId}:`, error.message);
    
    // Provide fallback response instead of just an error
    const { message: userMessage = '', language = 'en' } = req.body || {};
    const queryType = classifyQuery(userMessage);
    const lang = FALLBACK_RESPONSES[language] ? language : 'en';
    const fallbackText = FALLBACK_RESPONSES[lang][queryType] || FALLBACK_RESPONSES[lang].greeting;

    return res.status(200).json({
      success: true,
      data: {
        message: fallbackText,
        language: lang,
        fallback: true,
        note: 'AI service temporarily unavailable - showing helpful information'
      }
    });

  } finally {
    if (userId) inFlightByUser.delete(userId);
  }
});

/**
 * GET /api/ai/health
 * Health check for AI service
 */
router.get('/health', async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      hasApiKey: !!GEMINI_API_KEY,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;
