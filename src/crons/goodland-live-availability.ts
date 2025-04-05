import dotenv from 'dotenv';
import { scrapeCourtAvailability } from '../scrapers/goodland';
import { db } from '../db';
import { courtAvailability } from '../db/schema';

// Load environment variables
dotenv.config();

async function runCourtAvailabilityCron() {
  console.log('Starting court availability cron job...');
  
  try {
    // Scrape the latest court availability data
    console.log('Scraping court availability data...');
    const availabilityData = await scrapeCourtAvailability();
    
    console.log('Scraped data:', availabilityData);
    
    // First, delete all existing records from the table
    console.log('Clearing existing court availability data...');
    await db.delete(courtAvailability);
    
    // Prepare all new records for insertion
    const newRecords = [];
    
    // Process the nested structure of availabilityData
    for (const [date, timesMap] of Object.entries(availabilityData)) {
      for (const [time, availableCourts] of Object.entries(timesMap)) {
        newRecords.push({
          date,
          time,
          availableCourts,
        });
      }
    }
    
    // Insert all new records in a single operation
    console.log(`Inserting ${newRecords.length} new availability records...`);
    await db.insert(courtAvailability).values(newRecords);
    
    console.log('Court availability data successfully updated in the database');
  } catch (error) {
    console.error('Error in court availability cron job:', error);
    // Don't exit the process in serverless environment
    throw error;
  }
}

// Run the script
runCourtAvailabilityCron()
  .then(() => {
    console.log('Cron job completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Unhandled error in cron job:', error);
    process.exit(1);
  });