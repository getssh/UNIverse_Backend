const puppeteer = require('puppeteer');
const axios = require('axios');

// Replace with your API endpoint that adds a job (controller route)
const API_ENDPOINT = 'http://localhost:5000/api/jobs/jobs'; // Adjust the port and route if needed

(async () => {
  console.log('🟡 Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log('🌐 Navigating to EthioJobs...');
  await page.goto('https://www.ethiojobs.net/jobs', { waitUntil: 'networkidle2' });

  console.log('⏳ Waiting for job cards...');
  await page.waitForSelector('.job-card-item-container', { timeout: 30000 });

  const jobs = await page.$$eval('.job-card-item-container', jobCards => {
    return jobCards.map(card => {
      const getText = (selector) => card.querySelector(selector)?.innerText.trim() || 'Not specified';

      return {
        title: card.querySelector('a > p')?.innerText.trim() || 'Not specified', // 🔧 Fixed title extraction
        company: getText('.company-name'),
        location: getText('.location'),
        jobType: 'Full-Time',
        salary: 'Not specified',
        description: getText('.job-desc'),
        requirements: '',
        benefits: '',
        sourceUrl: window.location.href
      };
    });
  });

  console.log(`📦 Extracted ${jobs.length} job(s). Sending to API...`);

  for (const job of jobs) {
    try {
      const res = await axios.post(API_ENDPOINT, job);
      console.log(`✅ Job saved: ${job.title}`);
    } catch (err) {
      console.error(`❌ Failed to save job: ${job.title}`, err.response?.data || err.message);
    }
  }

  await browser.close();
  console.log('🚀 Done.');
})();
