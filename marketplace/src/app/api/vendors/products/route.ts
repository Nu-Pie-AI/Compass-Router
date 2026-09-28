import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// Schema for creating a product
const createProductSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
  shortDescription: z.string().min(1).max(200),
  description: z.string().min(1),
  categoryIds: z.array(z.string()).min(1),
  companyName: z.string().optional(),
  companySize: z.string().optional(),
  founded: z.number().int().min(1900).max(new Date().getFullYear()).optional().transform(val => val?.toString()),
  headquarters: z.string().optional(),
  website: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  pricingModel: z.string().optional(),
  startingPrice: z.number().optional(),
  hasFreeTrial: z.boolean().optional(),
  logo: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  videoUrl: z.string().url().optional().or(z.literal('').transform(() => undefined)),
  screenshots: z.array(z.string().url()).optional(),
  status: z.enum(['draft']).default('draft'), // Vendors can only create drafts
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'vendor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'all';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = { vendorId: vendor.id };
    if (status !== 'all') {
      where.status = status;
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          categories: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              reviews: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      data: products,
      meta: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Vendor products list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'vendor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    const body = await req.json();
    const validData = createProductSchema.parse(body);

    // Check if slug is unique
    const existingProduct = await prisma.product.findUnique({
      where: { slug: validData.slug },
    });

    if (existingProduct) {
      return NextResponse.json(
        { error: 'Product with this slug already exists' },
        { status: 400 }
      );
    }

    // Create product with categories
    // Note: approvalStatus defaults to 'not_submitted' via Prisma schema
    // Vendors must submit for approval before product can be published
    const { categoryIds, screenshots, ...productData } = validData;

    const product = await prisma.product.create({
      data: {
        ...productData,
        vendorId: vendor.id,
        status: 'draft', // Enforce draft status
        categories: {
          connect: categoryIds.map(id => ({ id })),
        },
        ...(screenshots && screenshots.length > 0
          ? {
              screenshots: {
                create: screenshots.map((url, index) => ({
                  url,
                  order: index,
                })),
              },
            }
          : {}),
      },
      include: {
        categories: true,
        screenshots: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Product created successfully',
      product,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Validation error:', error.issues);
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Product creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
