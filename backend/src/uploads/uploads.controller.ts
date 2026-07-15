import {
  Controller, Post, Delete, Get, Param, Query, Body,
  UseGuards, UseInterceptors, UploadedFile, ParseIntPipe,
  BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AzureStorageService } from '../azure-storage/azure-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AxcelerateService } from '../axcelerate/axcelerate.service';

// Portfolio type IDs — matching the WordPress plugin exactly
const PT = { IMAGE: 51766, SD: 51767, IF: 51768, CHECKLIST: null as null };

type UploadKind = 'image' | 'sd' | 'if' | 'checklist' | 'workshop';

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(
    private azure: AzureStorageService,
    private prisma: PrismaService,
    private axcelerate: AxcelerateService,
  ) {}

  // ── Upload a file ────────────────────────────────────────────────────────────

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('instanceId', ParseIntPipe) instanceId: number,
    @Body('kind') kind: UploadKind,
    @Body('contactId') contactIdStr?: string,
  ) {
    if (!file) throw new BadRequestException('No file provided');

    const enabled = await this.azure.isEnabled();
    if (!enabled) throw new BadRequestException('File storage is not enabled. Configure Azure Storage in Settings.');

    const contactId = contactIdStr ? parseInt(contactIdStr) : null;
    const portfolioTypeId = kind === 'image' ? PT.IMAGE
      : kind === 'sd' ? PT.SD
      : kind === 'if' ? PT.IF
      : null; // checklist or workshop = null

    const context = `instance_${instanceId}`;
    const subPath = contactId ? `contact_${contactId}/${kind}` : `workshop/${kind}`;

    const { blobPath, url } = await this.azure.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      context,
      subPath,
    );

    const proxyKey = `${instanceId}-${contactId ?? 'w'}-${kind}-${Date.now()}`;

    const row = await this.prisma.workshopUpload.create({
      data: {
        instanceId,
        contactId,
        portfolioTypeId,
        blobPath,
        blobUrl: url,
        kind,
        filename: file.originalname,
        mimeType: file.mimetype,
        status: 'active',
        proxyKey,
      },
    });

    // Port of PHP ajax_upload_checklist_pdf: sync URL to Axcelerate when uploading a checklist PDF
    if (kind === 'checklist' && contactId) {
      try {
        await this.axcelerate.putEnrolmentChecklistUrl(instanceId, contactId, url);
        await this.prisma.workshopUpload.update({
          where: { id: row.id },
          data: { status: 'synced' },
        });
      } catch (err: any) {
        this.logger.warn(`Checklist PDF uploaded to Azure but failed to sync to Axcelerate: ${err?.message}`);
        // Non-fatal — file is still saved, just mark sync_failed
        await this.prisma.workshopUpload.update({
          where: { id: row.id },
          data: { status: 'sync_failed' },
        });
      }
    }

    return { success: true, uploadId: row.id, url, proxyKey };
  }

  // ── Delete a file ────────────────────────────────────────────────────────────

  @Delete(':id')
  async deleteUpload(@Param('id', ParseIntPipe) id: number) {
    const row = await this.prisma.workshopUpload.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Upload not found');

    if (row.blobPath) {
      await this.azure.deleteBlob(row.blobPath);
    }

    await this.prisma.workshopUpload.update({
      where: { id },
      data: { status: 'deleted' },
    });

    return { success: true };
  }

  // ── Get uploads for an instance ───────────────────────────────────────────────

  @Get()
  async getUploads(
    @Query('instanceId', ParseIntPipe) instanceId: number,
    @Query('contactId') contactIdStr?: string,
  ) {
    const where: any = { instanceId, status: 'active' };
    if (contactIdStr) where.contactId = parseInt(contactIdStr);

    const rows = await this.prisma.workshopUpload.findMany({ where });
    return rows;
  }
}
