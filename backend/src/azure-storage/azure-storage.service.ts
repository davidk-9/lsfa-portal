import { Injectable, Logger } from '@nestjs/common';
import {
  BlobServiceClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
  SASProtocol,
} from '@azure/storage-blob';
import { ClientSecretCredential } from '@azure/identity';
import { SettingsService } from '../settings/settings.service';

interface AzureConfig {
  storageAccount: string;
  container: string;
  pathPrefix: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  linkMode: 'sas' | 'public';
  sasToken: string;
}

@Injectable()
export class AzureStorageService {
  private readonly logger = new Logger(AzureStorageService.name);

  constructor(private settings: SettingsService) {}

  async isEnabled(): Promise<boolean> {
    const mode = await this.settings.get('azure_storage_mode');
    return mode === 'azure';
  }

  private async getConfig(): Promise<AzureConfig> {
    const [account, container, prefix, tenantId, clientId, clientSecret, linkMode, sasToken] =
      await Promise.all([
        this.settings.get('azure_storage_account'),
        this.settings.get('azure_storage_container'),
        this.settings.get('azure_path_prefix'),
        this.settings.get('azure_tenant_id'),
        this.settings.get('azure_client_id'),
        this.settings.get('azure_client_secret'),
        this.settings.get('azure_link_mode'),
        this.settings.get('azure_sas_token'),
      ]);

    if (!account || !container || !tenantId || !clientId || !clientSecret) {
      throw new Error('Azure storage settings are incomplete. Please configure them in Settings → Azure Storage.');
    }

    return {
      storageAccount: account,
      container,
      pathPrefix: (prefix ?? 'lsfa').replace(/^\/|\/$/g, ''),
      tenantId,
      clientId,
      clientSecret,
      linkMode: (linkMode ?? 'sas') as 'sas' | 'public',
      sasToken: sasToken ?? '',
    };
  }

  private async getBlobServiceClient(config: AzureConfig): Promise<BlobServiceClient> {
    const credential = new ClientSecretCredential(
      config.tenantId,
      config.clientId,
      config.clientSecret,
    );
    const url = `https://${config.storageAccount}.blob.core.windows.net`;
    return new BlobServiceClient(url, credential);
  }

  // Port of PHP DKTP_Storage::upload_file
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    context: string,
    subPath: string,
  ): Promise<{ blobPath: string; url: string }> {
    const config = await this.getConfig();
    const client = await this.getBlobServiceClient(config);
    const containerClient = client.getContainerClient(config.container);

    const ext = originalName.split('.').pop() ?? '';
    const timestamp = Date.now();
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobPath = `${config.pathPrefix}/${context}/${subPath}/${timestamp}_${safeName}`;

    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
    await blockBlobClient.uploadData(fileBuffer, {
      blobHTTPHeaders: { blobContentType: mimeType },
    });

    const url = this.buildUrl(config, blobPath);
    return { blobPath, url };
  }

  // Port of PHP DKTP_Storage::delete_blob
  async deleteBlob(blobPath: string): Promise<void> {
    const config = await this.getConfig();
    const client = await this.getBlobServiceClient(config);
    const containerClient = client.getContainerClient(config.container);
    await containerClient.deleteBlob(blobPath).catch((err) => {
      this.logger.warn(`Failed to delete blob ${blobPath}: ${err?.message}`);
    });
  }

  // Port of PHP DKTP_Storage::get_file_url
  buildUrl(config: AzureConfig, blobPath: string): string {
    const base = `https://${config.storageAccount}.blob.core.windows.net/${config.container}/${blobPath}`;
    if (config.linkMode === 'sas' && config.sasToken) {
      const sep = config.sasToken.startsWith('?') ? '' : '?';
      return `${base}${sep}${config.sasToken}`;
    }
    return base;
  }

  async getUrl(blobPath: string): Promise<string> {
    const config = await this.getConfig();
    return this.buildUrl(config, blobPath);
  }

  // Mint a fresh, short-lived read-only SAS URL for a single blob on demand.
  // This is what keeps stored links durable: the proxy endpoint regenerates a
  // link on every access, so the stable proxy URL persisted in Axcelerate never
  // rots even though the underlying SAS expires quickly.
  async generateReadUrl(blobPath: string, ttlMinutes = 15): Promise<string> {
    const config = await this.getConfig();
    const base = `https://${config.storageAccount}.blob.core.windows.net/${config.container}/${blobPath}`;

    try {
      const client = await this.getBlobServiceClient(config);
      const now = Date.now();
      const startsOn = new Date(now - 5 * 60 * 1000); // 5 min clock-skew allowance
      const expiresOn = new Date(now + ttlMinutes * 60 * 1000);

      // Requires the service principal to hold the "Storage Blob Delegator" role.
      const userDelegationKey = await client.getUserDelegationKey(startsOn, expiresOn);
      const sas = generateBlobSASQueryParameters(
        {
          containerName: config.container,
          blobName: blobPath,
          permissions: BlobSASPermissions.parse('r'),
          startsOn,
          expiresOn,
          protocol: SASProtocol.Https,
        },
        userDelegationKey,
        config.storageAccount,
      ).toString();

      return `${base}?${sas}`;
    } catch (err: any) {
      // Fall back to the configured static link so files stay reachable even if
      // delegation SAS isn't available (e.g. role not yet granted, or public container).
      this.logger.warn(
        `User-delegation SAS unavailable for ${blobPath}, falling back to static link: ${err?.message}`,
      );
      return this.buildUrl(config, blobPath);
    }
  }
}
