const clientSearch = (term) => ({
  OR: [
    { fullName: { contains: term, mode: 'insensitive' } },
    { email: { contains: term, mode: 'insensitive' } },
  ],
});

module.exports = { clientSearch };
