// services/jobScraper.js
const axios = require('axios');
const cheerio = require('cheerio');


const scrapeHahuJobs = async () => {
  try {
    // Fetch the Hahu Jobs page
    const response = await axios.get('https://www.hahujobs.com/jobs');
    const $ = cheerio.load(response.data);

    const jobs = [];
    
    // Example selector - you'll need to inspect Hahu Jobs page to get correct selectors
    $('.job-listing').each((i, element) => {
      const job = {
        title: $(element).find('.job-title').text().trim(),
        company: $(element).find('.company-name').text().trim(),
        salary: $(element).find('.salary').text().trim(),
        employmentType: $(element).find('.employment-type').text().trim(),
        description: $(element).find('.job-description').text().trim(),
        location: $(element).find('.location').text().trim(),
        sourceUrl: $(element).find('a').attr('href')
      };

      jobs.push(job);
    });

    // Save jobs to database
    for (const jobData of jobs) {
      // Check if job already exists
      const existingJob = await Job.findOne({ sourceUrl: jobData.sourceUrl });
      
      if (!existingJob) {
        await Job.create(jobData);
      }
    }

    return { success: true, count: jobs.length };
  } catch (error) {
    console.error('Scraping error:', error);
    throw new Error('Failed to scrape jobs');
  }
};
module.exports = scrapeHahuJobs;