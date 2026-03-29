import { google } from "googleapis";
import fs from "fs";
import path from "path";

// Configure auth with Service Account
// You can either place 'service-account.json' in the project root
// Or set the GOOGLE_SERVICE_ACCOUNT_KEY environment variable (as a JSON string)

function getAuth() {
  const envKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const keyFilePath = path.join(process.cwd(), "service-account.json");
  const fileExists = fs.existsSync(keyFilePath);

  const scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
  ];

  if (envKey) {
    try {
      return new google.auth.GoogleAuth({
        credentials: JSON.parse(envKey),
        scopes,
      });
    } catch (e) {
      console.error("Error parsing GOOGLE_SERVICE_ACCOUNT_KEY:", e);
    }
  }

  if (fileExists) {
    return new google.auth.GoogleAuth({
      keyFile: keyFilePath,
      scopes,
    });
  }

  return null;
}

export async function exportToSheets(data: any[]) {
  const auth = getAuth();
  
  if (!auth) {
    throw new Error("Google Cloud credentials not found. Please place 'service-account.json' in the project root or set 'GOOGLE_SERVICE_ACCOUNT_KEY' in your .env file.");
  }

  const sheets = google.sheets({ version: "v4", auth });

  // TEMP: Test permission directly
  const authClient = await auth.getClient() as any;
  console.log("🔑 Authenticating with Service Account Email:", authClient.email || authClient.client_email || "Email not found");

  try {
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
    
    if (!spreadsheetId) {
      throw new Error("GOOGLE_SPREADSHEET_ID not found in your .env file. Please create a sheet, copy its ID from the URL, share it with your service account email, and add it to .env.");
    }

    // 2. Prepare Header Row (Only added if the spreadsheet is potentially empty or the user wants it)
    // For a persistent sheet, we might want to check if headers exist, 
    // but for simplicity, we'll just append data directly.
    const header = [
      "Company Name",
      "Founder LinkedIn",
      "Email",
      "Date Founded",
      "Funding Total",
      "Latest Funding",
      "Source of Proof",
      "Marketing Manager LinkedIn",
      "Marketing Manager Email"
    ];

    // 3. Prepare Data Rows
    const values = data.map(c => {
      let sourceOfProof = 'Not specified';
      const rawSource = c.source_of_proof;
      
      if (Array.isArray(rawSource)) {
        sourceOfProof = rawSource.filter(Boolean).join(', ');
      } else if (typeof rawSource === 'string') {
        const trimmed = rawSource.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          try {
            const parsed = JSON.parse(trimmed.replace(/'/g, '"'));
            sourceOfProof = Array.isArray(parsed) ? parsed.filter(Boolean).join('\n') : trimmed;
          } catch {
            // Manual split for bracketed string
            sourceOfProof = trimmed.slice(1, -1).split(/[;,]/).map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean).join('\n');
          }
        } else if (trimmed.includes(';') || trimmed.includes(',')) {
          // Flatten messy semicolon/comma strings from LLM
          sourceOfProof = trimmed.split(/[;,]/).map(s => s.trim().replace(/['"]/g, '')).filter(Boolean).join('\n');
        } else {
          sourceOfProof = rawSource;
        }
      }

      return [
        c.company_name || 'Not specified',
        c.founder_linkedin || 'Not specified',
        c.email || 'Not specified',
        c.date_founded || 'Not specified',
        c.funding_total || 'Not specified',
        c.latest_funding || 'Not specified',
        sourceOfProof,
        c.marketing_community_manager_linkedin || 'Not specified',
        c.marketing_community_manager_email || 'Not specified'
      ];
    });

    // 4. Check if sheet is empty to decide on headers
    const checkRes = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: "Sheet1!A1:A1",
    });
    
    const hasData = checkRes.data.values && checkRes.data.values.length > 0;
    const finalRows = hasData ? values : [header, ...values];

    await sheets.spreadsheets.values.append({
      spreadsheetId: spreadsheetId,
      range: "Sheet1!A1",
      valueInputOption: "RAW",
      requestBody: { 
        values: finalRows 
      },
    });

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
  } catch (error) {
    console.error("Google Sheets Export Error:", error);
    throw error;
  }
}
