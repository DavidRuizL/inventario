import app from './app';
import { config } from './config';
import { iniciarTareaPeriodica } from './modules/sync/sync.service';

app.listen(config.PORT, () => {
  console.log(`Inventario por Sedes escuchando en http://localhost:${config.PORT}`);
  iniciarTareaPeriodica();
});
