import { Client } from '@elastic/elasticsearch';
import { env } from '../config/env';
import { prisma } from '../config/db';

let esClient: Client | null = null;
let esAvailable = false;

export function getElasticsearchClient(): Client {
  if (!esClient) {
    esClient = new Client({
      node: env.ELASTICSEARCH_NODE,
      maxRetries: 2,
      requestTimeout: 3000,
    });
  }
  return esClient;
}

export async function initElasticsearch(): Promise<void> {
  const client = getElasticsearchClient();
  try {
    const health = await client.cluster.health();
    console.log(`[Elasticsearch] Connected! Cluster status: ${health.status}`);
    esAvailable = true;

    const indexExists = await client.indices.exists({ index: env.ELASTICSEARCH_INDEX });
    if (!indexExists) {
      console.log(`[Elasticsearch] Creating index "${env.ELASTICSEARCH_INDEX}" with mappings...`);
      await client.indices.create({
        index: env.ELASTICSEARCH_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              recipientEmail: {
                type: 'text',
                fields: { keyword: { type: 'keyword' } },
              },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              etherealPreviewUrl: { type: 'keyword' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Index "${env.ELASTICSEARCH_INDEX}" created successfully.`);
    }
  } catch (err: any) {
    esAvailable = false;
    console.warn(`[Elasticsearch] Offline or not reachable (${err.message}). Database fallback will be active.`);
  }
}

export interface EmailDocument {
  id: string;
  userId?: string | null;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  etherealPreviewUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export async function indexEmail(email: EmailDocument): Promise<void> {
  if (!esAvailable) return;
  try {
    const client = getElasticsearchClient();
    await client.index({
      index: env.ELASTICSEARCH_INDEX,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        senderEmail: email.senderEmail,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt || null,
        etherealPreviewUrl: email.etherealPreviewUrl || null,
        createdAt: email.createdAt,
        updatedAt: email.updatedAt,
      },
    });
  } catch (err: any) {
    console.error(`[Elasticsearch] Error indexing email ${email.id}:`, err.message);
  }
}

export async function updateEmailIndex(
  id: string,
  partial: Partial<EmailDocument>
): Promise<void> {
  if (!esAvailable) return;
  try {
    const client = getElasticsearchClient();
    await client.update({
      index: env.ELASTICSEARCH_INDEX,
      id,
      doc: partial,
    });
  } catch (err: any) {
    console.error(`[Elasticsearch] Error updating email index ${id}:`, err.message);
  }
}

export interface SearchOptions {
  query?: string;
  status?: string;
  senderEmail?: string;
  page?: number;
  limit?: number;
}

export async function searchEmails(options: SearchOptions) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(100, options.limit || 20));
  const from = (page - 1) * limit;

  // Try Elasticsearch first if available
  if (esAvailable) {
    try {
      const client = getElasticsearchClient();
      const mustClauses: any[] = [];
      const filterClauses: any[] = [];

      if (options.query && options.query.trim()) {
        mustClauses.push({
          multi_match: {
            query: options.query.trim(),
            fields: ['recipientEmail^3', 'subject^2', 'body', 'senderEmail'],
            fuzziness: 'AUTO',
          },
        });
      } else {
        mustClauses.push({ match_all: {} });
      }

      if (options.status) {
        filterClauses.push({ term: { status: options.status } });
      }

      if (options.senderEmail) {
        filterClauses.push({ term: { senderEmail: options.senderEmail } });
      }

      const response = await client.search({
        index: env.ELASTICSEARCH_INDEX,
        from,
        size: limit,
        body: {
          query: {
            bool: {
              must: mustClauses,
              filter: filterClauses,
            },
          },
          sort: [{ scheduledAt: { order: 'desc' } }],
        },
      });

      const totalHits =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total?.value || 0;

      const emails = response.hits.hits.map((hit) => hit._source);

      return {
        source: 'elasticsearch',
        total: totalHits,
        page,
        limit,
        totalPages: Math.ceil(totalHits / limit),
        emails,
      };
    } catch (err: any) {
      console.warn(`[Elasticsearch] Search query failed (${err.message}), falling back to database.`);
    }
  }

  // Graceful fallback to MySQL database
  const where: any = {};
  if (options.status) {
    where.status = options.status;
  }
  if (options.senderEmail) {
    where.senderEmail = options.senderEmail;
  }
  if (options.query && options.query.trim()) {
    const q = options.query.trim();
    where.OR = [
      { recipientEmail: { contains: q } },
      { subject: { contains: q } },
      { body: { contains: q } },
      { senderEmail: { contains: q } },
    ];
  }

  const [total, emails] = await Promise.all([
    prisma.emailJob.count({ where }),
    prisma.emailJob.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      skip: from,
      take: limit,
    }),
  ]);

  return {
    source: 'database_fallback',
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    emails,
  };
}
