const instructorService = require('../../services/instructor.service');

const get = async (req, res) => {
  const data = await instructorService.getOwnProfile(req.user);
  res.json({ success: true, data });
};

module.exports = { get };
