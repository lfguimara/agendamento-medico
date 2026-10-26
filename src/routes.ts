import { Router } from 'express';
import { consultaRoutes } from './modules/consultas/consulta.routes';
import { medicoRoutes } from './modules/medicos/medico.routes';
import { pacienteRoutes } from './modules/pacientes/paciente.routes';

export const routes = Router();

routes.use('/pacientes', pacienteRoutes);
routes.use('/medicos', medicoRoutes);
routes.use('/consultas', consultaRoutes);
