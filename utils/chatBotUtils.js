// utils/chatApi.js
const axios = require('axios');

const chatWithDeepSeek = async (message) => {
  const response = await axios.post(
    'https://api.deepinfra.com/v1/openai/chat/completions',
    {
      model: "deepseek-ai/DeepSeek-R1-Turbo",
      "messages": [
        {
          "role": "user",
          "content": `${message}`
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPINFRA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
};

module.exports = chatWithDeepSeek;
