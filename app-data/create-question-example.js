// 简洁创建题目脚本：修改下面参数后运行 `node app-data/create-question-example.js`
const API_BASE = "http://127.0.0.1:15397";

const params = {
  setName: "测试集v1",
  folderName: "99_临时",
  fileName: "新问题.json",
  content: {
    title: "新问题",
    score: 1,
    systemPrompt: "You are a helpful AI assistant.\n使用中文回答用户问题。",
    note: "",
    expectedAnswer: "",
    checker: `function checkAnswer(answer, correctAnswer) {\n    return answer === correctAnswer;\n}`,
    conversation: [
      {
        user: { parts: [{ type: "text", text: "请在这里填写问题。" }] },
        assistant: [{ mode: "generate", content: "" }],
      },
    ],
  },
};

async function main() {
  const resp = await fetch(`${API_BASE}/api/create-question`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
  console.log("创建成功:", data.path);
}

main().catch((error) => {
  console.error("创建失败:", error.message);
  process.exitCode = 1;
});
