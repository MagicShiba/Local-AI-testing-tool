# 创建问题 API 调用说明

启动服务后，向本机接口发送 `POST /api/create-question`。

```bash
node app-data/create-question-example.js
```

请求 JSON：

```json
{
  "setName": "测试集v1",
  "folderName": "99_临时",
  "fileName": "新问题.json",
  "content": {
    "title": "新问题",
    "score": 1,
    "systemPrompt": "You are a helpful AI assistant.\n使用中文回答用户问题。",
    "note": "",
    "expectedAnswer": "",
    "checker": "function checkAnswer(answer, correctAnswer) { return answer === correctAnswer; }",
    "conversation": [
      {
        "user": { "parts": [{ "type": "text", "text": "请在这里填写问题。" }] },
        "assistant": [{ "mode": "generate", "content": "" }]
      }
    ]
  }
}
```

返回：

```json
{ "ok": true, "path": "测试集v1/99_临时/新问题.json" }
```
