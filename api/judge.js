// 🔒 Vercel 서버리스 함수: 브라우저 대신 Upstage Solar API를 호출해 학생 설명을 채점합니다.
// API 키는 Vercel 환경 변수(UPSTAGE_API_KEY)에만 보관되며 브라우저로 전달되지 않습니다.

// 채점 프롬프트만 받도록 하는 장치 (아무 질문이나 대신 보내 주는 통로가 되지 않게)
const PROMPT_PREFIX = "당신은 초등학교 정보 수업의 채점 조교입니다.";
const MAX_PROMPT_LENGTH = 12000;

// 학생 화면에 보일 안내. 실제 원인(상태코드·Upstage 응답)은 Vercel 기록(Logs)에만 남깁니다
const RESTING = '채점 기능을 담당하는 AI가 잠시 쉬는 시간이 필요하여 스스로 점검하는 모드로 바꿨어요. 잠시 뒤에 다시 시도해보세요.';
const BUSY = '지금 질문이 많아 바로 답하기 어려워요. 잠시 뒤 다시 시도해 보세요.';

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'POST 요청만 허용됩니다.' });
    }

    const apiKey = String(process.env.UPSTAGE_API_KEY || '').trim();
    if (!apiKey) {
        console.error('UPSTAGE_API_KEY 환경 변수가 없습니다');
        return res.status(500).json({ error: RESTING });
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
            // 401·403: 키 문제 또는 크레딧 소진, 429: 요청이 너무 많음
            console.error('Upstage 오류', response.status, (await response.text()).slice(0, 500));
            return res.status(502).json({ error: response.status === 429 ? BUSY : RESTING });
        }

        const responseData = await response.json();
        const text = String(responseData.choices[0].message.content || '');
        return res.status(200).json({ text });
    } catch (error) {
        console.error(error);
        return res.status(502).json({ error: RESTING });
    }
};
