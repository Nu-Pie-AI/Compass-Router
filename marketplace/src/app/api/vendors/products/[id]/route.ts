import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// Schema for updating a product
// Note: Vendors cannot change status to 'published' - must go through approval workflow
const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(200).optional(),
  shortDescription: z.string().min(1).max(200).optional(),
  description: z.string().min(1).optional(),
  categoryIds: z.array(z.string()).optional(),
  companyName: z.string().optional(),
  companySize: z.string().optional(),
  founded: z.number().int().min(1900).max(new Date().getFullYear()).optional().transform(val => val?.toString()),
  headquarters: z.string().optional(),
  website: z.string().url().optional(),
  pricingModel: z.string().optional(),
  startingPrice: z.number().optional(),
  hasFreeTrial: z.boolean().optional(),
  logo: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  screenshots: z.array(z.string().url()).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if product exists and belongs to vendor
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: {
        vendorId: true,
        approvalStatus: true,
      },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (existingProduct.vendorId !== vendor.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Vendors can only edit products that are not submitted or need revision
    if (existingProduct.approvalStatus === 'pending_approval') {
      return NextResponse.json(
        { error: 'Cannot edit product while it is pending approval' },
        { status: 403 }
      );
    }

    if (existingProduct.approvalStatus === 'approved') {
      return NextResponse.json(
        { error: 'Cannot edit approved products. Please contact support if you need to make changes.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validData = updateProductSchema.parse(body);

    // If slug is being updated, check uniqueness
    if (validData.slug) {
      const slugExists = await prisma.product.findFirst({
        where: {
          slug: validData.slug,
          id: { not: id },
        },
      });

      if (slugExists) {
        return NextResponse.json(
          { error: 'Product with this slug already exists' },
          { status: 400 }
        );
      }
    }

    // Update product
    const { categoryIds, screenshots, ...productData } = validData;

    const updateData: any = { ...productData };

    if (categoryIds) {
      updateData.categories = {
        set: [],
        connect: categoryIds.map(categoryId => ({ id: categoryId })),
      };
    }

    if (screenshots) {
      // Delete existing screenshots and create new ones
      await prisma.screenshot.deleteMany({
        where: { productId: id },
      });
      updateData.screenshots = {
        create: screenshots.map((url, index) => ({
          url,
          order: index,
        })),
      };
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        categories: true,
        screenshots: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Product updated successfully',
      product,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Product update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Check if product exists and belongs to vendor
    const existingProduct = await prisma.product.findUnique({
      where: { id },
      select: { vendorId: true },
    });

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (existingProduct.vendorId !== vendor.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Soft delete by updating status to 'archived'
    await prisma.product.update({
      where: { id },
      data: { status: 'archived' },
    });

    return NextResponse.json({
      success: true,
      message: 'Product archived successfully',
    });
  } catch (error) {
    console.error('Product deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
