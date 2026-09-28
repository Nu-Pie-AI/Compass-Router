import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

interface ProductRow {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  categoryIds: string[];
  website?: string;
  logo?: string;
  pricingModel?: string;
  startingPrice?: number;
  hasFreeTrial?: boolean;
  companyName?: string;
  companySize?: string;
  founded?: string;
  headquarters?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || session.user.role !== 'vendor') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: session.user.id },
      select: { id: true, status: true },
    });

    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    }

    if (vendor.status !== 'approved') {
      return NextResponse.json(
        { error: 'Only approved vendors can import products' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { products } = body;

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { error: 'Products array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (products.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 products can be imported at once' },
        { status: 400 }
      );
    }

    // Validate all rows first
    const errors: ValidationError[] = [];
    const validProducts: ProductRow[] = [];

    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      const rowNumber = i + 2; // +2 because row 1 is header and array is 0-indexed

      // Required fields validation
      if (!row.name || row.name.trim().length === 0) {
        errors.push({ row: rowNumber, field: 'name', message: 'Name is required' });
      } else if (row.name.length > 200) {
        errors.push({ row: rowNumber, field: 'name', message: 'Name must be less than 200 characters' });
      }

      if (!row.slug || row.slug.trim().length === 0) {
        errors.push({ row: rowNumber, field: 'slug', message: 'Slug is required' });
      } else if (!/^[a-z0-9-]+$/.test(row.slug)) {
        errors.push({ row: rowNumber, field: 'slug', message: 'Slug must contain only lowercase letters, numbers, and hyphens' });
      }

      if (!row.shortDescription || row.shortDescription.trim().length === 0) {
        errors.push({ row: rowNumber, field: 'shortDescription', message: 'Short description is required' });
      } else if (row.shortDescription.length > 200) {
        errors.push({ row: rowNumber, field: 'shortDescription', message: 'Short description must be less than 200 characters' });
      }

      if (!row.description || row.description.trim().length === 0) {
        errors.push({ row: rowNumber, field: 'description', message: 'Description is required' });
      }

      if (!row.categoryIds || !Array.isArray(row.categoryIds) || row.categoryIds.length === 0) {
        errors.push({ row: rowNumber, field: 'categoryIds', message: 'At least one category is required' });
      }

      // Optional fields validation
      if (row.website && row.website.trim().length > 0) {
        try {
          new URL(row.website);
        } catch {
          errors.push({ row: rowNumber, field: 'website', message: 'Invalid URL format' });
        }
      }

      if (row.logo && row.logo.trim().length > 0) {
        try {
          new URL(row.logo);
        } catch {
          errors.push({ row: rowNumber, field: 'logo', message: 'Invalid URL format' });
        }
      }

      if (row.startingPrice !== undefined && row.startingPrice !== null) {
        const price = Number(row.startingPrice);
        if (isNaN(price) || price < 0) {
          errors.push({ row: rowNumber, field: 'startingPrice', message: 'Starting price must be a positive number' });
        }
      }

      if (row.founded && row.founded.trim().length > 0) {
        const year = parseInt(row.founded);
        if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
          errors.push({ row: rowNumber, field: 'founded', message: 'Invalid year' });
        }
      }

      // If row has no errors, add to valid products
      const rowErrors = errors.filter(e => e.row === rowNumber);
      if (rowErrors.length === 0) {
        validProducts.push(row);
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Validation failed for ${errors.length} error(s)`,
        errors,
        totalRows: products.length,
        validRows: validProducts.length,
        errorRows: errors.length,
      }, { status: 400 });
    }

    // Check for duplicate slugs in the database
    const slugs = validProducts.map(p => p.slug);
    const existingSlugs = await prisma.product.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true },
    });

    const existingSlugSet = new Set(existingSlugs.map(p => p.slug));
    for (let i = 0; i < validProducts.length; i++) {
      if (existingSlugSet.has(validProducts[i].slug)) {
        errors.push({
          row: i + 2,
          field: 'slug',
          message: `Product with slug '${validProducts[i].slug}' already exists`,
        });
      }
    }

    if (errors.length > 0) {
      return NextResponse.json({
        success: false,
        message: `${errors.length} product(s) have duplicate slugs`,
        errors,
        totalRows: products.length,
        validRows: validProducts.length - errors.length,
        errorRows: errors.length,
      }, { status: 400 });
    }

    // Import all valid products
    const createdProducts = [];
    const importErrors: Array<{ row: number; error: string }> = [];

    for (let i = 0; i < validProducts.length; i++) {
      const row = validProducts[i];
      const rowNumber = i + 2;

      try {
        const product = await prisma.product.create({
          data: {
            name: row.name,
            slug: row.slug,
            shortDescription: row.shortDescription,
            description: row.description,
            website: row.website || null,
            logo: row.logo || null,
            pricingModel: row.pricingModel || null,
            startingPrice: row.startingPrice || null,
            hasFreeTrial: row.hasFreeTrial || false,
            companyName: row.companyName || null,
            companySize: row.companySize || null,
            founded: row.founded || null,
            headquarters: row.headquarters || null,
            status: 'draft',
            approvalStatus: 'not_submitted',
            vendorId: vendor.id,
            categories: {
              connect: row.categoryIds.map(id => ({ id })),
            },
          },
          include: {
            categories: true,
          },
        });

        createdProducts.push({
          row: rowNumber,
          productId: product.id,
          name: product.name,
          slug: product.slug,
        });
      } catch (error: any) {
        console.error(`Error creating product at row ${rowNumber}:`, error);
        importErrors.push({
          row: rowNumber,
          error: error.message || 'Failed to create product',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${createdProducts.length} product(s)`,
      totalRows: products.length,
      successfulRows: createdProducts.length,
      failedRows: importErrors.length,
      createdProducts,
      errors: importErrors.length > 0 ? importErrors : undefined,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
