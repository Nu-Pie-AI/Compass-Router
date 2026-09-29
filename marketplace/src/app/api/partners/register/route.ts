// ============================================
// API: Partner Registration
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { notifyAdmin, sendSignupConfirmation } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : body.name;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email;
    const password = body.password;
    const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : body.companyName;

    // Validate required fields
    if (!name || !email || !password || !companyName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User with role='partner' and status='PENDING_APPROVAL'
    // Note: We'll update the User model to support a status field if it doesn't exist
    // For now, we'll use the existing structure
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'partner',
        // status: 'PENDING_APPROVAL', // Will be added to schema
      },
    });

    // Create Partner record with:
    // - onboardingStatus = NOT_STARTED
    // - approvalStatus = PENDING
    // - companyName from form
    const partner = await prisma.partner.create({
      data: {
        userId: user.id,
        companyName,
        onboardingStatus: 'NOT_STARTED',
        approvalStatus: 'PENDING',
        status: 'pending',
        regions: [],
        complianceFlags: [],
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const notifications = await Promise.allSettled([
      sendSignupConfirmation(user.email, user.name),
      notifyAdmin(
        'New partner signup pending approval',
        `${companyName} (${email}) created a partner account and is awaiting approval.`,
        `${baseUrl}/admin/partners/approve`
      ),
    ]);
    for (const notification of notifications) {
      if (notification.status === 'rejected') {
        console.error('Partner signup notification failed:', notification.reason);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Partner account created successfully. Awaiting admin approval.',
        userId: user.id,
        partnerId: partner.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Partner registration error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create partner account',
        message: error.message,
      },
      { status: 500 }
    );
  }
}
