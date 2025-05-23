const axios = require('axios');

const chatWithDeepSeek = async (message) => {
  const response = await axios.post(
    'https://api.together.xyz/v1/chat/completions',
    {
      model: "deepseek-ai/DeepSeek-V3",
      "messages": [
        {
          "role": "user",
          "content": `${message}`
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
};

module.exports = chatWithDeepSeek;
