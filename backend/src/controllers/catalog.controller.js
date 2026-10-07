const catalog = require('../services/catalog.service');
const onlinePayment = require('../services/onlinePayment.service');
const topInstructors = require('../services/topInstructors.service');

const locations = async (req, res) => {
  res.json({ success: true, data: { locations: await catalog.locations() } });
};

const serviceAreas = async (req, res) => {
  res.json({ success: true, data: { serviceAreas: await catalog.serviceAreas() } });
};

const packages = async (req, res) => {
  res.json({ success: true, data: { packages: await catalog.packages(req.query) } });
};

const instructors = async (req, res) => {
  const { data, meta } = await catalog.listInstructors(req.query);
  res.json({ success: true, data, meta });
};

const instructor = async (req, res) => {
  res.json({ success: true, data: { instructor: await catalog.getInstructor(req.params.id) } });
};

const top = async (req, res) => {
  res.set('Cache-Control', 'public, max-age=600');
  res.json({ success: true, data: { instructors: await topInstructors.list() } });
};

const recommended = async (req, res) => {
  res.json({ success: true, data: { instructors: await catalog.recommended(req.query) } });
};

const slots = async (req, res) => {
  res.json({ success: true, data: await catalog.slots(req.params.id, req.query) });
};

// The provider retries anything that is not 2xx, so only a bad signature or a
// malformed body is refused; duplicates and irrelevant events still get 200.
const paymongoWebhook = async (req, res) => {
  const result = await onlinePayment.handleWebhook({
    rawBody: req.rawBody ? req.rawBody.toString('utf8') : '',
    signatureHeader: req.get('paymongo-signature'),
  });
  res.json({ success: true, data: result });
};

module.exports = { locations, serviceAreas, packages, instructors, instructor, top, recommended, slots, paymongoWebhook };
