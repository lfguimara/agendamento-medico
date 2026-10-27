import type { PrismaClient } from '../../generated/prisma/client';

// Cria um "PrismaClient falso" só com os métodos que os services usam.
// Cada método é um jest.fn(), então nos testes dá para definir o retorno
// (mockResolvedValue) e verificar com quais argumentos foi chamado.
function criarModeloMock() {
  return {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

export function criarPrismaMock() {
  const mock = {
    paciente: criarModeloMock(),
    medico: criarModeloMock(),
    consulta: criarModeloMock(),
  };

  // `mock` é usado nas asserções; `db` é o mesmo objeto com o tipo esperado pelos services
  return { mock, db: mock as unknown as PrismaClient };
}

export type PrismaMock = ReturnType<typeof criarPrismaMock>['mock'];
