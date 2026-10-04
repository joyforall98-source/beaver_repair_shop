// 🔒 Vercel 서버리스 함수: 브라우저 대신 Claude API를 호출해 학생 설명을 채점합니다.
// API 키는 Vercel 환경 변수(ANTHROPIC_API_KEY)에만 보관되며 브라우저로 전달되지 않습니다.
import Anthropic from "@anthropic-ai/sdk";

// 채점 프롬프트만 받도록 하는 장치 (아무 질문이나 대신 보내 주는 통로가 되지 않게)
const PROMPT_PREFIX = "당신은 초등학교 정보 수업의 채점 조교입니다.";
const MAX_PROMPT_LENGTH = 12000;

const client = new Anthropic(); // ANTHROPIC_API_KEY 환경 변수를 읽습니다

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "POST 요청만 허용됩니다." });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "서버에 ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다." });
  }

  const prompt = String((req.body && req.body.prompt) || "");
  if (!prompt.startsWith(PROMPT_PREFIX) || prompt.length > MAX_PROMPT_LENGTH) {
    return res.status(400).json({ error: "채점 요청 형식이 올바르지 않습니다." });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return res.status(200).json({ text });
  } catch (error) {
    console.error(error);
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: "요청이 많아 잠시 후 다시 시도해 주세요." });
    }
    if (error instanceof Anthropic.APIError) {
      return res.status(502).json({ error: "AI 채점 서버 오류 (" + error.status + ")" });
    }
    return res.status(502).json({ error: "AI 채점 서버에 연결하지 못했습니다." });
  }
}
