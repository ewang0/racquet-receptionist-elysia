import { Elysia } from "elysia";
import dotenv from 'dotenv';
import { scrapeCourtAvailability } from './scrapeGoodland';
import { Twilio } from "twilio";
import { t } from "elysia";
import { db } from './db';
import { courtAvailability } from './db/schema';

// Load environment variables
dotenv.config();

// Environment variables validation
const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const retellApiKey = process.env.RETELL_API_KEY;

if (!retellApiKey) {
  throw new Error('RETELL_API_KEY is required');
}

// Define types for our responses
type SuccessResponse = {
  intent: string;
  data: any;
  context: string;
}

type ErrorResponse = {
  intent: string;
  data: {
    error: string;
  };
  context: string;
}

// Create Elysia app
const app = new Elysia()
  .get("/", () => "Hello Elysia")
  
  // Court availability endpoint
  .post("/goodland/court-availability", async () => {
    try {
      console.log('Fetching court availability from database...');
      const availabilityData = await db.select().from(courtAvailability);
      
      const responseData: SuccessResponse = {
        intent: "court_availability",
        data: {
          availability: availabilityData
        },
        context: "Court availability data retrieved from database."
      };
     
      console.log("responseData:", responseData);
      return responseData;
    } catch (error: unknown) {
      console.error('Error fetching court availability from database:', error);
      
      const responseData: ErrorResponse = {
        intent: "error",
        data: {
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        context: "An error occurred while fetching court availability from database."
      };
      
      return new Response(JSON.stringify(responseData), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  })
  
  // SMS sending endpoint with request body validation
  .post("/goodland/send-sms", 
    async ({ body }) => {
      console.log('SMS endpoint called with body:', body);
      const accountSid = process.env.TWILIO_ACCOUNT_SID!;
      const authToken = process.env.TWILIO_AUTH_TOKEN!;
      const whatsappFrom = process.env.TWILIO_WHATSAPP_NUMBER!;
      console.log('Twilio credentials loaded:', { accountSid, whatsappFrom });
      const whatsappTo = process.env.TWILIO_WHATSAPP_TO_NUMBER!;
      
      const { courtNumber, time } = body as { courtNumber: string | number, time: string };
      const message = `Thanks for sending a booking request for court ${courtNumber} at ${time}. Please follow this link to book and confirm your reservation: https://goodland.podplay.app/book`;

      const client = new Twilio(accountSid, authToken);

      try {
        const response = await client.messages.create({
          from: `whatsapp:${whatsappFrom}`,
          to: `whatsapp:${whatsappTo}`,
          body: message,
        });

        console.log(`twilioResponse:`, response);

        return { success: true, response };
      } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    },
    {
      body: t.Object({
        courtNumber: t.String(),
        time: t.String()
      })
    }
  )
  
  .listen(port);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
