import type { PrismaClient } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import type { AtualizarPacienteDTO, CriarPacienteDTO } from './paciente.schema';

// O PrismaClient é recebido no construtor para que os testes possam passar um mock
export class PacienteService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listar() {
    return this.db.paciente.findMany({ orderBy: { nome: 'asc' } });
  }

  async buscarPorId(id: string) {
    const paciente = await this.db.paciente.findUnique({ where: { id } });
    if (!paciente) throw new NotFoundError('Paciente');
    return paciente;
  }

  criar(dados: CriarPacienteDTO) {
    return this.db.paciente.create({ data: dados });
  }

  async atualizar(id: string, dados: AtualizarPacienteDTO) {
    await this.buscarPorId(id);
    return this.db.paciente.update({ where: { id }, data: dados });
  }

  async remover(id: string) {
    await this.buscarPorId(id);
    await this.db.paciente.delete({ where: { id } });
  }
}
