import type { Request, Response } from 'express';
import { idParamSchema } from '../../shared/schemas/idParam.schema';
import { atualizarMedicoSchema, criarMedicoSchema, listarMedicosQuerySchema } from './medico.schema';
import { MedicoService } from './medico.service';

const service = new MedicoService();

export const medicoController = {
  async listar(req: Request, res: Response) {
    const filtros = listarMedicosQuerySchema.parse(req.query);
    res.json(await service.listar(filtros));
  },

  async buscarPorId(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.buscarPorId(id));
  },

  async criar(req: Request, res: Response) {
    const dados = criarMedicoSchema.parse(req.body);
    res.status(201).json(await service.criar(dados));
  },

  async atualizar(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    const dados = atualizarMedicoSchema.parse(req.body);
    res.json(await service.atualizar(id, dados));
  },

  async remover(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    await service.remover(id);
    res.status(204).send();
  },
};
