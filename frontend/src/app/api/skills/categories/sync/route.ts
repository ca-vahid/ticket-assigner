import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function POST() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/skills/categories/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error syncing categories:', error);
    return NextResponse.json(
      { error: 'Failed to sync categories' },
      { status: 500 }
    );
  }
}