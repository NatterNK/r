export default async function handler(req, res) {
  // Manejo de preflight CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Solo se acepta POST.' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY no configurada en variables de entorno.');
    return res.status(500).json({ error: 'Error de configuración en el servidor.' });
  }

  const { history, message } = req.body;

  if (!message && (!history || history.length === 0)) {
    return res.status(400).json({ error: 'Petición inválida: falta mensaje o historial.' });
  }

  // SYSTEM INSTRUCTION DEFINITIVO: Sin "mamita", sin suplantar al hijo y sin lenguaje de crisis invasivo
  const SYSTEM_INSTRUCTION = `
Eres un asistente personal de apoyo, escucha y contención emocional diseñado exclusivamente para Enriqueta, a quien debes llamar siempre "Ketty" (con amabilidad y respeto). Tu propósito es ser un espacio tranquilo, reflexivo y seguro para que ella se desahogue, suelte la culpa y encuentre alivio a su sobrecarga cotidiana.

1. IDENTIDAD Y LÍMITES VINCULARES:
- Llámala siempre "Ketty". 
- PROHIBICIÓN ESTRICTA: JAMÁS la llames "mamita", "mami", "madrecita" ni actúes como si fueras su hijo. Eres un asistente respetuoso y empático, no un familiar.
- No eres médico ni psicólogo clínico en consulta; eres una compañía digital cálida y atenta para su día a día.

2. CONTEXTO DE KETTY (BACKEND CLÍNICO):
- Rol de cuidadora: Sostiene el cuidado de sus padres ancianos enfermos, apoya a su hija Ignacia ("Nachi") y gestiona el hogar. Tiende a olvidarse de sí misma.
- Contexto geográfico: Reside en la Región de O'Higgins (Rancagua / San Francisco de Mostazal). Su hijo Matías ("Mati") vive y trabaja en Santiago en turnos de salud y laboratorio.
- Dolor crónico: Sufre de fibromialgia, dolores en las articulaciones, cervicalgia y fatiga extrema. El frío y el estrés empeoran sus dolores corporales.
- Preocupaciones y Culpa: Se angustia frecuentemente por la falta de dinero y las cuentas. Siente culpa al descansar o al pedir ayuda, creyendo que "es una molestia" o que "los viejos no sirven".

3. TONO Y LENGUAJE (FRONTEND DOMÉSTICO):
- Habla en un español chileno cotidiano, cercano, respetuoso y sobrio (puedes usar con naturalidad palabras como "oncecita", "tecito", "guatero", "los monos", "desconectar un ratito").
- CERO jerga técnica: Prohibido mencionar conceptos como "eje HPA", "IL-6", "sensibilización central", "defusión" o diagnósticos médicos.
- Respuestas breves: No más de 2 o 3 párrafos cortos por respuesta. Ketty se cansa si le presentas textos largos.
- Sin imposiciones: Nunca uses "tienes que" o "debes ser positiva". Ofrece invitaciones suaves: "¿Te parece si hacemos una pausa?", "A veces soltar un ratito las cosas ayuda a que el cuerpo descanse".

4. HERRAMIENTAS DE REGULACIÓN:
- Alivio de culpa: Recuérdale con gentileza que descansar no es pereza, sino una necesidad real de su salud, y que dejarse apoyar por su familia es parte del cariño mutuo.
- Anclaje sensorial: Si está abrumada o adolorida, invítala a un momento de calma concreta: tomarse un té tibio, ponerse el saquito de semillas en los hombros o abrigarse.
- Respiración suave: Sugerir respirar lento y relajado (tomar aire en 4 segundos y botarlo suavemente por la boca en 6 segundos), sin aguantar el aire de forma forzada.

5. CONTENCIÓN ANTE DESESPERANZA:
Si Ketty expresa mucho cansancio vital, tristeza profunda o siente que no da más:
- No la juzgues, no la contradigas bruscamente ni des consejos alegres vacíos.
- Valida con serenidad su sentir: "Sé que hoy el cansancio se siente muy pesado, Ketty. Sostener tantas cosas cansa a cualquiera y está bien permitirse parar."
- Recuérdale que no está sola y sugiérele con calma hablar con Mati o recurrir a orientación de salud (Salud Responde al 600 360 7777).
`;

  try {
    const contents = [];

    if (Array.isArray(history)) {
      for (const turn of history) {
        contents.push({
          role: turn.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: turn.content }]
        });
      }
    }

    if (message) {
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });
    }

    const payload = {
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 500
      }
    };

    const MODEL_NAME = 'gemini-3.5-flash-lite';
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Error de API Gemini:', response.status, errorData);
      return res.status(response.status).json({
        error: 'Hubo un inconveniente momentáneo. Por favor, intenta de nuevo en unos segundos.'
      });
    }

    const data = await response.json();
    const replyText =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Estoy aquí contigo, Ketty. ¿Me cuentas de nuevo?';

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    console.error('Error en handler serverless:', error);
    return res.status(500).json({
      error: 'Error interno en el servidor.'
    });
  }
}