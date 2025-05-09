const axios = require('axios');

const SIGHTENGINE_API_USER = process.env.SIGHTENGINE_API_USER;
const SIGHTENGINE_API_SECRET = process.env.SIGHTENGINE_API_SECRET;

const SIGHTENGINE_BASE_URL = 'https://api.sightengine.com/1.0';

exports.checkTextContent = async (text) => {
  try {
    const response = await axios.get(`${SIGHTENGINE_BASE_URL}/text/check.json`, {
      params: {
        text: text,
        lang: 'en',
        mode: 'standard',
        api_user: SIGHTENGINE_API_USER,
        api_secret: SIGHTENGINE_API_SECRET
      }
    });

    const { profanity, personal, sexual, hate, violence } = response.data;
    const isSafe =
      !profanity.matches.length &&
      !personal.matches.length &&
      !sexual.matches.length &&
      !hate.matches.length &&
      !violence.matches.length;

    return { isSafe, details: response.data };
  } catch (err) {
    console.error('Sightengine text moderation error:', err.message);
    throw err;
  }
};

exports.checkImageContent = async (imageUrl) => {
  try {
    const response = await axios.get(`${SIGHTENGINE_BASE_URL}/check.json`, {
      params: {
        url: imageUrl,
        models: 'nudity-2.1,weapon,recreational_drug,medical,offensive-2.0,violence',
        api_user: SIGHTENGINE_API_USER,
        api_secret: SIGHTENGINE_API_SECRET
      }
    });

    const { nudity, weapon, alcohol, drugs, offensive } = response.data;
    const isSafe =
      nudity.safe >= 0.5 &&
      weapon === 0.5 &&
      alcohol === 0.5 &&
      drugs === 0.5 &&
      offensive.prob <= 0.5 &&
      violence.prob <= 0.5;

    return { isSafe, details: response.data };
  } catch (err) {
    console.error('Sightengine image moderation error:', err.message);
    throw err;
  }
};
