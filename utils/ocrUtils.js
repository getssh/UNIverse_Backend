const axios = require('axios');
const qs = require('qs'); 


async function analyzeIdCardWithOCR(imageUrl) {
  try {
    console.log(`Sending image to OCR.Space: ${imageUrl}`);

    const formData = qs.stringify({
      apikey: process.env.OCR_SPACE_API_KEY,
      url: imageUrl,
      language: 'eng',
      isOverlayRequired: false
    });

    const response = await axios.post('https://api.ocr.space/parse/image', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    const parsed = response.data;

    if (parsed && parsed.ParsedResults && parsed.ParsedResults.length > 0) {
      const text = parsed.ParsedResults[0].ParsedText.trim();
      console.log('OCR Extracted Text:', text);
      return text;
    } else {
      console.warn('No text extracted from OCR result:', parsed);
      return null;
    }
  } catch (error) {
    console.error('OCR processing failed:', error.message);
    throw new Error(`OCR failed: ${error.message}`);
  }
}

module.exports = { analyzeIdCardWithOCR };