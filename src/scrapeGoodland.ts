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

    // Track unavailable time ranges
    const unavailableRanges: string[] = [];

    // First pass: collect unavailable time ranges
    items.forEach(item => {
      const unavailableCard = item.querySelector('div[class*="unavailable-card"]');
      if (unavailableCard) {
        const timeDiv = unavailableCard.querySelector('div[class*="unavailable-card__time"]');
        if (timeDiv) {
          const timeText = timeDiv.textContent?.trim() || '';
          unavailableRanges.push(timeText);
        }
      }
    });

    return {
      availableItems: items.map((item) => {
        // Skip unavailable cards in this mapping
        if (item.querySelector('div[class*="unavailable-card"]') !== null) {
          return { time: 'Unavailable', info: 'No courts available' };
        }
        
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
      }),
      unavailableRanges
    };
  });
  
  console.log('Closing browser...');
  await browser.close();
  
  console.log('Processing availability data...');
  
  // Convert to key-value pairs and filter out unknown entries
  const availabilityMap: CourtAvailabilityMap = {};
  
  // Process unavailable time ranges to extract specific times
  const unavailableTimes = new Set<string>();
  for (const range of rawAvailability.unavailableRanges) {
    // Extract start and end times from ranges like "5:00pm - 7:30pm"
    const match = range.match(/(\d+:\d+(?:am|pm))\s*-\s*(\d+:\d+(?:am|pm))/i);
    if (match) {
      const startTimeStr = match[1];
      const endTimeStr = match[2];
      
      // For the specific use case of hourly court bookings, we can simplify:
      if (!startTimeStr.includes(':30')) {
        unavailableTimes.add(startTimeStr);
      }
    }
  }
  
  for (const item of rawAvailability.availableItems) {
    // Skip entries with unknown time or unavailable blocks
    if (item.time === 'Unknown time' || item.time === 'Unavailable') continue;
    
    // Skip half-hour times (those containing ":30")
    if (item.time.includes(':30')) continue;
    
    // Skip times that are in unavailable ranges
    if (unavailableTimes.has(item.time)) continue;
    
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
