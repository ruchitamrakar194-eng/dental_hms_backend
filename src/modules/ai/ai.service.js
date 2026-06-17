'use strict';
const { OpenAI } = require('openai');
const prisma = require('../../config/db');
const alertService = require('../alerts/alert.service');

// Initialize OpenAI client (only if key exists)
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// Cooldown map to store last alert timestamps per patient to throttle alerts
// Key: patientId, Value: timestamp (Number)
const alertCooldowns = new Map();
const COOLDOWN_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Helper to check if OpenAI key is configured
 */
const hasOpenAIKey = () => {
  return !!process.env.OPENAI_API_KEY;
};

/**
 * Handle high risk alert generation with 30-minute throttling
 */
const handleHighRiskAlert = async ({ clinicId, patientId, patientName, condition, riskLevel }) => {
  if (riskLevel !== 'High') return;

  const now = Date.now();
  const lastAlertTime = alertCooldowns.get(patientId);

  if (!lastAlertTime || (now - lastAlertTime) >= COOLDOWN_DURATION) {
    alertCooldowns.set(patientId, now);

    try {
      await alertService.createAlert({
        clinicId,
        title: `High-Risk Clinical Warning`,
        message: `Clinical AI detected high-risk condition: "${condition}" for patient ${patientName || 'Record'}. Urgent treatment check suggested.`,
        type: 'critical',
        role: 'dentist'
      });
      console.log(`[AI Smart Alerts] Triggered critical alert for high-risk patient ${patientId}`);
    } catch (err) {
      console.error('[AI Smart Alerts] Failed to create database alert:', err.message);
    }
  } else {
    console.log(`[AI Smart Alerts] Alert throttled for patient ${patientId} (Cooldown active)`);
  }
};

/**
 * Log AI Transaction in DB
 */
const logAiTransaction = async ({ clinicId, userId, moduleName, promptText, responseData, status, tokenUsage }) => {
  try {
    await prisma.aiLog.create({
      data: {
        clinicId,
        userId,
        module: moduleName,
        prompt: (promptText || '').substring(0, 1000), // Trim prompt to avoid database bloat
        response: JSON.stringify({
          status,
          tokenUsage: tokenUsage || null,
          data: responseData
        })
      }
    });
  } catch (err) {
    console.error('[AI Audit Logs] Failed to persist AI transaction log:', err.message);
  }
};

/**
 * Upgraded Smart Sandbox Simulator Fallback
 */
const getFallbackDiagnosis = (symptomsText, historyText) => {
  const combinedText = `${symptomsText || ''} ${historyText || ''}`.toLowerCase();
  
  if (combinedText.includes('bleeding') && combinedText.includes('swelling')) {
    return {
      conditions: ['Gingivitis', 'Localized Mild Periodontitis'],
      riskLevel: 'Medium',
      recommendation: 'Prophylaxis adult cleaning, deep scaling & root planing, and chlorhexidine rinse suggested.'
    };
  }
  
  if (combinedText.includes('severe pain') || combinedText.includes('pulp') || combinedText.includes('canal') || combinedText.includes('throbbing')) {
    return {
      conditions: ['Irreversible Pulpitis', 'Acute Apical Periodontitis'],
      riskLevel: 'High',
      recommendation: 'Endodontic therapy (root canal treatment) and post-treatment crown placement suggested.'
    };
  }
  
  if (combinedText.includes('fractured') || combinedText.includes('broken') || combinedText.includes('chipped')) {
    return {
      conditions: ['Fractured Distobuccal Cusp', 'Restorative Enamel Infraction'],
      riskLevel: 'Medium',
      recommendation: 'Full-coverage composite restoration build-up or porcelain-fused-to-metal (PFM) crown suggested.'
    };
  }
  
  if (combinedText.includes('caries') || combinedText.includes('cavity') || combinedText.includes('decay')) {
    return {
      conditions: ['Active Enamel Caries', 'Dentin Lesion'],
      riskLevel: 'Medium',
      recommendation: 'Excavation of carious dentin and composite resin filling suggested.'
    };
  }

  // Default healthy response
  return {
    conditions: ['Healthy Dentition', 'Localized Calculus Accumulation'],
    riskLevel: 'Low',
    recommendation: 'Routine 6-month preventive checkup, prophylaxis polishing, and flossing instructions suggested.'
  };
};

