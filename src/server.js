const app = require('./app');
const env = require('./config/env');

app.listen(env.port, () => {
  console.log(`A la orden Veci escuchando en http://localhost:${env.port}`);
});
