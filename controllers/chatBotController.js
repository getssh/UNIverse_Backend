const chatWithDeepSeek = require('../utils/chatBotUtils');

const chatController = async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required.' });
  }

  try {
    const result = await chatWithDeepSeek(message);
    const reply = result.choices[0].message.content || 'No response from model';
    res.json({ reply });
  } catch (error) {
    console.error('Toge API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch response' });
  }
};

module.exports = chatController;
