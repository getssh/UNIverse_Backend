// utils/jobScraperCron.js
const cron = require('node-cron');
const { scrapeHahuJobs } = require('../services/JobScraper');

// Run every day at 3 AM
const setupJobScrapingCron = () => {
  cron.schedule('0 3 * * *', async () => {
    console.log('Running daily job scraping...');
    try {
      const result = await scrapeHahuJobs();
      console.log(`Scraped ${result.count} jobs`);
    } catch (error) {
      console.error('Cron job scraping error:', error);
    }
  });
};

module.exports = setupJobScrapingCron;