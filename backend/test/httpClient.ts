import request from 'supertest';
import app from '../src/app';
import { CLAVE_PRUEBA } from './factories';

export async function agenteAutenticado(email: string) {
  const agente = request.agent(app);
  await agente.post('/api/auth/login').send({ email, clave: CLAVE_PRUEBA }).expect(200);
  return agente;
}

export { app };
