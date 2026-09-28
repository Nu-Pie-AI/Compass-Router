// ============================================
// API: Upload and Parse CSV/XLSX for Bulk Import
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { parseImportFile } from '@/lib/ai/csv-normalizer';
import prisma from '@/lib/prisma';
import { isApprovedPartner, partnerApprovalError } from '@/lib/partner-access';

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (session.user.role !== 'vendor' && session.user.role !== 'partner') {
      return NextResponse.json(
        { error: 'Forbidden - Only vendors/partners can bulk import' },
        { status: 403 }
      );
    }

    if (session.user.role === 'partner') {
      const partner = await prisma.partner.findUnique({
        where: { userId: session.user.id },
        select: { approvalStatus: true, status: true },
      });

      if (!isApprovedPartner(partner)) {
        return NextResponse.json({ error: partnerApprovalError() }, { status: 403 });
      }
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_IMPORT_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'Legacy XLS files are not supported. Please upload CSV or XLSX.' },
        { status: 400 }
      );
    }

    if (!lowerName.endsWith('.csv') && !lowerName.endsWith('.xlsx')) {
      return NextResponse.json(
        { error: 'File must be a CSV or XLSX file' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const parseResult = parseImportFile(file.name, Buffer.from(arrayBuffer));

    if (parseResult.validRows === 0) {
      return NextResponse.json(
        {
          error: 'File has no valid data rows',
          details: parseResult.errors,
          warnings: parseResult.warnings,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      fileType: parseResult.fileType,
      totalRows: parseResult.totalRows,
      validRows: parseResult.validRows,
      normalizedData: parseResult.normalizedData,
      errors: parseResult.errors,
      warnings: parseResult.warnings,
      message: `Parsed ${parseResult.validRows} valid offering(s) from ${parseResult.fileType.toUpperCase()}`,
    });
  } catch (error: unknown) {
    console.error('Bulk import upload error:', error);
    return NextResponse.json(
      {
        error: 'Failed to parse import file',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
