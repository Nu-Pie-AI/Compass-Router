// ============================================
// API: Update Offering Categories
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { z } from 'zod';

const updateCategoriesSchema = z.object({
  categoryIds: z.array(z.string()).min(1, 'At least one category is required'),
});

/**
 * GET - Get categories for an offering
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const offering = await prisma.offering.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        categories: {
          select: {
            id: true,
            slug: true,
            name: true,
            description: true,
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
    }

    return NextResponse.json({
      offering: {
        id: offering.id,
        slug: offering.slug,
        title: offering.title,
      },
      categories: offering.categories,
    });
  } catch (error: any) {
    console.error('Get offering categories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update categories for an offering
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or partner owner
    const offering = await prisma.offering.findUnique({
      where: { slug },
      include: {
        partner: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
    }

    // Only allow partner owner or admin to update
    if (
      session.user.role !== 'admin' &&
      offering.partner.userId !== session.user.id
    ) {
      return NextResponse.json(
        { error: 'Forbidden - You can only update your own offerings' },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await req.json();
    const validatedData = updateCategoriesSchema.parse(body);

    // Verify all category IDs exist
    const categories = await prisma.category.findMany({
      where: {
        id: {
          in: validatedData.categoryIds,
        },
      },
    });

    if (categories.length !== validatedData.categoryIds.length) {
      return NextResponse.json(
        { error: 'One or more category IDs are invalid' },
        { status: 400 }
      );
    }

    // Update offering categories (replace all existing)
    const updatedOffering = await prisma.offering.update({
      where: { id: offering.id },
      data: {
        categories: {
          set: validatedData.categoryIds.map((id) => ({ id })),
        },
      },
      include: {
        categories: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      offering: {
        id: updatedOffering.id,
        slug: updatedOffering.slug,
        title: updatedOffering.title,
      },
      categories: updatedOffering.categories,
      message: 'Categories updated successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Update offering categories error:', error);
    return NextResponse.json(
      { error: 'Failed to update categories', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST - Add categories to an offering (without replacing existing)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or partner owner
    const offering = await prisma.offering.findUnique({
      where: { slug },
      include: {
        partner: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
    }

    // Only allow partner owner or admin to update
    if (
      session.user.role !== 'admin' &&
      offering.partner.userId !== session.user.id
    ) {
      return NextResponse.json(
        { error: 'Forbidden - You can only update your own offerings' },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await req.json();
    const validatedData = updateCategoriesSchema.parse(body);

    // Verify all category IDs exist
    const categories = await prisma.category.findMany({
      where: {
        id: {
          in: validatedData.categoryIds,
        },
      },
    });

    if (categories.length !== validatedData.categoryIds.length) {
      return NextResponse.json(
        { error: 'One or more category IDs are invalid' },
        { status: 400 }
      );
    }

    // Add categories to offering (keep existing)
    const updatedOffering = await prisma.offering.update({
      where: { id: offering.id },
      data: {
        categories: {
          connect: validatedData.categoryIds.map((id) => ({ id })),
        },
      },
      include: {
        categories: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      offering: {
        id: updatedOffering.id,
        slug: updatedOffering.slug,
        title: updatedOffering.title,
      },
      categories: updatedOffering.categories,
      message: 'Categories added successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Add offering categories error:', error);
    return NextResponse.json(
      { error: 'Failed to add categories', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Remove categories from an offering
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin or partner owner
    const offering = await prisma.offering.findUnique({
      where: { slug },
      include: {
        partner: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!offering) {
      return NextResponse.json({ error: 'Offering not found' }, { status: 404 });
    }

    // Only allow partner owner or admin to update
    if (
      session.user.role !== 'admin' &&
      offering.partner.userId !== session.user.id
    ) {
      return NextResponse.json(
        { error: 'Forbidden - You can only update your own offerings' },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await req.json();
    const validatedData = updateCategoriesSchema.parse(body);

    // Remove categories from offering
    const updatedOffering = await prisma.offering.update({
      where: { id: offering.id },
      data: {
        categories: {
          disconnect: validatedData.categoryIds.map((id) => ({ id })),
        },
      },
      include: {
        categories: {
          select: {
            id: true,
            slug: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      offering: {
        id: updatedOffering.id,
        slug: updatedOffering.slug,
        title: updatedOffering.title,
      },
      categories: updatedOffering.categories,
      message: 'Categories removed successfully',
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Remove offering categories error:', error);
    return NextResponse.json(
      { error: 'Failed to remove categories', message: error.message },
      { status: 500 }
    );
  }
}
