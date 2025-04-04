import { chromium } from 'playwright';

export type CourtAvailabilityMap = Record<string, number>;

export const scrapeCourtAvailability = async (): Promise<CourtAvailabilityMap> => {
  console.log('Starting browser...');
  
  // Launch Playwright browser
  const browser = await chromium.launch({
    headless: true,
  });
  
  console.log('Opening new page...');
  const context = await browser.newContext();
  const page = await context.newPage();

  // Set a reasonable navigation timeout
  page.setDefaultTimeout(30000);

  // Navigate to the booking page
  console.log('Navigating to booking page...');
  const today = new Date();
  const formattedDate = today.toISOString().split('T')[0]; // Gets YYYY-MM-DD format
  await page.goto(`https://goodland.podplay.app/book/greenpoint-indoor-1/${formattedDate}`, {
    waitUntil: 'networkidle',
  });

  // Wait for court list to appear
  await page.waitForSelector('ol[class*="BookingItemPicker"][class*="sessions-list"]');
  
  // Wait for content to be ready
  await page.waitForFunction(() => {
    const items = document.querySelectorAll('ol[class*="BookingItemPicker"][class*="sessions-list"] > li');
    // Check if we have items and if they have the expected content
    return items.length > 0 && 
           items[0].querySelector('div[class*="sessions-list-item-time"]')?.textContent?.trim() !== '';
  }, { timeout: 15000 });

  console.log('Extracting court availability data...');
  const rawAvailability = await page.evaluate(() => {
    // Use more resilient selectors that rely on structure rather than exact class names
    const items = Array.from(
      document.querySelectorAll('ol[class*="BookingItemPicker"][class*="sessions-list"] > li')
    );

    return items.map((item) => {
      // Use partial class name matching with attribute selectors
      const timeEl = item.querySelector<HTMLTimeElement>(
        'div[class*="sessions-list-item-time"] time'
      );
      const infoEl = item.querySelector<HTMLDivElement>(
        'div[class*="sessions-list-item-info-tables"]'
      );

      const time = timeEl?.textContent?.trim() || 'Unknown time';
      const info = infoEl?.textContent?.trim() || 'No availability info';

      return { time, info };
    });
  });
  
  console.log('Closing browser...');
  await browser.close();
  
  console.log('Processing availability data...');
  
  // Convert to key-value pairs and filter out unknown entries
  const availabilityMap: CourtAvailabilityMap = {};
  
  for (const item of rawAvailability) {
    // Skip entries with unknown time
    if (item.time === 'Unknown time') continue;
    
    // Extract number of courts using regex
    const courtMatch = item.info.match(/(\d+)\s+open\s+court/);
    if (courtMatch && courtMatch[1]) {
      const numCourts = parseInt(courtMatch[1], 10);
      availabilityMap[item.time] = numCourts;
    }
  }
  
  console.log('Scraping complete!');
  return availabilityMap;
};

// Run the script
scrapeCourtAvailability().then((availability) => {
  console.log('Court availability data:');
  console.log(JSON.stringify(availability, null, 2));
});
