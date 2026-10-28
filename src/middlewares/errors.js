function notFound(req, res) {
  res.status(404).render('pages/error', { title: 'No encontrado', message: 'La página que buscas no existe.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.status || 500;
  if (req.xhr || req.accepts(['html', 'json']) === 'json') {
    return res.status(status).json({ error: 'Ocurrió un error, intenta de nuevo' });
  }
  return res.status(status).render('pages/error', {
    title: 'Error', message: 'Ocurrió un error inesperado. Intenta de nuevo en un momento.',
  });
}

module.exports = { notFound, errorHandler };
