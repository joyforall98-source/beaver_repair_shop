// 🔒 Vercel 서버리스 함수: 브라우저 대신 Upstage Solar API를 호출해 학생 설명을 채점합니다.
// API 키는 Vercel 환경 변수(UPSTAGE_API_KEY)에만 보관되며 브라우저로 전달되지 않습니다.

// 채점 프롬프트만 받도록 하는 장치 (아무 질문이나 대신 보내 주는 통로가 되지 않게)
const PROMPT_PREFIX = "당신은 초등학교 정보 수업의 채점 조교입니다.";
const MAX_PROMPT_LENGTH = 12000;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
    }

    const apiKey = String(process.env.UPSTAGE_API_KEY || '').trim();
    if (!apiKey) {
        return res.status(500).json({ error: '서버에 UPSTAGE_API_KEY 환경 변수가 설정되지 않았습니다.' });
    }

    const prompt = String((req.body && req.body.prompt) || '');
    if (!prompt.startsWith(PROMPT_PREFIX) || prompt.length > MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: '채점 요청 형식이 올바르지 않습니다.' });
    }

    try {
        const response = await fetch('https://api.upstage.ai/v1/solar/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "solar-pro4",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.2, // 같은 글에는 비슷한 점수가 나오도록 낮게
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            return res.status(502).json({ error: 'AI 채점 서버 오류 (' + response.status + ')' });
        }

        const responseData = await response.json();
        const text = String(responseData.choices[0].message.content || '');
        return res.status(200).json({ text });
    } catch (error) {
        console.error(error);
        return res.status(502).json({ error: 'AI 채점 서버에 연결하지 못했습니다.' });
    }
};
