// Copies only the named fields that are present, so request bodies can never
// set anything a handler did not explicitly allow
const pick = (source, fields) =>
  fields.reduce((picked, key) => {
    if (source[key] !== undefined) picked[key] = source[key];
    return picked;
  }, {});

export default pick;