/**
 * Upgraded Smart Sandbox Treatment Plan Simulator
 */
const getFallbackTreatmentPlan = (diagnosisText) => {
  const normalized = (diagnosisText || '').toLowerCase();

  if (normalized.includes('pulpitis') || normalized.includes('canal') || normalized.includes('pulp')) {
    return {
      plan: [
        'Administer local block anesthesia',
        'Establish endodontic access cavity',
        'Extirpate diseased pulpal tissue',
        'Debride, clean, and shape root canals using rotary files',
        'Irrigate using sodium hypochlorite',
        'Obturate root canals with gutta-percha sealant',
        'Apply temporary sealing cement (Cavit)'
      ],
      duration: '2 sessions'
    };
  }

  if (normalized.includes('gingivitis') || normalized.includes('periodontitis') || normalized.includes('bleeding') || normalized.includes('swelling')) {
    return {
      plan: [
        'Comprehensive periodontal charting audit',
        'Supra and subgingival ultrasonic scaling',
        'Quadrant scaling & root planing using Gracey curettes',
        'Pocket irrigation using antimicrobial rinse',
        'Coarse prophylaxis paste polishing and home instruction review'
      ],
      duration: '1–2 sessions'
    };
  }

  if (normalized.includes('caries') || normalized.includes('cavity') || normalized.includes('decay')) {
    return {
      plan: [
        'Topical and local infiltration anesthesia',
        'Excavate decayed dentin structure',
        'Acid etch dentin and apply dentin bonding agent',
        'Pack and light-cure composite resin restoration',
        'Adjust occlusion and polish composite margins'
      ],
      duration: '1 session'
    };
  }

  if (normalized.includes('fractured') || normalized.includes('crown') || normalized.includes('broken')) {
    return {
      plan: [
        'Remove rough edges and prepare tooth core build-up',
        'Full coverage crown margin preparation',
        'Digital scanner impression acquisition',
        'Fabricate and cement temporary acrylic crown',
        'Try-in permanent custom crown, evaluate margins, and cement permanently'
      ],
      duration: '2 sessions'
    };
  }

  return {
    plan: [
      'Comprehensive dental examination',
      'Teeth scaling and cleaning prophylaxis',
      'Fluoride varnish protective application',
      'Review preventive flossing directions'
    ],
    duration: '1 session'
  };
};

/**
 * Promisified timeout wrapper (3.0 seconds maximum wait)
 */
const callOpenAIWithTimeout = async (prompt, systemPrompt) => {
  if (!openai) {
    throw Object.assign(new Error('OpenAI API key not configured'), { statusCode: 501 });
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    }, { signal: controller.signal });

    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

/**
 * 1. Auto Diagnosis Engine
 */
const generateDiagnosis = async ({ symptoms, history, age, previousTreatments, notes, clinicId, userId, patientId, patientName }) => {
  const promptText = `Patient Age: ${age}. Symptoms: "${symptoms}". Medical History: "${history}". Previous Treatments: "${previousTreatments}". Dentist Notes: "${notes}".`;
  const systemPrompt = `You are a dental AI clinical assistant. Analyze inputs and generate diagnosis conditions, risk levels, and recommendations.
Return ONLY valid JSON in this exact format:
{
  "conditions": ["Condition 1", "Condition 2"],
  "riskLevel": "Low" | "Medium" | "High",
  "recommendation": "Suggested next clinical steps..."
}
Do not include explanations, extra text, or markdown code blocks (e.g. no \`\`\`json).`;

  let resultData;
  let status = 'SUCCESS';
  let tokenUsage = null;

  if (hasOpenAIKey()) {
    try {
      const completion = await callOpenAIWithTimeout(promptText, systemPrompt);
      const content = completion.choices[0].message.content.trim();
      resultData = JSON.parse(content);
      tokenUsage = {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      };
    } catch (err) {
      console.warn(`[AI Diagnosis] OpenAI call failed: ${err.message}. Using fallback.`);
      status = 'FALLBACK';
      resultData = getFallbackDiagnosis(symptoms, history);
    }
  } else {
    status = 'FALLBACK';
    resultData = getFallbackDiagnosis(symptoms, history);
  }

  // Trigger alert throttling for High-risk patients
  if (resultData.riskLevel === 'High') {
    const primaryCondition = resultData.conditions?.[0] || 'Unspecified Condition';
    await handleHighRiskAlert({
      clinicId,
      patientId,
      patientName,
      condition: primaryCondition,
      riskLevel: resultData.riskLevel
    });
  }

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'diagnosis',
    promptText,
    responseData: resultData,
    status,
    tokenUsage
  });

  return { ...resultData, executionStatus: status };
};

