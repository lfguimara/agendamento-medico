import type { PrismaClient } from '../../generated/prisma/client';
import { prisma } from '../../lib/prisma';
import { NotFoundError } from '../../shared/errors/AppError';
import type { AtualizarMedicoDTO, CriarMedicoDTO, ListarMedicosFiltros } from './medico.schema';

export class MedicoService {
  constructor(private readonly db: PrismaClient = prisma) {}

  listar({ especialidade }: ListarMedicosFiltros = {}) {
    return this.db.medico.findMany({
      where: especialidade
        ? { especialidade: { contains: especialidade, mode: 'insensitive' } }
        : undefined,
      orderBy: { nome: 'asc' },
    });
  }

  async buscarPorId(id: string) {
    const medico = await this.db.medico.findUnique({ where: { id } });
    if (!medico) throw new NotFoundError('Médico');
    return medico;
  }

  criar(dados: CriarMedicoDTO) {
    return this.db.medico.create({ data: dados });
  }

  async atualizar(id: string, dados: AtualizarMedicoDTO) {
    await this.buscarPorId(id);
    return this.db.medico.update({ where: { id }, data: dados });
  }

  async remover(id: string) {
    await this.buscarPorId(id);
    await this.db.medico.delete({ where: { id } });
  }
}
