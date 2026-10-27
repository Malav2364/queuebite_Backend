import { PrismaClient } from '@prisma/client';
import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    prismaClient = new PrismaClient({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['warn', 'error'],
    });
  }
  return prismaClient;
}

const prismaPluginCallback: FastifyPluginAsync = async (fastify) => {
  const prisma = getPrismaClient();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (server) => {
    server.log.info('Disconnecting Prisma client...');
    await prisma.$disconnect();
  });
};

export const prismaPlugin = fp(prismaPluginCallback, {
  name: 'prisma',
});

export default prismaPlugin;
export const prisma = getPrismaClient();