/**
 * 2. AI Treatment Suggestion Engine
 */
const generateTreatmentPlan = async ({ diagnosis, history, notes, clinicId, userId }) => {
  const promptText = `Diagnosis: "${diagnosis}". History: "${history}". Notes: "${notes}".`;
  const systemPrompt = `You are a dental AI clinical assistant. Generate a step-by-step treatment plan based on diagnosis and history.
Return ONLY valid JSON in this exact format:
{
  "plan": ["Procedure step 1", "Procedure step 2"],
  "duration": "Estimated sessions"
}
Do not include explanations, extra text, or markdown code blocks (e.g. no \`\`\`json).`;

  let resultData;
  let status = 'SUCCESS';
  let tokenUsage = null;

  if (hasOpenAIKey()) {
    try {
      const completion = await callOpenAIWithTimeout(promptText, systemPrompt);
      const content = completion.choices[0].message.content.trim();
      resultData = JSON.parse(content);
      tokenUsage = {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      };
    } catch (err) {
      console.warn(`[AI Treatment Plan] OpenAI call failed: ${err.message}. Using fallback.`);
      status = 'FALLBACK';
      resultData = getFallbackTreatmentPlan(diagnosis);
    }
  } else {
    status = 'FALLBACK';
    resultData = getFallbackTreatmentPlan(diagnosis);
  }

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'treatment-plan',
    promptText,
    responseData: resultData,
    status,
    tokenUsage
  });

  return { ...resultData, executionStatus: status };
};

/**
 * 3. Smart AI Alert System (Analysis)
 */
const analyzeAlerts = async ({ symptoms, history, clinicId, userId, patientId, patientName }) => {
  const promptText = `Patient: ${patientName} (ID: ${patientId}). Symptoms: "${symptoms}". History: "${history}".`;
  const systemPrompt = `You are a dental AI clinical assistant. Analyze symptoms and history for critical allergy flags or high risk conditions requiring warning alerts.
Return ONLY valid JSON in this exact format:
{
  "hasAlert": true | false,
  "alertMessage": "Alert message string here...",
  "severity": "info" | "warning" | "critical"
}
Do not include explanations, extra text, or markdown code blocks.`;

  let resultData;
  let status = 'SUCCESS';
  let tokenUsage = null;

  if (hasOpenAIKey()) {
    try {
      const completion = await callOpenAIWithTimeout(promptText, systemPrompt);
      const content = completion.choices[0].message.content.trim();
      resultData = JSON.parse(content);
      tokenUsage = {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      };
    } catch (err) {
      console.warn(`[AI Alerts] OpenAI call failed: ${err.message}. Using fallback.`);
      status = 'FALLBACK';
      resultData = { hasAlert: false, alertMessage: '', severity: 'info' };
    }
  } else {
    status = 'FALLBACK';
    // Fallback parsing logic
    const combined = `${symptoms || ''} ${history || ''}`.toLowerCase();
    if (combined.includes('penicillin') || combined.includes('latex')) {
      resultData = {
        hasAlert: true,
        alertMessage: `Critical Safety Alert: Patient has documented Penicillin/Latex allergies. Verify scripts.`,
        severity: 'critical'
      };
    } else if (combined.includes('severe pain') || combined.includes('pulpitis')) {
      resultData = {
        hasAlert: true,
        alertMessage: `Urgent Treatment Alert: Patient reports severe dental pain. Expedite clinical diagnosis.`,
        severity: 'warning'
      };
    } else {
      resultData = {
        hasAlert: false,
        alertMessage: '',
        severity: 'info'
      };
    }
  }

  // Trigger actual database alert if high risk alert was generated and is not throttled
  if (resultData.hasAlert && (resultData.severity === 'critical' || resultData.severity === 'warning')) {
    await handleHighRiskAlert({
      clinicId,
      patientId,
      patientName,
      condition: resultData.alertMessage,
      riskLevel: 'High'
    });
  }

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'alerts-analyze',
    promptText,
    responseData: resultData,
    status,
    tokenUsage
  });

  return { ...resultData, executionStatus: status };
};

