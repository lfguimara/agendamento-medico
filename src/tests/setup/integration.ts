import { prisma } from '../../lib/prisma';
import { limparBanco } from '../helpers/db';

// Cada teste começa com o banco vazio, para não depender da ordem de execução
beforeEach(async () => {
  await limparBanco();
});

afterAll(async () => {
  await prisma.$disconnect();
});
