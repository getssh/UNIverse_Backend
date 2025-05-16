const axios = require('axios');

const callHuggingFaceChatbot = async (userMessage) => {
  const API_TOKEN = process.env.HUGGING_FACE_API_TOKEN;
  const API_URL = process.env.HUGGING_FACE_API_URL

  try {
    const response = await axios.post(
      API_URL,
      { inputs: userMessage },
      {
        headers: {
          Authorization: `Bearer ${API_TOKEN}`,
        },
      }
    );

    const botReply = response.data.generated_text || "Sorry, I didn't understand that.";
    return botReply;

  } catch (error) {
    console.error('Hugging Face API Error:', error.message);
    throw new Error('Chatbot service unavailable');
  }
};

module.exports = { callHuggingFaceChatbot };