/**
 * 4. AI Notes Summarizer
 */
const summarizeNotes = async ({ notes, clinicId, userId }) => {
  const promptText = `Notes: "${notes}".`;
  const systemPrompt = `You are a dental AI clinical assistant. Generate a short bullet-point summary of long clinical notes.
Return ONLY valid JSON in this exact format:
{
  "summary": ["Bullet point 1", "Bullet point 2"]
}
Do not include explanations, extra text, or markdown code blocks.`;

  let resultData;
  let status = 'SUCCESS';
  let tokenUsage = null;

  if (hasOpenAIKey()) {
    try {
      const completion = await callOpenAIWithTimeout(promptText, systemPrompt);
      const content = completion.choices[0].message.content.trim();
      resultData = JSON.parse(content);
      tokenUsage = {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      };
    } catch (err) {
      console.warn(`[AI Notes Summarize] OpenAI call failed: ${err.message}. Using fallback.`);
      status = 'FALLBACK';
      resultData = {
        summary: [
          'EHR progress note signed by clinician',
          'Exam details recorded for active treatment file'
        ]
      };
    }
  } else {
    status = 'FALLBACK';
    // Fallback parsing logic
    const summary = [];
    const lines = notes.split('\n').filter(l => l.trim().length > 10);
    if (lines.length > 0) {
      lines.forEach(l => {
        const cleaned = l.replace(/^[-*#\s]+/, '').trim();
        summary.push(cleaned.length > 80 ? cleaned.substring(0, 77) + '...' : cleaned);
      });
    } else {
      summary.push('Patient dental check progress notes logged.');
      summary.push('Standard prophylaxis debridement executed.');
    }
    resultData = { summary: summary.slice(0, 3) };
  }

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'summarize',
    promptText,
    responseData: resultData,
    status,
    tokenUsage
  });

  return { ...resultData, executionStatus: status };
};

/**
 * 5. AI Risk Scoring Engine
 */
const calculateRiskScore = async ({ symptoms, history, age, clinicId, userId }) => {
  const promptText = `Patient Age: ${age}. Symptoms: "${symptoms}". History: "${history}".`;
  const systemPrompt = `You are a dental AI clinical assistant. Calculate the patient's gum disease risk score (0-100) and risk category.
Return ONLY valid JSON in this exact format:
{
  "score": 75,
  "category": "Low" | "Medium" | "High"
}
Do not include explanations, extra text, or markdown code blocks.`;

  let resultData;
  let status = 'SUCCESS';
  let tokenUsage = null;

  if (hasOpenAIKey()) {
    try {
      const completion = await callOpenAIWithTimeout(promptText, systemPrompt);
      const content = completion.choices[0].message.content.trim();
      resultData = JSON.parse(content);
      tokenUsage = {
        promptTokens: completion.usage?.prompt_tokens,
        completionTokens: completion.usage?.completion_tokens,
        totalTokens: completion.usage?.total_tokens
      };
    } catch (err) {
      console.warn(`[AI Risk Score] OpenAI call failed: ${err.message}. Using fallback.`);
      status = 'FALLBACK';
      const combined = `${symptoms || ''} ${history || ''}`.toLowerCase();
      let score = 15;
      let category = 'Low';
      if (Number(age) > 50 || combined.includes('bleeding') || combined.includes('swelling')) {
        score = 80;
        category = 'High';
      } else if (combined.includes('pain') || combined.includes('caries')) {
        score = 55;
        category = 'Medium';
      }
      resultData = { score, category };
    }
  } else {
    status = 'FALLBACK';
    const combined = `${symptoms || ''} ${history || ''}`.toLowerCase();
    let score = 15;
    let category = 'Low';
    if (Number(age) > 50 || combined.includes('bleeding') || combined.includes('swelling')) {
      score = 80;
      category = 'High';
    } else if (combined.includes('pain') || combined.includes('caries')) {
      score = 55;
      category = 'Medium';
    }
    resultData = { score, category };
  }

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'risk-score',
    promptText,
    responseData: resultData,
    status,
    tokenUsage
  });

  return { ...resultData, executionStatus: status };
};

module.exports = {
  generateDiagnosis,
  generateTreatmentPlan,
  analyzeAlerts,
  summarizeNotes,
  calculateRiskScore
};
