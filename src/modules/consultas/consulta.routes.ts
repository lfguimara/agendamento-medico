import { Router } from 'express';
import { consultaController } from './consulta.controller';

export const consultaRoutes = Router();

consultaRoutes.get('/', consultaController.listar);
consultaRoutes.get('/:id', consultaController.buscarPorId);
consultaRoutes.post('/', consultaController.agendar);
consultaRoutes.patch('/:id/cancelar', consultaController.cancelar);
consultaRoutes.patch('/:id/concluir', consultaController.concluir);
