'use strict';
const { OpenAI } = require('openai');
const prisma = require('../../config/db');

// Initialize OpenAI client (only if key exists)
let openai = null;
const modelName = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

const isOpenAIConfigured = () => {
  return !!openai;
};

/**
 * Log AI transaction to db
 */
const logAiTransaction = async ({ clinicId, userId, moduleName, promptText, responseData, status }) => {
  try {
    await prisma.aiLog.create({
      data: {
        clinicId,
        userId,
        module: moduleName,
        prompt: (promptText || '').substring(0, 1000),
        response: JSON.stringify({
          status,
          data: responseData
        })
      }
    });
  } catch (err) {
    console.error('[AI Audit Logs] Failed to persist AI transaction log:', err.message);
  }
};

/**
 * General Chat Completion
 */
const chatCompletions = async (systemPrompt, userPrompt) => {
  if (!isOpenAIConfigured()) {
    throw new Error('AI service not configured');
  }
  const completion = await openai.chat.completions.create({
    model: modelName,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    temperature: 0.2
  });
  return completion.choices[0].message.content.trim();
};

/**
 * AI Radiograph Vision Analyzer
 */
const analyzeXray = async ({ base64Image, imageType, clinicId, userId }) => {
  if (!isOpenAIConfigured()) {
    throw new Error('AI service not configured');
  }

  // base64Image should be the raw base64 or data url. Make sure we extract base64.
  let base64Data = base64Image;
  if (base64Image.includes(',')) {
    base64Data = base64Image.split(',')[1];
  }

  const systemPrompt = `You are an expert dental radiologist AI. Analyze this dental radiograph image (${imageType || 'General'}) and identify possible abnormalities.
Return ONLY valid JSON in this exact format:
{
  "cariesDetected": true | false,
  "cariesConfidence": number, // 0-100
  "boneLossDetected": true | false,
  "boneLossPercentage": number, // 0-100
  "observations": ["Observation bullet 1", "Observation bullet 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "cariesCoordinates": [{"x": number, "y": number, "w": number, "h": number, "label": "Tooth #..."}] // x,y,w,h in percentage (0-100) relative to image boundaries
}
Do not include explanations, extra text, or markdown code blocks (e.g. no \`\`\`json).`;

  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: systemPrompt },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Data}`
              }
            }
          ]
        }
      ],
      temperature: 0.1
    });

    const content = response.choices[0].message.content.trim();
    const parsedData = JSON.parse(content.replace(/```json/g, '').replace(/```/g, ''));
    
    await logAiTransaction({
      clinicId,
      userId,
      moduleName: 'vision-xray',
      promptText: `Analyze xray: ${imageType}`,
      responseData: parsedData,
      status: 'SUCCESS'
    });

    return parsedData;
  } catch (err) {
    console.error('[OpenAI Vision] Failed to analyze radiograph:', err);
    throw err;
  }
};

/**
 * AI Clinical Copilot Summary
 */
const generatePatientSummary = async ({ patientData, clinicId, userId }) => {
  if (!isOpenAIConfigured()) {
    throw new Error('AI service not configured');
  }

  const promptText = JSON.stringify(patientData);
  const systemPrompt = `You are a clinical copilot. Generate a comprehensive summary for a dentist about this patient.
Analyze all conditions, medications, allergies, appointments, treatments, and prescriptions.
Return ONLY valid JSON in this exact format:
{
  "medicalConditions": ["Condition 1", "Condition 2"],
  "allergies": ["Allergy 1", "Allergy 2"],
  "activeMedications": ["Medication 1", "Medication 2"],
  "warnings": ["Warning 1 (e.g. avoid epinephrine, bleeding risk)"],
  "outstandingTreatment": ["Treatment 1", "Treatment 2"],
  "prescriptionAlerts": ["Alert 1", "Alert 2"],
  "recallStatus": "Due soon" | "Active" | "Overdue",
  "recentImaging": ["Image summary 1", "Image summary 2"]
}
Do not include extra text, explanations, or markdown code blocks.`;

  try {
    const response = await openai.chat.completions.create({
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: promptText }
      ],
      temperature: 0.2
    });

    const content = response.choices[0].message.content.trim();
    const parsedData = JSON.parse(content.replace(/```json/g, '').replace(/```/g, ''));

    await logAiTransaction({
      clinicId,
      userId,
      moduleName: 'patient-summary',
      promptText: `Summarize patient profile ID: ${patientData.id}`,
      responseData: parsedData,
      status: 'SUCCESS'
    });

    return parsedData;
  } catch (err) {
    console.error('[OpenAI Copilot] Summary generation failed:', err);
    throw err;
  }
};

/**
 * AI Diagnosis Generator
 */
const generateDiagnosis = async ({ symptoms, history, age, previousTreatments, notes, clinicId, userId }) => {
  if (!isOpenAIConfigured()) {
    throw new Error('AI service not configured');
  }

  const promptText = `Patient Age: ${age}. Symptoms: "${symptoms}". History: "${history}". Previous Treatments: "${previousTreatments}". Notes: "${notes}".`;
  const systemPrompt = `You are a dental AI clinical assistant. Generate diagnosis conditions, risk levels, and recommendations.
Return ONLY valid JSON in this exact format:
{
  "conditions": ["Condition 1", "Condition 2"],
  "riskLevel": "Low" | "Medium" | "High",
  "recommendation": "Suggested next steps..."
}
Do not include explanations, extra text, or markdown code blocks.`;

  const responseText = await chatCompletions(systemPrompt, promptText);
  const parsedData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'diagnosis',
    promptText,
    responseData: parsedData,
    status: 'SUCCESS'
  });

  return parsedData;
};

/**
 * AI Treatment Suggestion
 */
const generateTreatmentPlan = async ({ diagnosis, history, notes, clinicId, userId }) => {
  if (!isOpenAIConfigured()) {
    throw new Error('AI service not configured');
  }

  const promptText = `Diagnosis: "${diagnosis}". History: "${history}". Notes: "${notes}".`;
  const systemPrompt = `You are a dental AI clinical assistant. Generate a step-by-step treatment plan based on diagnosis.
Return ONLY valid JSON in this exact format:
{
  "plan": ["Procedure step 1", "Procedure step 2"],
  "duration": "Estimated sessions"
}
Do not include explanations, extra text, or markdown code blocks.`;

  const responseText = await chatCompletions(systemPrompt, promptText);
  const parsedData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'treatment-plan',
    promptText,
    responseData: parsedData,
    status: 'SUCCESS'
  });

  return parsedData;
};

/**
 * AI Alerts Check
 */
const analyzeAlerts = async ({ symptoms, history, clinicId, userId }) => {
  if (!isOpenAIConfigured()) {
    throw new Error('AI service not configured');
  }

  const promptText = `Symptoms: "${symptoms}". History: "${history}".`;
  const systemPrompt = `You are a dental AI clinical assistant. Identify allergy flags or risk conditions.
Return ONLY valid JSON in this exact format:
{
  "hasAlert": true | false,
  "alertMessage": "Alert message...",
  "severity": "info" | "warning" | "critical"
}
Do not include extra text or markdown.`;

  const responseText = await chatCompletions(systemPrompt, promptText);
  const parsedData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'alerts-analyze',
    promptText,
    responseData: parsedData,
    status: 'SUCCESS'
  });

  return parsedData;
};

/**
 * Notes Summarizer
 */
const summarizeNotes = async ({ notes, clinicId, userId }) => {
  if (!isOpenAIConfigured()) {
    throw new Error('AI service not configured');
  }

  const promptText = `Notes: "${notes}".`;
  const systemPrompt = `You are a dental AI assistant. Generate a short list of clinical bullet points.
Return ONLY valid JSON in this exact format:
{
  "summary": ["Bullet 1", "Bullet 2"]
}
Do not include explanations or markdown.`;

  const responseText = await chatCompletions(systemPrompt, promptText);
  const parsedData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'summarize',
    promptText,
    responseData: parsedData,
    status: 'SUCCESS'
  });

  return parsedData;
};

/**
 * Risk Scoring Engine
 */
const calculateRiskScore = async ({ symptoms, history, age, clinicId, userId }) => {
  if (!isOpenAIConfigured()) {
    throw new Error('AI service not configured');
  }

  const promptText = `Age: ${age}. Symptoms: "${symptoms}". History: "${history}".`;
  const systemPrompt = `You are a dental AI assistant. Calculate patient risk score (0-100) and risk category.
Return ONLY valid JSON in this exact format:
{
  "score": number,
  "category": "Low" | "Medium" | "High"
}
Do not include explanations or markdown.`;

  const responseText = await chatCompletions(systemPrompt, promptText);
  const parsedData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));

  await logAiTransaction({
    clinicId,
    userId,
    moduleName: 'risk-score',
    promptText,
    responseData: parsedData,
    status: 'SUCCESS'
  });

  return parsedData;
};

module.exports = {
  isOpenAIConfigured,
  analyzeXray,
  generatePatientSummary,
  generateDiagnosis,
  generateTreatmentPlan,
  analyzeAlerts,
  summarizeNotes,
  calculateRiskScore
};
