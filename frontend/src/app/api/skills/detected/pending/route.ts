import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Disable caching for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Add timestamp to prevent any caching
    const timestamp = Date.now();
    const response = await fetch(`${BACKEND_URL}/api/skills/detected/pending?_t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    const data = await response.json();
    
    console.log(`[${new Date().toISOString()}] Fetched ${data.total} pending skills from backend`);
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Return with no-cache headers
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error fetching pending skills:', error);
    return NextResponse.json(
      { total: 0, byAgent: {}, byMethod: {} },
      { status: 200 }
    );
  }
}