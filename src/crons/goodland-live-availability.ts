import dotenv from 'dotenv';
import { scrapeCourtAvailability } from '../scrapeGoodland';
import { db } from '../db';
import { courtAvailability } from '../db/schema';
import { eq } from 'drizzle-orm';

// Load environment variables
dotenv.config();

async function runCourtAvailabilityCron() {
  console.log('Starting court availability cron job...');
  
  try {
    // Scrape the latest court availability data
    console.log('Scraping court availability data...');
    const availabilityData = await scrapeCourtAvailability();
    
    console.log('Scraped data:', availabilityData);
    
    // Process and store each time slot's availability
    const insertPromises = Object.entries(availabilityData).map(async ([time, availableCourts]) => {
      // Check if this time slot already exists in the database
      const existingRecords = await db.select()
        .from(courtAvailability)
        .where(eq(courtAvailability.time, time));
      
      if (existingRecords.length > 0) {
        // Update existing record
        console.log(`Updating availability for time: ${time}`);
        return db.update(courtAvailability)
          .set({ availableCourts })
          .where(eq(courtAvailability.time, time));
      } else {
        // Insert new record
        console.log(`Inserting new availability for time: ${time}`);
        return db.insert(courtAvailability)
          .values({ time, availableCourts });
      }
    });
    
    // Wait for all database operations to complete
    await Promise.all(insertPromises);
    
    console.log('Court availability data successfully updated in the database');
  } catch (error) {
    console.error('Error in court availability cron job:', error);
    // Don't exit the process in serverless environment
    throw error;
  }
}

// Export the function for serverless execution
export default runCourtAvailabilityCron;

// If running directly (not imported), execute the function
if (require.main === module) {
  runCourtAvailabilityCron()
    .then(() => {
      console.log('Cron job completed successfully');
      // Only exit if running directly
      process.exit(0);
    })
    .catch((error) => {
      console.error('Unhandled error in cron job:', error);
      process.exit(1);
    });
} 