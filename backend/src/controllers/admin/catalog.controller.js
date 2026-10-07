const adminCatalog = require('../../services/adminCatalog.service');

const meta = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip });

const listPackages = async (req, res) => {
  res.json({ success: true, data: { packages: await adminCatalog.listPackages() } });
};

const createPackage = async (req, res) => {
  const pkg = await adminCatalog.createPackage(req.user, req.body, meta(req));
  res.status(201).json({ success: true, data: { package: pkg } });
};

const updatePackage = async (req, res) => {
  const pkg = await adminCatalog.updatePackage(req.user, req.params.id, req.body, meta(req));
  res.json({ success: true, data: { package: pkg } });
};

const rateGrid = async (req, res) => {
  res.json({ success: true, data: await adminCatalog.rateGrid(req.query) });
};

const saveRates = async (req, res) => {
  res.json({ success: true, data: await adminCatalog.saveRates(req.user, req.body, meta(req)) });
};

const listAreas = async (req, res) => {
  res.json({ success: true, data: { serviceAreas: await adminCatalog.listAreas() } });
};

const updateArea = async (req, res) => {
  const serviceArea = await adminCatalog.updateArea(req.user, req.params.id, req.body, meta(req));
  res.json({ success: true, data: { serviceArea } });
};

module.exports = { listPackages, createPackage, updatePackage, rateGrid, saveRates, listAreas, updateArea };
