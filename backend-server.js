// Importar as bibliotecas necessárias
// Precisa de as instalar com: npm install express cors
import express from 'express';
import cors from 'cors';
// fetch já é global no Node.js 18+

// --- CONFIGURAÇÃO DE SEGURANÇA ---
// Apanhar a API Key das "variáveis de ambiente" do servidor.
// NUNCA escreva a chave diretamente neste ficheiro!
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;

// Inicializar o servidor
const app = express();
app.use(cors()); // Permite que o HTML (numa origem diferente) chame este servidor
app.use(express.json()); // Permite ao servidor ler JSON enviado pelo frontend

// --- O NOSSO ENDPOINT DE CORREÇÃO ---
// O frontend (HTML) vai enviar os pedidos para aqui
app.post('/api/correct', async (req, res) => {
    // 1. Verificar se a API Key está configurada no servidor
    if (!GEMINI_API_KEY) {
        console.error("Erro: GEMINI_API_KEY não está definida no ambiente.");
        return res.status(500).json({ error: "Configuração do servidor incompleta." });
    }

    try {
        // 2. Ler os dados enviados pelo frontend
        const { type, data } = req.body;

        let systemPrompt;
        let userQuery;
        let responseSchema;

        // 3. Definir os 'prompts' da IA (exatamente como tínhamos no frontend)
        if (type === 'reading') {
            systemPrompt = `És um professor de Inglês a corrigir uma ficha do 6º ano. As perguntas e respostas esperadas (em inglês) são:
1. When is João's birthday? (Expected: On 31st October / 31st October)
2. Where does he live? (Expected: In Hawkins, Indiana / Hawkins)
3. What is his sister's name? (Expected: Eleven)
4. Who is Demogorgon? (Expected: His dog / João's dog)
5. What’s his favourite type of food? (Expected: Waffles)

Avalia as 5 respostas do aluno. Atribui 2 pontos por resposta totalmente correta e 1 ponto por parcialmente correta.
Formata a resposta como um JSON {"score": S, "maxScore": 10, "feedback": "<ul><li>...</li></ul>"}.
O feedback (em Português) deve ser uma lista <ul> com 5 <li>, um para cada resposta.`;
            
            userQuery = "Respostas do Aluno:\n";
            userQuery += `1. ${data['q1-ans-1']}\n`;
            userQuery += `2. ${data['q1-ans-2']}\n`;
            userQuery += `3. ${data['q1-ans-3']}\n`;
            userQuery += `4. ${data['q1-ans-4']}\n`;
            userQuery += `5. ${data['q1-ans-5']}\n`;

            responseSchema = {
                type: "OBJECT",
                properties: { "score": { "type": "NUMBER" }, "maxScore": { "type": "NUMBER" }, "feedback": { "type": "STRING" } }
            };

        } else if (type === 'writing') {
            systemPrompt = `És um professor de Inglês experiente a corrigir um texto (redação) de um aluno do 6º ano, em Portugal. O tema é "My Best Friend".

Avalia o texto com base nos seguintes critérios (Total 20 pontos):
1.  **Task Achievement (5 pontos):** Abordou o tema?
2.  **Vocabulary (5 pontos):** Usou vocabulário relevante?
3.  **Grammar (5 pontos):** Usou o "To Be" e "Have Got" corretamente?
4.  **Coherence & Cohesion (5 pontos):** O texto é fácil de ler?

Fornece feedback construtivo em Português.
Formata a resposta como um JSON:
{"score": S, "maxScore": 20, "feedback": "<p>Feedback...</p><ul><li>Task: X/5</li><li>Vocab: Y/5</li><li>Grammar: Z/5</li><li>Coherence: W/5</li></ul>"}`;
            
            userQuery = `Texto do Aluno: "${data}"`;

            responseSchema = {
                type: "OBJECT",
                properties: { "score": { "type": "NUMBER" }, "maxScore": { "type": "NUMBER" }, "feedback": { "type": "STRING" } }
            };

        } else {
            return res.status(400).json({ error: "Tipo de correção inválido." });
        }

        // 4. Construir o 'payload' para a API do Gemini
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        };

        // 5. Chamar a API do Gemini (de forma segura, a partir do servidor)
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Erro da API Gemini: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        const candidate = result.candidates?.[0];

        if (candidate && candidate.content?.parts?.[0]?.text) {
            // 6. Enviar a resposta (o JSON de feedback) de volta para o frontend
            // Damos parse ao texto para o enviar como um objeto JSON
            res.status(200).json(JSON.parse(candidate.content.parts[0].text));
        } else {
            throw new Error("Resposta da IA inválida.");
        }

    } catch (error) {
        console.error("Erro no endpoint /api/correct:", error);
        res.status(500).json({ error: "Ocorreu um erro ao processar a correção." });
    }
});

// Iniciar o servidor na porta 3000
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor backend a correr na porta ${PORT}`);
    console.log("Certifique-se que a sua GEMINI_API_KEY está definida!");
});
