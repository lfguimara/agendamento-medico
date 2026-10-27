import { configurarBancoDeTeste } from './testDatabase';

// setupFiles: roda em cada arquivo de teste antes dos imports dele,
// garantindo que o PrismaClient de src/lib/prisma.ts aponte para o banco de teste.
configurarBancoDeTeste();
