import { NextRequest, NextResponse } from 'next/server';
import { exportToSheets } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const companies = body?.companies;

    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No company data provided' },
        { status: 400 }
      );
    }

    // Call our backend utility function
    const sheetUrl = await exportToSheets(companies);

    return NextResponse.json({
      success: true,
      url: sheetUrl
    });
  } catch (error: any) {
    console.error('API Export Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to export to Google Sheets' 
      },
      { status: 500 }
    );
  }
}
