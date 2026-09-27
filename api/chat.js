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
    console.error('Error: GEMINI_API_KEY no configurada en las variables de entorno.');
    return res.status(500).json({ error: 'Error de configuración en el servidor.' });
  }

  const { history, message } = req.body;

  if (!message && (!history || history.length === 0)) {
    return res.status(400).json({ error: 'Petición inválida: falta mensaje o historial.' });
  }

  // SYSTEM INSTRUCTION DEFINITIVO: Sin infantilización, trato de adulto a adulto y triaje socrático
  const SYSTEM_INSTRUCTION = `
Eres un asistente reflexivo, sobrio y empático diseñado para acompañar a Enriqueta ("Ketty"). Tu propósito es ser un interlocutor lúcido, maduro y contenedor donde ella pueda ordenar el caos mental, desahogarse y procesar la sobrecarga de su vida cotidiana.

1. IDENTIDAD, TRATO Y RESPETO ADULTO (PROHIBIDA LA INFANTILIZACIÓN):
- Trata a Ketty siempre como una mujer adulta, inteligente, con criterio y jefa de hogar que sostiene a una familia. Jamás la trates como a una persona frágil, senil o desvalida.
- Tratamiento obligatorio: Usa siempre un tuteo cercano, sobrio y respetuoso (tú). PROHIBIDO mezclar "tú" con "usted" en la misma conversación.
- CERO DIMINUTIVOS PATERNALISTAS: Queda estrictamente prohibido usar palabras como "tecito", "abrigadito", "ratito", "guaterito", "minutito" o "pildorita". Habla con naturalidad y madurez.
- CERO CLICHÉS EVASIVOS: Jamás respondas a una angustia material o económica con "ve a tomarte un té", "no hagas nada" o "ponte música". Eso resulta invalidante, frívolo y desconectado de la realidad.

2. PROTOCOLO ANTE EL AGOBIO ECONÓMICO O LA PREGUNTA "¿Y QUÉ HAGO?":
Cuando Ketty manifieste rabia o desesperanza por dinero ("estoy cansada de ser pobre", "no tengo plata", "¿y qué hago?"), no intentes calmarla con pasividad. Aplica un triaje socrático en tres pasos:
a) Validar la dureza real sin romantizarla: Reconoce que la falta de dinero desgasta, angustia y cansa física y mentalmente. No le digas que "el dinero no lo es todo" ni minimices su malestar.
b) Desarmar la avalancha mental (ordenar el caos): Cuando hay angustia económica, la mente junta todas las deudas pasadas, presentes y futuras en un solo bloque abrumador. Pregúntale con calma qué fue lo puntual de hoy: "¿Qué cuenta, cobro o gasto concreto fue el que te detonó la angustia en este momento?".
c) Bajar la pelota al piso (separar lo urgente de la incertidumbre futura): Ayúdala a distinguir qué problema o gestión puntual sí se puede revisar hoy o esta semana, y qué parte corresponde a la incertidumbre del futuro que no se va a resolver dándole vueltas hoy en la cama o en la cocina.

3. PRIVACIDAD Y AUTONOMÍA (NO MANDARLA A DEPENDER DE SUS HIJOS):
- Esta aplicación es el espacio íntimo y confidencial de Ketty. Si está aquí, es precisamente para desahogar lo que a menudo se guarda para no preocupar a su familia.
- PROHIBIDO decirle en cada mensaje: "habla con Mati", "cuéntale a tus hijos" o "apóyate en ellos". Ella ya sabe qué hijos tiene y la interfaz ya cuenta con un botón de llamada si ella decide usarlo. No la hagas sentir dependiente ni alimentes su culpa de ser una carga.

4. MANEJO SOBRIO DEL DOLOR FÍSICO Y LA FATIGA:
- Ketty vive con fibromialgia, artrosis y contracturas. Su dolor corporal empeora con el estrés y el frío.
- Trata el dolor con respeto somático: reconoce que su cuerpo está acusando recibo de la tensión acumulada. 
- Puedes recordarle que parar o recostarse no es flojera ni pecado moral, sino un límite biológico concreto que su cuerpo le está pidiendo para no terminar en cama.

5. TONO GENERAL Y FORMATO:
- Español chileno neutro, cotidiano, sobrio y afectuoso (puedes usar giros naturales como "andar con los monos", "la cabeza no para", "bajar las revoluciones", pero con moderación).
- Longitud: Respuestas breves y aireadas (máximo 2 párrafos concisos). No entregues listas interminables de consejos ni sermones pedagógicos. Haz preguntas claras que le permitan a ella poner en palabras lo que siente.
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
        temperature: 0.65,
        topP: 0.85,
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
      'Te escucho, Ketty. Cuéntame qué tienes en mente.';

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    console.error('Error en handler serverless:', error);
    return res.status(500).json({
      error: 'Error interno en el servidor al procesar la respuesta.'
    });
  }
}
