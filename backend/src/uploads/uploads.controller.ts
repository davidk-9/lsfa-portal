import {
  Controller, Post, Delete, Get, Param, Query, Body,
  UseGuards, UseInterceptors, UploadedFile, ParseIntPipe,
  BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomBytes } from 'crypto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AzureStorageService } from '../azure-storage/azure-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AxcelerateService } from '../axcelerate/axcelerate.service';
import { SettingsService } from '../settings/settings.service';

// Portfolio type IDs — matching the WordPress plugin exactly
const PT = { IMAGE: 51766, SD: 51767, IF: 51768, CHECKLIST: null as null };

type UploadKind = 'image' | 'sd' | 'if' | 'checklist' | 'workshop';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_USER', 'ADMIN', 'TRAINER')
@Controller('uploads')
export class UploadsController {
  private readonly logger = new Logger(UploadsController.name);

  constructor(
    private azure: AzureStorageService,
    private prisma: PrismaService,
    private axcelerate: AxcelerateService,
    private settings: SettingsService,
  ) {}

  // Build the stable, durable proxy URL that gets persisted (in Axcelerate and
  // in blobUrl) and later resolved by ProxyController to a fresh SAS link.
  private async buildProxyUrl(proxyKey: string): Promise<string> {
    const configured = await this.settings.get('public_base_url');
    const base = (configured?.trim() || process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/proxy/${encodeURIComponent(proxyKey)}`;
  }

  // Sync a student's SD / IF / additional-evidence proxy URL(s) into the matching
  // Axcelerate enrolment custom field(s). SD/IF hold a single URL. Additional evidence
  // spans two fields: the FIRST image URL goes in the plain single-URL field, and any
  // EXTRA images go in an HTML field as a <br>-separated list of <a> links. Recomputed
  // from the DB so it stays correct after uploads and deletes. Throws on API failure.
  private async syncEvidenceFieldToAxcelerate(instanceId: number, contactId: number, kind: string): Promise<void> {
    if (!contactId || contactId <= 0 || contactId >= 900000000) return;

    if (kind === 'image') {
      const rows = await this.prisma.workshopUpload.findMany({
        where: { instanceId, contactId, portfolioTypeId: PT.IMAGE, status: { not: 'deleted' } },
        orderBy: { id: 'asc' },
        select: { blobUrl: true },
      });

      const first = rows[0]?.blobUrl ?? '';
      const moreHtml = rows
        .slice(1)
        .map((r) => `<a href="${r.blobUrl}" target="_blank">${r.blobUrl}</a>`)
        .join('<br>');

      await this.axcelerate.putEnrolmentCustomField(instanceId, contactId, 'customField_u_additionalevidence', first);
      await this.axcelerate.putEnrolmentCustomField(instanceId, contactId, 'customField_u_moreadditionalevidence', moreHtml);
      return;
    }

    const field =
      kind === 'sd' ? 'customField_u_studentdeclaration'
      : kind === 'if' ? 'customField_u_incidentform'
      : '';
    if (!field) return;

    const portfolioTypeId = kind === 'sd' ? PT.SD : PT.IF;
    const row = await this.prisma.workshopUpload.findFirst({
      where: { instanceId, contactId, portfolioTypeId, status: { not: 'deleted' } },
      orderBy: { id: 'desc' },
      select: { blobUrl: true },
    });

    await this.axcelerate.putEnrolmentCustomField(instanceId, contactId, field, row?.blobUrl ?? '');
  }

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

    const { blobPath } = await this.azure.uploadFile(
      file.buffer,
      file.originalname,
      file.mimetype,
      context,
      subPath,
    );

    // Short, unguessable, URL-safe proxy key so the link stored in Axcelerate stays
    // compact, e.g. {base}/proxy/AbCd1234wxyz.
    const proxyKey = randomBytes(9).toString('base64url');
    // Durable, stable link. The underlying SAS is minted fresh on every access
    // by ProxyController, so this URL never rots.
    const proxyUrl = await this.buildProxyUrl(proxyKey);

    const row = await this.prisma.workshopUpload.create({
      data: {
        instanceId,
        contactId,
        portfolioTypeId,
        blobPath,
        blobUrl: proxyUrl,
        kind,
        filename: file.originalname,
        mimeType: file.mimetype,
        status: 'active',
        proxyKey,
      },
    });

    // Port of PHP ajax_upload_checklist_pdf: sync URL to Axcelerate when uploading a checklist PDF.
    // We push the durable proxy URL so the link stored in Axcelerate never breaks.
    if (kind === 'checklist' && contactId && contactId > 0 && contactId < 900000000) {
      try {
        await this.axcelerate.putEnrolmentChecklistUrl(instanceId, contactId, proxyUrl);
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
    } else if ((kind === 'sd' || kind === 'if' || kind === 'image') && contactId && contactId > 0 && contactId < 900000000) {
      // Sync SD / IF / additional-evidence proxy URL(s) to the matching custom field.
      try {
        await this.syncEvidenceFieldToAxcelerate(instanceId, contactId, kind);
        await this.prisma.workshopUpload.update({
          where: { id: row.id },
          data: { status: 'synced' },
        });
      } catch (err: any) {
        this.logger.warn(`Evidence uploaded to Azure but failed to sync to Axcelerate: ${err?.message}`);
        await this.prisma.workshopUpload.update({
          where: { id: row.id },
          data: { status: 'sync_failed' },
        });
      }
    }

    return { success: true, uploadId: row.id, url: proxyUrl, proxyKey };
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

    // Re-sync the matching Axcelerate custom field now that this file is gone.
    // Checklist clears its field; SD/IF/+ are recomputed from the remaining active files
    // (the deleted row is already excluded). Port of the plugin's delete behaviour.
    if (row.contactId && row.contactId > 0 && row.contactId < 900000000) {
      try {
        if (row.kind === 'checklist' || row.portfolioTypeId === null) {
          await this.axcelerate.putEnrolmentChecklistUrl(row.instanceId, row.contactId, '');
        } else if (row.kind === 'sd' || row.kind === 'if' || row.kind === 'image') {
          await this.syncEvidenceFieldToAxcelerate(row.instanceId, row.contactId, row.kind);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to update Axcelerate custom field on delete: ${err?.message}`);
      }
    }

    return { success: true };
  }

  // ── Get uploads for an instance ───────────────────────────────────────────────

  @Get()
  async getUploads(
    @Query('instanceId', ParseIntPipe) instanceId: number,
    @Query('contactId') contactIdStr?: string,
  ) {
    const where: any = { instanceId, status: { not: 'deleted' } };
    if (contactIdStr) where.contactId = parseInt(contactIdStr);

    const rows = await this.prisma.workshopUpload.findMany({ where });
    return rows;
  }
}
