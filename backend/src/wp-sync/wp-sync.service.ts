import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

// One-time, READ-ONLY import from the legacy WordPress plugin.
// It pulls data OUT of WordPress so the new system can be tested with real-shaped
// data, and is run once at cut-over. It must NEVER write back to WordPress, and a
// full re-run intentionally overwrites local rows (WordPress is the only source).
@Injectable()
export class WpSyncService {
  private readonly logger = new Logger(WpSyncService.name);

  constructor(
    private prisma: PrismaService,
    private settings: SettingsService,
  ) {}

  // Durable proxy base URL (same source of truth as the uploads controller).
  private async publicBaseUrl(): Promise<string> {
    const configured = await this.settings.get('public_base_url');
    return (configured?.trim() || process.env.PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');
  }

  // Remove WordPress authorship from imported checklist JSON. last_modified_by holds
  // a WordPress user id that is meaningless in this system; going forward it is set by us.
  private stripWpAuthorship(rawData: any): string {
    try {
      const obj = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      if (obj && typeof obj === 'object') {
        if ('last_modified_by' in obj) obj.last_modified_by = null;
        if ('created_by' in obj) obj.created_by = null;
        return JSON.stringify(obj);
      }
    } catch {
      /* not JSON — store as-is */
    }
    return typeof rawData === 'string' ? rawData : JSON.stringify(rawData ?? {});
  }

  async runSync(): Promise<{ success: boolean; summary: Record<string, number>; errors: string[] }> {
    const wpUrl = await this.settings.get('wp_sync_url');
    const wpToken = await this.settings.get('wp_sync_token');

    if (!wpUrl || !wpToken) {
      throw new Error('WordPress sync is not configured. Set the site URL and token in Settings → WordPress Sync.');
    }

    const base = wpUrl.replace(/\/$/, '') + '/wp-json/lsfa/v1/sync';
    this.logger.log(`Starting WordPress sync from: ${wpUrl}`);

    const summary: Record<string, number> = {};
    const errors: string[] = [];

    const tables: Array<{ key: string; handler: (rows: any[], errors: string[]) => Promise<number> }> = [
      { key: 'workshop_progress',  handler: (r, e) => this.syncWorkshopProgress(r, e) },
      { key: 'student_checklists', handler: (r, e) => this.syncStudentChecklists(r, e) },
      { key: 'workshop_snapshots', handler: (r, e) => this.syncWorkshopSnapshots(r, e) },
      { key: 'uploads',            handler: (r, e) => this.syncUploads(r, e) },
    ];

    for (const { key, handler } of tables) {
      let offset = 0;
      const limit = 200;
      let total = 1; // will be updated after first call
      let imported = 0;

      this.logger.log(`Syncing table: ${key}`);

      while (offset < total) {
        const url = `${base}?token=${encodeURIComponent(wpToken)}&table=${key}&offset=${offset}&limit=${limit}`;
        try {
          const response = await axios.get(url, { timeout: 30000 });
          const data = response.data;
          total = parseInt(data.total ?? '0') || 0;
          const rows: any[] = data.rows ?? [];
          imported += await handler(rows, errors);
          offset += limit;
          this.logger.log(`  ${key}: offset ${offset}/${total}`);
        } catch (err: any) {
          errors.push(`${key} fetch failed at offset ${offset}: ${err?.message}`);
          break; // stop paginating this table on error
        }
      }

      summary[key] = imported;
    }

    this.logger.log(`Sync complete: ${JSON.stringify(summary)}`);
    return { success: true, summary, errors };
  }

  async runSyncStream(emit: (event: any) => void): Promise<void> {
    const wpUrl = await this.settings.get('wp_sync_url');
    const wpToken = await this.settings.get('wp_sync_token');

    if (!wpUrl || !wpToken) {
      emit({ type: 'error', message: 'WordPress sync is not configured. Set the site URL and token in Settings → WordPress Sync.' });
      return;
    }

    const base = wpUrl.replace(/\/$/, '') + '/wp-json/lsfa/v1/sync';
    this.logger.log(`Starting WordPress sync (stream) from: ${wpUrl}`);

    const summary: Record<string, number> = {};
    const errors: string[] = [];

    const tables: Array<{ key: string; handler: (rows: any[], errors: string[]) => Promise<number> }> = [
      { key: 'workshop_progress',  handler: (r, e) => this.syncWorkshopProgress(r, e) },
      { key: 'student_checklists', handler: (r, e) => this.syncStudentChecklists(r, e) },
      { key: 'workshop_snapshots', handler: (r, e) => this.syncWorkshopSnapshots(r, e) },
      { key: 'uploads',            handler: (r, e) => this.syncUploads(r, e) },
    ];

    for (const { key, handler } of tables) {
      let offset = 0;
      const limit = 200;
      let total = 1;
      let imported = 0;

      while (offset < total) {
        const url = `${base}?token=${encodeURIComponent(wpToken)}&table=${key}&offset=${offset}&limit=${limit}`;
        try {
          const response = await axios.get(url, { timeout: 30000 });
          const data = response.data;
          total = parseInt(data.total ?? '0') || 0;
          const rows: any[] = data.rows ?? [];

          if (offset === 0) {
            emit({ type: 'table_start', table: key, total });
          }

          imported += await handler(rows, errors);
          offset += limit;

          emit({ type: 'progress', table: key, offset: Math.min(offset, total), total, imported });
          this.logger.log(`  ${key}: offset ${offset}/${total}`);
        } catch (err: any) {
          const msg = `${key} fetch failed at offset ${offset}: ${err?.message}`;
          errors.push(msg);
          emit({ type: 'table_error', table: key, message: msg });
          break;
        }
      }

      summary[key] = imported;
    }

    emit({ type: 'done', summary, errors });
    this.logger.log(`Sync stream complete: ${JSON.stringify(summary)}`);
  }

  // ── Port of dktp_workshop_progress → WorkshopProgress ─────────────────────

  private async syncWorkshopProgress(rows: any[], errors: string[]): Promise<number> {
    let count = 0;
    for (const row of rows) {
      try {
        const instanceId = parseInt(row.instance_id ?? '0');
        if (!instanceId) continue;

        await this.prisma.workshopProgress.upsert({
          where: { instanceId },
          update: {
            trainerContactId: String(row.trainer_contact_id ?? ''),
            completedSteps: parseInt(row.completed_steps ?? '0') || 0,
            totalSteps: parseInt(row.total_steps ?? '3') || 3,
            isComplete: row.is_complete === '1' || row.is_complete === 1,
            statusPayload: row.status_payload ?? null,
          },
          create: {
            instanceId,
            trainerContactId: String(row.trainer_contact_id ?? ''),
            completedSteps: parseInt(row.completed_steps ?? '0') || 0,
            totalSteps: parseInt(row.total_steps ?? '3') || 3,
            isComplete: row.is_complete === '1' || row.is_complete === 1,
            statusPayload: row.status_payload ?? null,
          },
        });
        count++;
      } catch (err: any) {
        errors.push(`workshop_progress row ${row.instance_id}: ${err?.message}`);
      }
    }
    return count;
  }

  // ── Port of dktp_student_checklists → StudentChecklist ────────────────────

  private async syncStudentChecklists(rows: any[], errors: string[]): Promise<number> {
    let count = 0;
    for (const row of rows) {
      try {
        const instanceId = parseInt(row.instance_id ?? '0');
        const contactId = parseInt(row.contact_id ?? '0');
        if (!instanceId || !contactId) continue;

        // Strip WordPress authorship (last_modified_by = WP user id, meaningless here).
        const data = this.stripWpAuthorship(row.checklist_data ?? row.data ?? '{}');

        await this.prisma.studentChecklist.upsert({
          where: { instanceId_contactId: { instanceId, contactId } },
          update: {
            courseCode: row.course_code ?? '',
            data,
          },
          create: {
            instanceId,
            contactId,
            courseCode: row.course_code ?? '',
            data,
          },
        });
        count++;
      } catch (err: any) {
        errors.push(`student_checklists row ${row.instance_id}/${row.contact_id}: ${err?.message}`);
      }
    }
    return count;
  }

  // ── Port of dktp_workshop_snapshots → WorkshopSnapshot ────────────────────

  private async syncWorkshopSnapshots(rows: any[], errors: string[]): Promise<number> {
    let count = 0;
    for (const row of rows) {
      try {
        const instanceId = parseInt(row.instance_id ?? '0');
        const courseCode = row.course_code ?? '';
        if (!instanceId || !courseCode) continue;

        // WordPress column is snapshot_json (not snapshot_data)
        const snapshotData = row.snapshot_json ?? row.snapshot_data ?? row.snapshotData ?? '{}';

        await this.prisma.workshopSnapshot.upsert({
          where: { instanceId_courseCode: { instanceId, courseCode } },
          update: {
            snapshotData,
            masterFingerprint: row.master_fingerprint ?? null,
          },
          create: {
            instanceId,
            courseCode,
            snapshotData,
            masterFingerprint: row.master_fingerprint ?? null,
          },
        });
        count++;
      } catch (err: any) {
        errors.push(`workshop_snapshots row ${row.instance_id}: ${err?.message}`);
      }
    }
    return count;
  }

  // ── Port of dktp_uploads → WorkshopUpload ─────────────────────────────────
  // Only syncs rows with a blob_path (Azure-stored files)

  private async syncUploads(rows: any[], errors: string[]): Promise<number> {
    let count = 0;
    const base = await this.publicBaseUrl();
    for (const row of rows) {
      try {
        const instanceId = parseInt(row.instance_id ?? '0');
        if (!instanceId) continue;

        // All metadata is inside the notes JSON field
        let blobPath = '';
        let blobUrl = '';
        let kindFromNotes = '';
        let wpProxyKey = '';
        if (row.notes) {
          try {
            const notes = typeof row.notes === 'string' ? JSON.parse(row.notes) : row.notes;
            blobPath = notes.blob_path ?? notes.blobPath ?? '';
            blobUrl = notes.external_url ?? notes.externalUrl ?? '';   // full Azure URL with SAS token
            kindFromNotes = notes.kind ?? '';
            wpProxyKey = notes.proxy_key ?? notes.proxyKey ?? '';
          } catch { /* notes not JSON */ }
        }

        // Determine kind: prefer notes.kind, fall back to portfolio_type_id
        const portfolioTypeId = row.portfolio_type_id ? parseInt(row.portfolio_type_id) : null;
        let kind: string;
        if (kindFromNotes === 'checklist_upload') {
          kind = 'checklist';
        } else if (kindFromNotes === 'workshop_upload') {
          kind = 'workshop';
        } else if (portfolioTypeId === 51766) {
          kind = 'image';
        } else if (portfolioTypeId === 51767) {
          kind = 'sd';
        } else if (portfolioTypeId === 51768) {
          kind = 'if';
        } else {
          kind = 'checklist';
        }

        const contactId = row.contact_id ? parseInt(row.contact_id) : null;
        const proxyKey = `wp-${row.id}`;

        // Map WordPress upload status onto ours (one-time import; files always live in Azure now):
        //   has an Axcelerate id OR wp status 'synced' → 'synced'; otherwise 'active'.
        //   wp 'error'/'pending' → 'active', since the blob still exists in Azure.
        const hasAxId = !!(row.ax_portfolio_id || row.ax_file_id);
        const status = hasAxId || row.status === 'synced' ? 'synced' : 'active';

        // Prefer a durable proxy URL when we have a blob path; the proxy mints a fresh
        // SAS on access so imported links don't rot either. Fall back to the stored
        // URL only when there is no blob path to proxy.
        const durableUrl = blobPath ? `${base}/proxy/${proxyKey}` : blobUrl;

        const existing = await this.prisma.workshopUpload.findUnique({ where: { proxyKey } });
        if (existing) {
          count++;
          continue;
        }

        await this.prisma.workshopUpload.create({
          data: {
            instanceId,
            contactId,
            portfolioTypeId,
            blobPath,
            blobUrl: durableUrl,
            kind,
            filename: row.filename ?? '',
            mimeType: row.mime ?? '',
            status,
            proxyKey,
            wpProxyKey: wpProxyKey || null,
            axceleratePortfolioId: row.ax_portfolio_id ? parseInt(row.ax_portfolio_id) : null,
          },
        });
        count++;
      } catch (err: any) {
        errors.push(`uploads row ${row.id}: ${err?.message}`);
      }
    }
    return count;
  }
}
