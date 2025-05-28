const axios = require('axios');

const SIGHTENGINE_API_USER = process.env.SIGHTENGINE_API_USER;
const SIGHTENGINE_API_SECRET = process.env.SIGHTENGINE_API_SECRET;

const SIGHTENGINE_BASE_URL = 'https://api.sightengine.com/1.0';

/**
 * Checks the text content for moderation.
 * @param {string} text - The text to check.
 * @returns {Promise<object>} The result of the moderation.
 */
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

/**
 * Checks the image content for moderation.
 * @param {string} imageUrl - The URL of the image to check.
 * @returns {Promise<object>} The result of the moderation.
 */
exports.checkImageContent = async (imageUrl) => {
  try {
    // Check if the URL ends with common image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
    const isImage = imageExtensions.some(ext => imageUrl.toLowerCase().endsWith(ext));
    
    if (!isImage) {
      // If it's not an image, return as safe (or handle differently)
      return { isSafe: true, details: { skipped: 'Not an image file' } };
    }

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
