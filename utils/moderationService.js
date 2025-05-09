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
        models: 'general',
        mode: 'ml',
        api_user: SIGHTENGINE_API_USER,
        api_secret: SIGHTENGINE_API_SECRET
      }
    });

    const { moderation_classes } = response.data;
    const isSafe =
      moderation_classes.sexual < 0.5 &&
      moderation_classes.discriminatory < 0.5 &&
      moderation_classes.insulting < 0.5 &&
      moderation_classes.violent < 0.5 &&
      moderation_classes.toxic < 0.5

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

    const { nudity, weapon, medical, recreational_drug, offensive, violence } = response.data;
      const isSafe =
        nudity.none >= 0.85 &&
        Object.values(weapon.classes).every(val => val < 0.3) &&
        recreational_drug.prob < 0.5 &&
        medical.prob < 0.9 && 
        Object.values(offensive).every(val => val < 0.5) &&
        violence.prob < 0.5

    return { isSafe, details: response.data };
  } catch (err) {
    console.error('Sightengine image moderation error:', err.message);
    throw err;
  }
};
