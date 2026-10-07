const CODE_TO_FIELD = {
  EMAIL_ALREADY_REGISTERED: 'email',
  PHONE_ALREADY_REGISTERED: 'phone',
};

// Puts API errors where the user will look: under the field when the API names
// one, otherwise back to the caller as a form-level message.
export default function applyApiError(apiError, setError, fields) {
  let placed = false;

  for (const [field, message] of Object.entries(apiError.fieldErrors)) {
    if (fields.includes(field)) {
      setError(field, { type: 'server', message });
      placed = true;
    }
  }

  const field = CODE_TO_FIELD[apiError.code];
  if (field && fields.includes(field)) {
    setError(field, { type: 'server', message: apiError.message });
    placed = true;
  }

  return placed ? null : apiError.message;
}
