const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const config = require('./config');
const requestLogger = require('./middlewares/requestLogger');
const notFound = require('./middlewares/notFound');
const errorHandler = require('./middlewares/errorHandler');
const apiRoutes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: config.cors.origin, credentials: true }));
// rawBody keeps the exact bytes for payment webhook signature checks.
app.use(
  express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(requestLogger);

app.use('/api/v1', apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
