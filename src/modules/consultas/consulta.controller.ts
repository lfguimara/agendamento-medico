import type { Request, Response } from 'express';
import { idParamSchema } from '../../shared/schemas/idParam.schema';
import { agendarConsultaSchema, listarConsultasQuerySchema } from './consulta.schema';
import { ConsultaService } from './consulta.service';

const service = new ConsultaService();

export const consultaController = {
  async listar(req: Request, res: Response) {
    const filtros = listarConsultasQuerySchema.parse(req.query);
    res.json(await service.listar(filtros));
  },

  async buscarPorId(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.buscarPorId(id));
  },

  async agendar(req: Request, res: Response) {
    const dados = agendarConsultaSchema.parse(req.body);
    res.status(201).json(await service.agendar(dados));
  },

  async cancelar(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.cancelar(id));
  },

  async concluir(req: Request, res: Response) {
    const { id } = idParamSchema.parse(req.params);
    res.json(await service.concluir(id));
  },
};
