import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { notifyAdmin, sendSignupConfirmation } from '@/lib/email';

const registerSchema = z.object({
  // Account
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  // Company
  companyName: z.string().min(2),
  website: z.string().url().optional().or(z.literal('')),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  // Contact
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validData = registerSchema.parse(body);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(validData.password, 10);

    // Create User and Vendor in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: validData.email,
          password: hashedPassword,
          name: validData.name,
          role: 'vendor',
        },
      });

      const vendor = await tx.vendor.create({
        data: {
          userId: user.id,
          companyName: validData.companyName,
          website: validData.website || null,
          industry: validData.industry || null,
          companySize: validData.companySize || null,
          contactEmail: validData.contactEmail,
          contactPhone: validData.contactPhone || null,
          address: validData.address || null,
          city: validData.city || null,
          country: validData.country || null,
          status: 'pending', // Requires admin approval
        },
      });

      return { userId: user.id, vendorId: vendor.id };
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    await Promise.all([
      sendSignupConfirmation(validData.email, validData.name),
      notifyAdmin(
        'New vendor signup pending approval',
        `${validData.companyName} (${validData.email}) submitted a vendor registration.`,
        `${baseUrl}/admin/vendors/pending`
      ),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Registration successful. Your account is pending approval.',
      ...result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
