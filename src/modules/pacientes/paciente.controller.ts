import type { Request, Response } from 'express';
import { idParamSchema } from '../../shared/schemas/idParam.schema';
import { atualizarPacienteSchema, criarPacienteSchema } from './paciente.schema';
import { PacienteService } from './paciente.service';

const service = new PacienteService();

// O controller só traduz HTTP <-> service: valida a entrada e define o status da resposta
export const pacienteController = {
  async listar(_req: Request, res: Response) {
    res.json(await service.listar());
  },

  async buscarPorId(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.buscarPorId(id));
  },

  async criar(req: Request, res: Response) {
    const dados = criarPacienteSchema.parse(req.body);
    res.status(201).json(await service.criar(dados));
  },

  async atualizar(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const dados = atualizarPacienteSchema.parse(req.body);
    res.json(await service.atualizar(id, dados));
  },

  async remover(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    await service.remover(id);
    res.status(204).send();
  },
};
